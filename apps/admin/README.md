# 管理 Web

Vue 3 + Vite + Element Plus + ECharts。骨架由 T-007 建立。

## 怎么跑起来

```bash
cd apps/admin
npm install
npm run dev        # http://localhost:5173
npm run build      # 产物在 dist/
npm test           # 请求封装的本地 HTTP 回归测试，无需启动服务端
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
- 不能：真实登录与列表数据。登录逻辑在 T-701，各页面数据在 T-703/704/705；T-702 已提供统一请求入口，待这些页面接入。

## 统一请求入口（T-702）

页面统一从 `src/api/request.js` 导入请求实例，使用相对于 `VITE_API_BASE_URL` 的路径：

```js
import request from '../api/request'

const payload = await request.get('/admin/users', { params: { page: 1 } })
```

`payload` 是后端返回的完整 JSON，不是 Axios 的 response 对象。当前契约尚未冻结，不在这里猜测业务成功码或自动解包 `data`；T-003 定稿后由业务 API 适配实际字段。HTTP 失败时读取后端 `message` 展示，不将 `code` 数字作为提示。

- 每次请求读取最新的 `localStorage.token` 并注入 `Authorization: Bearer ...`；退出后不沿用旧 token。
- 受保护请求返回 401 时清除 token，跳到 `/login?redirect=来源路径`。并发失效请求只提示一次；旧会话的迟到响应不清除新登录。
- 登录等公开请求使用 `{ skipAuth: true }`，避免带上旧 token；其 401 作为表单错误处理，不触发全局退出。T-701 接口调用需使用此配置。
- 默认超时 10 秒，可通过 `VITE_API_TIMEOUT_MS` 调整。超时/断网提示稍后重试，不自动重发请求，避免重复写入。
- 失败仍返回 rejected Promise，调用方用 `catch` / `finally` 结束加载态；可读取 `error.userMessage`。已有行内错误展示的页面可设置 `{ silent: true }` 关闭全局 toast。
- 主动取消的请求不弹错误提示。403 保留当前会话，由页面显示无权限。

本任务不改变骨架登录页和路由守卫。真实登录、角色验证与登录后回跳由 T-701 实现；后端权限校验不能由前端替代。

验证与联调边界见 [`docs/test/T-702-管理端请求封装.md`](../../docs/test/T-702-管理端请求封装.md)。

## 接手位置

| 任务 | 改哪个文件 |
| --- | --- |
| T-701 登录与守卫 | `src/views/Login.vue`、`src/router/index.js` |
| T-702 请求封装 | 新建 `src/api/request.js`，统一 baseURL 与 401 处理 |
| T-703 用户管理 | `src/views/UserList.vue` |
| T-704 内容管理 | `src/views/PostList.vue` |
| T-705 统计看板 | `src/views/Dashboard.vue`（引入 echarts） |
