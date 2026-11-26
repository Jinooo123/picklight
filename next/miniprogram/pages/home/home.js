const a = require("../../api");
Page({
  data: {
    items: [],
    tags: [],
    q: "",
    tag: "",
    from: "",
    to: "",
    page: 1,
    total: 0,
    loading: false,
    error: "",
  },
  onLoad() {
    this.load();
  },
  onShow() {
    if (this.data.items.length) this.load();
  },
  input(e) {
    this.setData({ q: e.detail.value });
  },
  date(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
    this.load();
  },
  tag(e) {
    this.setData({ tag: e.currentTarget.dataset.tag || "" });
    this.load();
  },
  async load(more = false) {
    if (typeof more !== "boolean") more = false;
    this.setData({ loading: true, error: "" });
    try {
      const p = more ? this.data.page + 1 : 1;
      const b = await a.request(
        "/posts?page=" +
          p +
          "&q=" +
          encodeURIComponent(this.data.q) +
          "&tag=" +
          encodeURIComponent(this.data.tag) +
          "&from=" +
          this.data.from +
          "&to=" +
          this.data.to,
      );
      this.setData({
        items: more
          ? this.data.items.concat(b.items.map(a.post))
          : b.items.map(a.post),
        total: b.total,
        page: p,
        tags: await a.request("/tags"),
      });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },
  onPullDownRefresh() {
    this.load();
  },
  onReachBottom() {
    if (!this.data.loading && this.data.items.length < this.data.total)
      this.load(true);
  },
  detail(e) {
    wx.navigateTo({
      url: "/pages/detail/detail?id=" + e.currentTarget.dataset.id,
    });
  },
  publish() {
    wx.switchTab({ url: "/pages/editor/editor" });
  },
  clear() {
    this.setData({ tag: "", from: "", to: "", q: "" });
    this.load();
  },
});
