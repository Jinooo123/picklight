# 视觉与组件基线（T-008）

负责人：黄佳佳（julie126）；版本：V1 草稿；日期：2026-11-20。

本表是小程序、管理 Web 和页面原型共用的视觉基线，供各模块直接复制。小程序变量位于 `apps/miniprogram/uni.scss`；管理端在 Element Plus CSS 之后加载 `src/styles/theme.css`，统一覆盖官方 `--el-*` 变量。

## 1. 色板

| 用途 | HEX | 小程序 SCSS | Element Plus 变量 |
| --- | --- | --- | --- |
| 主色 / 主要操作 | #147E70 | $brand | --el-color-primary |
| 主色浅底 / 次要操作 | #E8F2F1 | $brand-light | --el-color-primary-light-9 |
| 主色深色 / 按下 | #10655A | $brand-dark | --el-color-primary-dark-2 |
| 成功 / 正常 | #228552 | $success | --el-color-success |
| 警示 / 待处理 | #99610C | $warning | --el-color-warning |
| 错误 / 删除 | #C23F45 | $danger | --el-color-danger |
| 正文 / 标题 | #1F2A26 | $text-main | --el-text-color-primary |
| 说明 / 次级信息 | #526761 | $text-muted | --el-text-color-secondary |
| 输入占位 | #6B7B76 | $text-placeholder | --el-text-color-placeholder |
| 禁用文字 | #9CAAA5 | $text-disabled | --el-text-color-disabled |
| 白字 | #FFFFFF | $text-inverse | 主要按钮沿用 Element Plus 默认白字 |
| 页面背景 | #F5F6F7 | $bg-page | --el-bg-color-page |
| 卡片 / 内容面 | #FFFFFF | $bg-surface | --el-bg-color |
| 边框 | #DDE5E1 | $border | --el-border-color |
| 分隔线 | #E9EEEB | $divider | --el-border-color-lighter |

管理端主色 hover 以及各语义色的浅色阶由白色混合 30%、50%、70%、80%、90% 得到，active 深色阶混合 20% 黑色；值已完整写入 `theme.css`。新增页面直接用 Element Plus 组件的 `type` 与主题变量，保持同一套按钮、表单和弹窗样式。

状态必须同时提供文字，例如“已禁用”“已下架”“请求失败”；颜色只辅助识别。正文、主要按钮文字不使用禁用色。危险操作使用 danger，业务页面另行提供二次确认。

## 2. 字号、间距与形状

以 375px 宽的设计稿为基准，`750rpx = 屏幕宽度`；因此下表的 rpx 在该宽度下等于 2 倍 px，其他设备由 uni-app 自适应。字号表用于建立层级，不通过固定宽度强行拉伸文字。

| 层级 | 管理端 / 原型 | 小程序 | 小程序变量 / 管理端变量 |
| --- | --- | --- | --- |
| 辅助标签 | 12px | 24rpx | $font-caption / --el-font-size-extra-small |
| 次级说明 | 13px | 26rpx | $font-help / --el-font-size-small |
| 默认正文 | 14px | 28rpx | $font-base / --el-font-size-base |
| 重点正文 / 按钮 | 16px | 32rpx | $font-body / --el-font-size-medium |
| 区域标题 | 18px | 36rpx | $font-title / --el-font-size-large |
| 指标数字 | 28px | 56rpx | $font-metric / 看板指标样式 |

- 字体：`-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif`；普通字重 400，按钮/标题 500，行高 1.5。
- 间距：4 / 8 / 12 / 16 / 24 / 32px，对应 8 / 16 / 24 / 32 / 48 / 64rpx；小程序使用 `$space-xs` 至 `$space-xxl`。
- 标准圆角：8px / 16rpx；管理端使用 `--el-border-radius-base`。
- 小程序按钮最小高度：44px / 88rpx；管理表格的紧凑操作继续使用 Element Plus 原有尺寸体系。
- 卡片白底、1px 边框；正文自然换行，长说明用 `word-break: break-word`。业务页面提供足够横向留白。

## 3. 可直接复制的样式

小程序页面在 `lang="scss"` 中可直接引用 `uni.scss` 变量：

```vue
<style lang="scss" scoped>
.page { padding: $space-lg; background: $bg-page; }
.title { color: $text-main; font-size: $font-title; line-height: $line-height; }
.help { color: $text-muted; font-size: $font-help; }
</style>
```

管理端使用官方变量：

```css
.page-title { color: var(--el-text-color-primary); font-size: var(--el-font-size-large); }
.help { color: var(--el-text-color-secondary); font-size: var(--el-font-size-small); }
```

后台入口已按“先 Element Plus 样式、后项目 theme.css”的顺序加载主题，现有登录、布局、看板和列表说明已接入。小程序的 `App.vue` 现有背景与正文颜色与本表一致；新页面优先引入基础组件，逐项替换所属页面的硬编码样式。

## 4. 五个基础组件

| 组件 | 用途 | 关键配置 |
| --- | --- | --- |
| PlButton | 主要 / 次要 / 危险按钮 | variant、block、loading、disabled；click 事件 |
| PlCard | 白底内容容器 | 默认 / header / footer 插槽 |
| PlEmpty | 空列表及无搜索结果 | title、description、icon、size；图标与操作插槽 |
| PlLoading | 页面或局部加载中 | text、size；自带加载环 |
| PlError | 请求失败及手动重试 | title、message、actionText、icon、size、loading、disabled；retry 事件 |

源码位于 `apps/miniprogram/components/`。完整 props、导入方式与四态示例见 [`components/README.md`](../apps/miniprogram/components/README.md)。组件正文不包含具体业务文案，所有错误消息来自调用页。按钮在 loading 或 disabled 时不触发 click，错误组件不会在重试中重复触发操作。

## 5. 页面四态与协作

| 状态 | 展示 | 页面责任 |
| --- | --- | --- |
| 加载中 | PlLoading；提交按钮 loading | 防重复请求，不提前显示空数据 |
| 空数据 | PlEmpty + 可选引导按钮 | 区分首次无内容与筛选无结果，保留筛选条件 |
| 失败可重试 | PlError；后端 message / 统一错误提示 | 将 retry 连接到页面加载函数，失败不丢输入 |
| 正常 | PlCard 等基础容器与业务内容 | 使用同一份颜色、字号与间距 |

T-008 提供基础组件与视觉值；T-107（潘宇）负责将通用状态组件接入至少三个业务页面。此分工不改变任务表：本次交付基础能力，T-107 验证业务复用与真实接口状态。路由、tabBar、manifest 保持由对应负责人统一维护。

## 6. 验证边界

验证记录见 [`test/T-008-视觉与组件基线.md`](test/T-008-视觉与组件基线.md)。Vue/Sass 编译和浏览器验证用于检查 props、插槽、事件、禁用行为以及主题一致性；微信开发者工具中的原生 button loading 表现与 rpx 真机适配仍须按组件 README 在微信环境补验。
