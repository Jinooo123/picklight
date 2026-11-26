const a = require("../../api");
Page({
  data: {
    register: false,
    username: "",
    nickname: "",
    password: "",
    error: "",
    busy: false,
  },
  input(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
  },
  toggle() {
    this.setData({ register: !this.data.register, error: "" });
  },
  async submit() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      const b = await a.request(
        "/auth/" + (this.data.register ? "register" : "login"),
        "POST",
        {
          username: this.data.username,
          nickname: this.data.nickname,
          password: this.data.password,
        },
      );
      wx.setStorageSync("moment-token", b.token);
      wx.setStorageSync("moment-user", b.user);
      getApp().globalData.user = b.user;
      wx.navigateBack();
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
});
