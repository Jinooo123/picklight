const app = () => getApp();
function request(url, method = "GET", data) {
  return new Promise((resolve, reject) =>
    wx.request({
      url: app().globalData.api + "/api" + url,
      method,
      data,
      header: {
        Authorization: "Bearer " + (wx.getStorageSync("moment-token") || ""),
      },
      success: (r) => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(r.data.data);
        else {
          if (r.statusCode === 401) {
            wx.removeStorageSync("moment-token");
            wx.removeStorageSync("moment-user");
            app().globalData.user = null;
          }
          reject(Error(r.data.message || "请求失败"));
        }
      },
      fail: () => reject(Error("连接失败，请检查服务地址与网络")),
    }),
  );
}
function report(e) {
  wx.showToast({
    title: e.message || "操作失败",
    icon: "none",
    duration: 2500,
  });
}
function login() {
  if (wx.getStorageSync("moment-token")) return true;
  wx.navigateTo({ url: "/pages/auth/auth" });
  return false;
}
function media(m) {
  return {
    ...m,
    url:
      app().globalData.api +
      m.url +
      (m.url.startsWith("/uploads/")
        ? "?token=" + wx.getStorageSync("moment-token")
        : ""),
  };
}
function post(p) {
  return { ...p, date: p.created_at.slice(0, 10), media: p.media.map(media) };
}
function upload(file) {
  return new Promise((resolve, reject) =>
    wx.uploadFile({
      url: app().globalData.api + "/api/media",
      filePath: file,
      name: "file",
      header: { Authorization: "Bearer " + wx.getStorageSync("moment-token") },
      success: (r) => {
        try {
          const b = JSON.parse(r.data);
          r.statusCode === 200 ? resolve(b.data) : reject(Error(b.message));
        } catch {
          reject(Error("上传响应异常"));
        }
      },
      fail: () => reject(Error("上传失败，请重试")),
    }),
  );
}
module.exports = { request, report, login, post, media, upload };
