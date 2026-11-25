const a = require("../../api");
Page({
  data: {
    title: "",
    body: "",
    tags: "",
    topics: [],
    topicIndex: 0,
    media: [],
    busy: false,
    uploading: false,
    error: "",
    id: null,
  },
  async onShow() {
    if (!wx.getStorageSync("moment-token")) return;
    try {
      const topics = await a.request("/topics");
      this.setData({
        topics: [{ id: null, title: "自由记录" }].concat(topics),
      });
      const edit = getApp().globalData.edit;
      if (edit) {
        getApp().globalData.edit = null;
        this.setData({
          ...edit,
          tags: edit.tags.join("，"),
          topicIndex: Math.max(
            0,
            this.data.topics.findIndex((t) => t.id === edit.topic_id),
          ),
        });
      }
    } catch (e) {
      a.report(e);
    }
  },
  input(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
  },
  topic(e) {
    this.setData({ topicIndex: Number(e.detail.value) });
  },
  async choose() {
    if (!a.login()) return;
    if (this.data.uploading) return;
    try {
      const b = await wx.chooseMedia({
        count: Math.max(1, 9 - this.data.media.length),
        mediaType: ["image", "video"],
        sourceType: ["album", "camera"],
      });
      this.setData({ uploading: true });
      for (const f of b.tempFiles) {
        if (this.data.media.length >= 9) throw Error("最多 9 个文件");
        const m = await a.upload(f.tempFilePath);
        this.setData({ media: this.data.media.concat(a.media(m)) });
      }
    } catch (e) {
      if (!String(e.errMsg || "").includes("cancel")) a.report(e);
    } finally {
      this.setData({ uploading: false });
    }
  },
  remove(e) {
    this.setData({
      media: this.data.media.filter(
        (_, i) => i !== Number(e.currentTarget.dataset.index),
      ),
    });
  },
  async save() {
    if (!a.login() || this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      await a.request(
        "/posts" + (this.data.id ? "/" + this.data.id : ""),
        this.data.id ? "PUT" : "POST",
        {
          title: this.data.title,
          body: this.data.body,
          tags: this.data.tags.split(/[,，\s]+/).filter(Boolean),
          topicId: this.data.topics[this.data.topicIndex].id,
          mediaIds: this.data.media.map((m) => m.id),
        },
      );
      this.setData({
        title: "",
        body: "",
        tags: "",
        media: [],
        id: null,
        topicIndex: 0,
      });
      wx.showToast({ title: "片刻已保存" });
      wx.switchTab({ url: "/pages/home/home" });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
});
