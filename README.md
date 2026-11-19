# 拾光圈

课程期末项目：一个用于发布和浏览图文、视频动态的微信小程序，以及供管理员管理用户和内容的 Web 后台。

## 当前状态

第 1 周（2026-11-21 起）。需求、架构初稿、七人分工、87 项任务分解（318 人时）与 Git 协作流程已完成，远程仓库已接入并开启分支保护；三端骨架已搭好并能启动，业务功能尚未开始，按 [`docs/07-week1-plan.md`](docs/07-week1-plan.md) 推进。

## 交付范围

- 小程序：账号登录及修改密码；图文视频动态的发布、查看、修改、删除；按日期、标签检索；对他人动态评分、评论。
- 管理后台：查询及管理用户、动态；查看使用和活跃统计。
- 优先加分：敏感词过滤、统计图。好友、视频流、大模型处理作为备选扩展，须在主流程稳定后评估。

## 技术方案

| 层 | 方案 |
| --- | --- |
| 用户端 | uni-app、Vue 3，目标平台为微信小程序 |
| 管理端 | Vue 3、Vite、Element Plus、ECharts |
| 服务端 | Java 17、Spring Boot 3、Spring Security、MyBatis-Plus |
| 数据 | MySQL 8；开发环境的媒体文件存储在本地目录，路径由服务端管理 |

微信小程序 + Vue/uni-app 方向已确认；服务端、数据库与后台组件库为初步建议，第一周组会评审后冻结。

## 目录

```text
apps/miniprogram/    用户小程序
apps/admin/          管理 Web
services/api/        REST API 与数据库迁移
docs/                需求、设计、任务分解、协作规范
docs/templates/      老师提供的四份 Word 模板（只读参考）
scripts/             任务生成、仓库检查、环境初始化
presentation/        汇报 PPT
.githooks/           提交信息与仓库卫生钩子
.github/             Issue / PR 模板、CI、分支保护配置
```

## 快速开始

```bash
git clone git@github.com:Jinooo123/picklight.git
cd picklight
sh scripts/setup-dev.sh          # 启用提交钩子（Windows：scripts/setup-dev.ps1）
```

首次 clone 必须先配置 SSH 走 443 端口，否则校园网连不上，步骤见 [`docs/11-团队上手与开发规范.md`](docs/11-团队上手与开发规范.md) 第 2 节。

然后从 GitHub Issues 里挑自己名下的任务（标题形如 `[T-201] 媒体选择与预览`），开分支 `feat/T-201-简述`，提交 `feat(T-201): 说明`，PR 里写 `Closes #编号`。

## 维护者操作

任务表改动后重新生成文档与 CSV：

```bash
python scripts/gen_task_docs.py
```

仓库初始化（标签、里程碑、Issue、分支保护，重复执行安全）：需要 classic token 勾 `repo`，放进环境变量 `GH_TOKEN`。

```bash
python scripts/bootstrap_github_api.py --repo Jinooo123/picklight
```

## 项目文档

- [工作记录与交接](docs/00-项目启动工作记录.md)
- [需求分析](docs/01-requirements.md) · [系统设计](docs/02-architecture.md)
- [分工与进度](docs/03-team-schedule.md) · [Git 协作规范](docs/04-git-workflow.md) · [测试计划](docs/05-test-plan.md)
- [任务分解 WBS（87 项，含验收标准）](docs/06-task-breakdown.md) · [第 1 周执行计划](docs/07-week1-plan.md)
- [团队上手与开发规范](docs/11-团队上手与开发规范.md)
- [任务清单 CSV](docs/tasks.csv) · [汇报 PPT](presentation/)

## 约定

1. `main` 不直推，一项任务一个分支一个 PR，至少一人评审后 squash 合并。
2. 任务范围要改，先改 `scripts/gen_task_docs.py` 再重新生成，不要只改 Issue 标题。
3. 不要提交数据库密码、微信密钥、真实用户数据或上传的媒体文件。
4. 正式截止 2027-01-03，组内目标 2026-12-26 冻结代码，留一周缓冲。
