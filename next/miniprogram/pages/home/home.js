const a = require("../../api");
const PAGE_SIZE = 10;
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
  onShow() {
    return this.load();
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
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    this.setData({ loading: true, error: "" });
    try {
      const p = more ? this.data.page + 1 : 1;
      const b = await a.request(
        "/posts?page=" +
          p +
          "&pageSize=" + PAGE_SIZE +
          "&q=" +
          encodeURIComponent(this.data.q) +
          "&tag=" +
          encodeURIComponent(this.data.tag) +
          "&from=" +
          this.data.from +
          "&to=" +
          this.data.to,
      );
      const tags = more ? this.data.tags : await a.request("/tags");
      if (requestId !== this.requestId) return;
      const previous = more ? this.data.items : [];
      const seen = new Set(previous.map((item) => item.id));
      this.setData({
        items: previous.concat(b.items.filter((item) => !seen.has(item.id)).map(a.post)),
        total: b.total,
        page: p,
        tags,
      });
    } catch (e) {
      if (requestId === this.requestId) this.setData({ error: e.message });
    } finally {
      if (requestId === this.requestId) {
        this.setData({ loading: false });
        wx.stopPullDownRefresh();
      }
    }
  },
  onPullDownRefresh() {
    return this.load();
  },
  onReachBottom() {
    if (!this.data.loading && this.data.page * PAGE_SIZE < this.data.total)
      return this.load(true);
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
