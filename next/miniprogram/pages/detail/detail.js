const a = require("../../api");
Page({
  data: {
    post: null,
    comments: [],
    userId: null,
    role: "",
    body: "",
    score: 0,
    error: "",
    page: 1,
    total: 0,
    busy: false,
  },
  onLoad(o) {
    this.id = o.id;
    this.load();
  },
  onShow() {
    const u = wx.getStorageSync("moment-user");
    this.setData({ userId: u ? u.id : null, role: u ? u.role : "" });
  },
  async load() {
    try {
      const p = await a.request("/posts/" + this.id);
      const c = await a.request("/posts/" + this.id + "/comments");
      this.setData({
        post: a.post(p),
        comments: c.items,
        total: c.total,
        page: 1,
        error: "",
      });
    } catch (e) {
      this.setData({ error: e.message });
    }
  },
  async onReachBottom() {
    if (this.data.comments.length >= this.data.total) return;
    try {
      const p = this.data.page + 1,
        c = await a.request("/posts/" + this.id + "/comments?page=" + p);
      this.setData({ comments: this.data.comments.concat(c.items), page: p });
    } catch (e) {
      a.report(e);
    }
  },
  input(e) {
    this.setData({ body: e.detail.value });
  },
  async rate(e) {
    if (!a.login() || this.data.busy) return;
    this.setData({ busy: true });
    try {
      const n = Number(e.currentTarget.dataset.n);
      await a.request("/posts/" + this.id + "/rating", "PUT", { score: n });
      this.setData({ score: n });
      await this.load();
      wx.showToast({ title: "评分已保存" });
    } catch (e) {
      a.report(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  async send() {
    if (!a.login() || this.data.busy) return;
    this.setData({ busy: true });
    try {
      await a.request("/posts/" + this.id + "/comments", "POST", {
        body: this.data.body,
      });
      this.setData({ body: "" });
      await this.load();
    } catch (e) {
      a.report(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  async remove(e) {
    try {
      await a.request("/comments/" + e.currentTarget.dataset.id, "DELETE");
      await this.load();
    } catch (e) {
      a.report(e);
    }
  },
});
