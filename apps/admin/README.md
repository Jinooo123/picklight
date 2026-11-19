# 管理 Web

Vue 3 + Vite + Element Plus + ECharts。骨架由 T-007 建立。

## 怎么跑起来

```bash
cd apps/admin
npm install
npm run dev        # http://localhost:5173
npm run build      # 产物在 dist/
```

开发时 `/api` 会被代理到 `http://localhost:8080`（见 `vite.config.js`），所以本地要先起服务端。
接口前缀写在 `.env.example` 里的 `VITE_API_BASE_URL`，复制成 `.env.local` 后可按需修改。

## 目录

```text
src/main.js           入口，注册 Element Plus 与中文语言包
src/router/index.js   路由与登录守卫（守卫目前只查本地 token，T-701 要改成校验角色）
src/views/Login.vue   登录页（表单已就绪，接口待接）
src/views/Layout.vue  侧边栏 + 顶栏 + 内容区
src/views/Dashboard.vue  统计看板（4 个指标卡 + 图表占位）
src/views/UserList.vue   用户管理（查询表单与表格骨架）
src/views/PostList.vue   内容管理（查询表单与表格骨架）
```

## 现在能做什么 / 还不能做什么

- 能：`npm run dev` 启动、登录页可跳进主布局、三个菜单页可切换
- 不能：真实登录与列表数据。登录逻辑在 T-701，请求封装在 T-702，各页面数据在 T-703/704/705

## 接手位置

| 任务 | 改哪个文件 |
| --- | --- |
| T-701 登录与守卫 | `src/views/Login.vue`、`src/router/index.js` |
| T-702 请求封装 | 新建 `src/api/request.js`，统一 baseURL 与 401 处理 |
| T-703 用户管理 | `src/views/UserList.vue` |
| T-704 内容管理 | `src/views/PostList.vue` |
| T-705 统计看板 | `src/views/Dashboard.vue`（引入 echarts） |
