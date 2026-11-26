const a = require("../../api");

function publicationTime(isoTime) {
  const date = new Date(isoTime);
  const pad = (value) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" +
    pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

Page({
  data: {
    post: null,
    publishedAt: "",
    comments: [],
    userId: null,
    role: "",
    body: "",
    error: "",
    unavailable: false,
    page: 1,
    total: 0,
    pendingAction: "",
  },
  onLoad(o) {
    this.id = o.id;
  },
  onShow() {
    const u = wx.getStorageSync("moment-user");
    this.setData({ userId: u ? u.id : null, role: u ? u.role : "" });
    return this.load();
  },
  async load() {
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    const ratingRevision = this.ratingRevision;
    this.loadingComments = true;
    try {
      const p = await a.request("/posts/" + this.id);
      const c = await a.request("/posts/" + this.id + "/comments");
      if (requestId !== this.requestId) return;
      this.setData({
        // A rating saved while this read was in flight has a newer post snapshot.
        post: this.ratingRevision === ratingRevision ? a.post(p) : this.data.post,
        publishedAt: publicationTime(p.created_at),
        comments: c.items,
        total: c.total,
        page: 1,
        error: "",
        unavailable: false,
      });
      this.hasMoreComments = c.page * c.pageSize < c.total;
    } catch (e) {
      if (requestId === this.requestId) this.showLoadError(e);
    } finally {
      if (requestId === this.requestId) this.loadingComments = false;
    }
  },
  showLoadError(e) {
    this.requestId = (this.requestId || 0) + 1;
    this.loadingComments = false;
    this.hasMoreComments = false;
    this.setData({
      post: null, comments: [], total: 0, page: 1,
      error: e.message, unavailable: e.statusCode === 404,
    });
  },
  home() {
    wx.switchTab({ url: "/pages/home/home" });
  },
  async onReachBottom() {
    if (this.loadingComments || !this.hasMoreComments) return;
    const requestId = this.requestId;
    this.loadingComments = true;
    try {
      const p = this.data.page + 1,
        c = await a.request("/posts/" + this.id + "/comments?page=" + p);
      if (requestId !== this.requestId) return;
      const seen = new Set(this.data.comments.map((item) => item.id));
      this.setData({
        comments: this.data.comments.concat(c.items.filter((item) => !seen.has(item.id))),
        page: p,
        total: c.total,
      });
      this.hasMoreComments = p * c.pageSize < c.total;
    } catch (e) {
      if (requestId === this.requestId) this.handlePostError(e);
    } finally {
      if (requestId === this.requestId) this.loadingComments = false;
    }
  },
  input(e) {
    this.draftRevision = (this.draftRevision || 0) + 1;
    this.setData({ body: e.detail.value });
  },
  previewImage(e) {
    const urls = this.data.post.media.filter((item) => item.type === "image").map((item) => item.url);
    wx.previewImage({ current: e.currentTarget.dataset.url, urls });
  },
  async rate(e) {
    if (!a.login() || this.data.pendingAction) return;
    this.setData({ pendingAction: "rating" });
    try {
      const n = Number(e.currentTarget.dataset.n);
      const answer = await wx.showModal({
        title: "确认评分",
        content: "给这条片刻打 " + n + " 星？",
        confirmText: "提交评分",
        cancelText: "取消",
      });
      if (!answer.confirm) return;
      const updated = await a.request("/posts/" + this.id + "/rating", "PUT", { score: n });
      if (this.data.unavailable) return;
      this.ratingRevision = (this.ratingRevision || 0) + 1;
      this.setData({ post: a.post(updated) });
      wx.showToast({ title: "评分已保存" });
    } catch (e) {
      this.handlePostError(e);
    } finally {
      this.setData({ pendingAction: "" });
    }
  },
  async send() {
    if (!a.login() || this.data.pendingAction) return;
    const draftRevision = this.draftRevision;
    this.setData({ pendingAction: "comment" });
    try {
      await a.request("/posts/" + this.id + "/comments", "POST", {
        body: this.data.body,
      });
      if (draftRevision === this.draftRevision) this.setData({ body: "" });
      await this.load();
    } catch (e) {
      this.handlePostError(e);
    } finally {
      this.setData({ pendingAction: "" });
    }
  },
  handlePostError(e) {
    if (e.statusCode === 404) this.showLoadError(e);
    else a.report(e);
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
