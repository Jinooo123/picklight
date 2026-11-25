const a = require("../../api");
Page({
  data: {
    user: null,
    items: [],
    page: 1,
    total: 0,
    error: "",
    passwordOpen: false,
    oldPassword: "",
    password: "",
  },
  async onShow() {
    const user = wx.getStorageSync("moment-user") || null;
    this.setData({ user });
    if (user) this.load();
  },
  async load(more = false) {
    if (typeof more !== "boolean") more = false;
    try {
      const p = more ? this.data.page + 1 : 1;
      const b = await a.request("/me/posts?page=" + p);
      this.setData({
        items: more
          ? this.data.items.concat(b.items.map(a.post))
          : b.items.map(a.post),
        total: b.total,
        page: p,
        error: "",
      });
    } catch (e) {
      this.setData({ error: e.message });
    }
  },
  onReachBottom() {
    if (this.data.items.length < this.data.total) this.load(true);
  },
  login() {
    wx.navigateTo({ url: "/pages/auth/auth" });
  },
  edit(e) {
    getApp().globalData.edit = this.data.items.find(
      (p) => p.id === Number(e.currentTarget.dataset.id),
    );
    wx.switchTab({ url: "/pages/editor/editor" });
  },
  async remove(e) {
    const r = await wx.showModal({
      title: "删除片刻",
      content: "确定删除？内容将不再公开展示。",
    });
    if (!r.confirm) return;
    try {
      await a.request("/posts/" + e.currentTarget.dataset.id, "DELETE");
      this.load();
    } catch (e) {
      a.report(e);
    }
  },
  async logout() {
    try {
      await a.request("/auth/logout", "POST");
    } catch (e) {
      a.report(e);
    }
    wx.removeStorageSync("moment-token");
    wx.removeStorageSync("moment-user");
    getApp().globalData.user = null;
    this.setData({ user: null, items: [] });
  },
  toggle() {
    this.setData({ passwordOpen: !this.data.passwordOpen });
  },
  input(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
  },
  async changePassword() {
    try {
      await a.request("/me/password", "PUT", {
        oldPassword: this.data.oldPassword,
        password: this.data.password,
      });
      wx.removeStorageSync("moment-token");
      wx.removeStorageSync("moment-user");
      getApp().globalData.user = null;
      this.setData({
        user: null,
        items: [],
        passwordOpen: false,
        oldPassword: "",
        password: "",
      });
      wx.showToast({ title: "请重新登录", icon: "none" });
    } catch (e) {
      a.report(e);
    }
  },
});
