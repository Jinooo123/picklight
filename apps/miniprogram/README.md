# 小程序端

uni-app + Vue 3，目标平台为微信小程序。骨架由 T-006 建立，业务页面由各负责人在自己任务里补全。

## 怎么跑起来

1. 装 [HBuilderX](https://www.dcloud.io/hbuilderx.html)（选「App 开发版」）
2. HBuilderX → 文件 → 打开目录 → 选 `apps/miniprogram`
3. 菜单 **运行 → 运行到小程序模拟器 → 微信开发者工具**
4. 第一次会要求填写微信小程序 AppID：用你自己的测试号（微信开发者工具里「测试号」即可），
   没有 AppID 时可在 `manifest.json` 的 `mp-weixin.appid` 留空，用「不使用 AppID」预览

不需要 `npm install`——这是 HBuilderX 项目结构，编译由 HBuilderX 完成。

## 目录

```text
pages/index/     首页（信息流）
pages/login/     登录
pages/register/  注册
pages/publish/   发布（tabBar）
pages/detail/    动态详情
pages/profile/   我的（tabBar）
pages.json       路由与 tabBar 配置
manifest.json    小程序 AppID、编译配置
uni.scss         色板与字号变量（对应 T-008 的视觉基线）
App.vue          全局样式与启动钩子
```

## 现在能做什么 / 还不能做什么

- 能：5 个页面互相跳转，tabBar 正常，页面已是可编辑的 Vue 3 单文件组件
- 当前状态：`utils/request.js` 已提供统一请求封装和登录态处理，业务页面尚未接入真实接口。通用组件由 T-107（潘宇）实现

## 各人接手位置

| 任务 | 改哪个文件 |
| --- | --- |
| T-101/102 登录注册 | `pages/login/`、`pages/register/` |
| T-104/105/106 登录态、个人中心、改密 | `pages/profile/`、`store/`（新建） |
| T-201~T-207 发布与我的动态 | `pages/publish/`、`pages/my-posts/`（新建） |
| T-301~T-307 浏览与互动 | `pages/index/`、`pages/detail/`、`pages/search/`（新建） |

页面里已经留了 `TODO(T-xxx)` 注释，搜一下就知道该在哪写。
