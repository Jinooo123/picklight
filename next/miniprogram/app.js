App({
  globalData: { api: "http://127.0.0.1:8088", user: null },
  onLaunch() {
    this.globalData.user = wx.getStorageSync("moment-user") || null;
  },
});
