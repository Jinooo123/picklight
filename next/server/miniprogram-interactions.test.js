import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadPage(name, request, wx = {}) {
  let page;
  const script = new URL(`../miniprogram/pages/${name}/${name}.js`, import.meta.url);
  vm.runInNewContext(readFileSync(script, "utf8"), {
    Page: (definition) => { page = definition; },
    require: () => ({ request, post: (p) => p, login: () => true, report: assert.fail }),
    wx: { stopPullDownRefresh() {}, showToast() {}, ...wx },
  });
  page.setData = (values) => Object.assign(page.data, values);
  return page;
}

const post = { id: 7, created_at: "2026-11-26T00:00:00Z", average: 0 };
const comments = { items: [{ id: 10 }], page: 1, pageSize: 1, total: 2 };
const input = (value) => ({ detail: { value } });

test("输入但尚未搜索时，翻页与刷新继续使用已确认的关键词", async () => {
  const queries = [];
  const home = loadPage("home", async (url) => {
    if (url === "/tags") return [];
    const params = new URL(url, "http://localhost").searchParams;
    queries.push([params.get("q"), params.get("page")]);
    return { items: [], total: 20 };
  });
  await home.search(input("光"));
  home.input(input("山"));
  await home.onReachBottom();
  await home.onPullDownRefresh();
  await home.search(input("山"));
  assert.deepEqual(queries, [["光", "1"], ["光", "2"], ["光", "1"], ["山", "1"]]);
});

test("延迟的详情刷新保留刚提交的评分，同时完成评论加载", async () => {
  const slow = Promise.withResolvers();
  const detail = loadPage("detail", async (url, method) => {
    if (method === "PUT") return { ...post, average: 4 };
    if (url.endsWith("/comments")) return slow.promise;
    return post;
  }, { showModal: async () => ({ confirm: true }) });
  detail.onLoad({ id: 7 });
  const refresh = detail.load();
  await detail.rate({ currentTarget: { dataset: { n: 4 } } });
  slow.resolve(comments);
  await refresh;
  assert.equal(detail.data.post.average, 4);
  assert.equal(detail.data.comments[0].id, 10);
});

test("发送中的下一条评论即使与已发送内容相同也保留", async () => {
  const slow = Promise.withResolvers();
  const detail = loadPage("detail", async (url, method) =>
    method === "POST" ? slow.promise : url.endsWith("/comments") ? comments : post);
  detail.input(input("同意"));
  const sending = detail.send();
  detail.input(input(""));
  detail.input(input("同意"));
  slow.resolve();
  await sending;
  assert.equal(detail.data.body, "同意");
  await detail.send();
  assert.equal(detail.data.body, "");
});

test("重复触底只发一次请求，页边界重叠的评论不重复显示", async () => {
  let reads = 0;
  const slow = Promise.withResolvers();
  const detail = loadPage("detail", async (url) => {
    if (url.includes("?page=2")) { reads++; return slow.promise; }
    if (url.endsWith("/comments")) return { ...comments, pageSize: 2, total: 3 };
    return post;
  });
  await detail.load();
  const first = detail.onReachBottom();
  await detail.onReachBottom();
  slow.resolve({ items: [{ id: 10 }, { id: 9 }], total: 3, pageSize: 2 });
  await first;
  await detail.onReachBottom();
  assert.equal(reads, 1);
  assert.deepEqual(Array.from(detail.data.comments, (c) => c.id), [10, 9]);
});

test("发评论返回 404 后，延迟的分页响应不能恢复已下架内容", async () => {
  const slow = Promise.withResolvers();
  const detail = loadPage("detail", async (url, method) => {
    if (method === "POST") throw Object.assign(Error("内容不可见"), { statusCode: 404 });
    if (url.includes("?page=")) return slow.promise;
    return url.endsWith("/comments") ? comments : post;
  });
  await detail.load();
  const more = detail.onReachBottom();
  await detail.send();
  slow.resolve({ items: [{ id: 9 }], total: 2, pageSize: 1 });
  await more;
  assert.equal(detail.data.unavailable, true);
  assert.equal(detail.data.post, null);
  assert.equal(detail.data.comments.length, 0);
});

test("公开动态预览原图时，传给微信的地址不带会话参数", () => {
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(new URL("../miniprogram/api.js", import.meta.url), "utf8"), {
    module, getApp: () => ({ globalData: { api: "http://localhost" } }),
    wx: { getStorageSync: () => "test-token" },
  });
  let preview;
  const detail = loadPage("detail", null, { previewImage: (options) => { preview = options; } });
  detail.data.post = module.exports.post({ ...post, media: [{ type: "image", url: "/uploads/demo.jpg" }] });
  detail.previewImage({ currentTarget: { dataset: { url: detail.data.post.media[0].url } } });
  assert.equal(preview.current, "http://localhost/uploads/demo.jpg");
  assert.deepEqual(Array.from(preview.urls), [preview.current]);
});
