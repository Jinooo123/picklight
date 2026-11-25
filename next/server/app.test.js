import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";
async function fixture(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "moment-test-"));
  const { app, db } = createApp({ directory });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const req = async (url, method = "GET", body, token) => {
    const r = await fetch(base + "/api" + url, {
      method,
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body
        ? body instanceof FormData
          ? body
          : JSON.stringify(body)
        : undefined,
    });
    return { status: r.status, ...(await r.json()) };
  };
  const signup = async (username) => {
    const r = await req("/auth/register", "POST", {
      username,
      password: "TestPass123",
      nickname: username,
    });
    assert.equal(r.status, 200);
    return r.data;
  };
  return { req, signup, db, base };
}
const post = {
  title: "图书馆的光",
  body: "一起记住这个下午",
  tags: ["校园", "光影"],
  mediaIds: [],
};
test("账号、会话、密码变更及管理员权限隔离", async (t) => {
  const { req, signup } = await fixture(t);
  const u = await signup("alice");
  assert.equal(
    (
      await req("/auth/register", "POST", {
        username: "alice",
        password: "TestPass123",
      })
    ).status,
    409,
  );
  assert.equal((await req("/admin/users", "GET", null, u.token)).status, 403);
  assert.equal((await req("/me")).status, 401);
  assert.equal(
    (
      await req("/auth/login", "POST", {
        username: "alice",
        password: "wrongpass",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await req(
        "/me/password",
        "PUT",
        { oldPassword: "wrong", password: "NextPass123" },
        u.token,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req(
        "/me/password",
        "PUT",
        { oldPassword: "TestPass123", password: "NextPass123" },
        u.token,
      )
    ).status,
    200,
  );
  assert.equal((await req("/me", "GET", null, u.token)).status, 401);
  assert.equal(
    (
      await req("/auth/login", "POST", {
        username: "alice",
        password: "NextPass123",
      })
    ).status,
    200,
  );
});
test("发布编辑检索分页、归属检查与敏感词拦截", async (t) => {
  const { req, signup } = await fixture(t),
    a = await signup("alice"),
    b = await signup("bob");
  const p = (await req("/posts", "POST", post, a.token)).data;
  assert.equal(
    (await req("/posts?tag=" + encodeURIComponent("校园"))).data.total,
    1,
  );
  assert.equal((await req("/posts?q=nonexistent")).data.total, 0);
  assert.equal((await req("/posts?page=0")).status, 400);
  assert.equal(
    (await req("/posts/" + p.id, "PUT", { ...post, title: "新标题" }, b.token))
      .status,
    403,
  );
  assert.equal(
    (await req("/posts/" + p.id, "DELETE", null, b.token)).status,
    403,
  );
  assert.equal(
    (await req("/posts", "POST", { ...post, body: "违禁测试词" }, a.token))
      .status,
    400,
  );
  assert.equal(
    (
      await req(
        "/posts/" + p.id,
        "PUT",
        { ...post, title: "新的记录" },
        a.token,
      )
    ).status,
    200,
  );
  assert.equal((await req("/posts/" + p.id)).data.title, "新的记录");
  assert.equal(
    (await req("/posts/" + p.id, "DELETE", null, a.token)).status,
    200,
  );
  assert.equal((await req("/posts/" + p.id)).status, 404);
  assert.equal((await req("/posts")).data.total, 0);
});
test("评分 upsert、非法值、自评及评论删除权限", async (t) => {
  const { req, signup } = await fixture(t),
    a = await signup("alice"),
    b = await signup("bob");
  const p = (await req("/posts", "POST", post, a.token)).data;
  assert.equal(
    (await req("/posts/" + p.id + "/rating", "PUT", { score: 4 }, a.token))
      .status,
    403,
  );
  for (const score of [0, 6, 1.5, "5"])
    assert.equal(
      (await req("/posts/" + p.id + "/rating", "PUT", { score }, b.token))
        .status,
      400,
    );
  await req("/posts/" + p.id + "/rating", "PUT", { score: 3 }, b.token);
  const rating = await req(
    "/posts/" + p.id + "/rating",
    "PUT",
    { score: 5 },
    b.token,
  );
  assert.equal(rating.data.average, 5);
  assert.equal(rating.data.ratingCount, 1);
  await req(
    "/posts/" + p.id + "/comments",
    "POST",
    { body: "很有共鸣" },
    b.token,
  );
  const c = (await req("/posts/" + p.id + "/comments")).data.items[0];
  assert.equal(
    (await req("/comments/" + c.id, "DELETE", null, a.token)).status,
    403,
  );
  assert.equal(
    (await req("/comments/" + c.id, "DELETE", null, b.token)).status,
    200,
  );
});
test("后台治理、旧会话失效、内容下架及七日统计", async (t) => {
  const { req, signup, db } = await fixture(t),
    a = await signup("alice"),
    b = await signup("boss");
  db.prepare("UPDATE users SET role='ADMIN' WHERE id=?").run(b.user.id);
  const empty = (await req("/admin/stats", "GET", null, b.token)).data;
  assert.equal(empty.totalPosts, 0);
  assert.equal(empty.daily.length, 7);
  const p = (await req("/posts", "POST", post, a.token)).data;
  assert.equal(
    (await req("/admin/posts/" + p.id, "PATCH", { status: "HIDDEN" }, b.token))
      .status,
    200,
  );
  assert.equal((await req("/posts/" + p.id)).status, 404);
  await req("/admin/posts/" + p.id, "PATCH", { status: "PUBLISHED" }, b.token);
  assert.equal((await req("/posts/" + p.id)).status, 200);
  await req(
    "/admin/users/" + a.user.id,
    "PATCH",
    { status: "DISABLED" },
    b.token,
  );
  assert.equal((await req("/me", "GET", null, a.token)).status, 401);
  assert.equal((await req("/posts/" + p.id)).status, 404);
  const s = (await req("/admin/stats", "GET", null, b.token)).data;
  assert.equal(s.totalUsers, 1);
  assert.equal(s.totalPosts, 1);
  assert.ok(s.activeToday >= 1);
  assert.equal(
    (await req("/admin/audit", "GET", null, b.token)).data.length,
    3,
  );
});
test("真实文件上传、伪类型拒绝、媒体归属与下架访问阻断", async (t) => {
  const { req, signup, base } = await fixture(t),
    a = await signup("alice"),
    b = await signup("bob");
  const bad = new FormData();
  bad.append(
    "file",
    new Blob(["not an image"], { type: "image/png" }),
    "fake.png",
  );
  assert.equal((await req("/media", "POST", bad, a.token)).status, 400);
  const good = new FormData();
  good.append(
    "file",
    new Blob(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      { type: "image/png" },
    ),
    "a.png",
  );
  const m = (await req("/media", "POST", good, a.token)).data;
  assert.equal((await fetch(base + m.url)).status, 403);
  assert.equal(
    (await req("/posts", "POST", { ...post, mediaIds: [m.id] }, b.token))
      .status,
    403,
  );
  const p = (
    await req("/posts", "POST", { ...post, mediaIds: [m.id] }, a.token)
  ).data;
  assert.equal((await fetch(base + m.url)).status, 200);
  await req("/posts/" + p.id, "DELETE", null, a.token);
  assert.equal((await fetch(base + m.url)).status, 404);
});

test("日期边界拒绝与媒体独立发布", async (t) => {
  const { req, signup } = await fixture(t);
  const a = await signup("alice");
  assert.equal((await req("/posts?from=2026-02-30")).status, 400);
  assert.equal((await req("/posts?from=2026-11-26&to=2026-11-20")).status, 400);
  assert.equal(
    (await req("/posts", "POST", { ...post, body: "", mediaIds: [] }, a.token))
      .status,
    400,
  );
  const f = new FormData();
  f.append(
    "file",
    new Blob([
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=",
        "base64",
      ),
    ]),
    "a.png",
  );
  const m = (await req("/media", "POST", f, a.token)).data;
  assert.equal(
    (
      await req(
        "/posts",
        "POST",
        { ...post, body: "", mediaIds: [m.id] },
        a.token,
      )
    ).status,
    200,
  );
});

test("原生小程序页面与适配器连接真实 API（不代替微信渲染验收）", async (t) => {
  const { base, signup } = await fixture(t);
  const u = await signup("native");
  const { readFileSync } = await import("node:fs");
  const vm = await import("node:vm");
  const store = { "moment-token": u.token, "moment-user": u.user };
  const wx = {
    getStorageSync: (k) => store[k],
    removeStorageSync: (k) => delete store[k],
    stopPullDownRefresh() {},
    request(o) {
      fetch(o.url, {
        method: o.method,
        headers: { "Content-Type": "application/json", ...o.header },
        body: o.data ? JSON.stringify(o.data) : undefined,
      })
        .then(async (r) =>
          o.success({ statusCode: r.status, data: await r.json() }),
        )
        .catch(o.fail);
    },
  };
  const app = { globalData: { api: base, user: u.user } };
  const module = { exports: {} };
  vm.runInNewContext(
    readFileSync(new URL("../miniprogram/api.js", import.meta.url), "utf8"),
    { module, getApp: () => app, wx },
  );
  let page;
  vm.runInNewContext(
    readFileSync(
      new URL("../miniprogram/pages/home/home.js", import.meta.url),
      "utf8",
    ),
    { require: () => module.exports, Page: (p) => (page = p), wx },
  );
  page.setData = function (v) {
    Object.assign(this.data, v);
  };
  await page.load();
  assert.equal(page.data.error, "");
  assert.equal(page.data.total, 0);
  const api = module.exports;
  const p = await api.request("/posts", "POST", { ...post, tags: ["原生端"] });
  assert.equal(p.title, post.title);
  await page.load();
  assert.equal(page.data.total, 1);
  assert.equal(page.data.items[0].author, "native");
  const config = JSON.parse(
    readFileSync(new URL("../miniprogram/app.json", import.meta.url), "utf8"),
  );
  assert.equal(config.pages.length, 5);
  for (const route of config.pages) {
    const js = readFileSync(
      new URL("../miniprogram/" + route + ".js", import.meta.url),
      "utf8",
    );
    new vm.Script(js);
    const wxml = readFileSync(
      new URL("../miniprogram/" + route + ".wxml", import.meta.url),
      "utf8",
    );
    assert.ok(wxml.includes("<view"));
  }
});
