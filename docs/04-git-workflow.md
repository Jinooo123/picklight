# Git 协作规范

仓库托管在 GitHub。本地 `main` 已就绪，远程仓库建好后用一条命令接通（见第 2 节）。规范的目的只有一个：**任何时刻 `main` 上都是能跑、能演示的版本**。

## 1. 分支

- `main` 只接受 PR 合并，开启保护：禁止直推、至少 1 人评审、禁止强推和删除。
- 一项任务一个分支，从最新 `main` 切出，命名带任务编号：
  - `feat/T-101-login-page`　新功能
  - `fix/T-305-rating-duplicate`　修缺陷
  - `docs/week1-meeting`　只改文档
- 分支存活不超过一周。合并后删除远程分支，本地也删。
- 演示版本打标签：`v0.1-demo`（第 1 周骨架）、`v0.5-alpha`（第 3 周闭环）、`v1.0.0`（12/26 冻结）。

## 2. 接入远程仓库（只需一次）

先在 GitHub 建一个**空仓库**（不要勾 README、不要勾 .gitignore），然后二选一。

**方式 A：脚本一次做完**（推荐，会顺带建标签、里程碑和 87 个任务 Issue）

```bash
# 首次需要：winget install --id GitHub.cli  然后  gh auth login
python scripts/bootstrap_github.py --repo-url git@github.com:<你的账号>/picklight.git
```

脚本行为：添加 origin → 推送 main → 建 13 个标签 → 建 5 个里程碑 → 按 `docs/tasks.csv` 建 Issue（已存在的标题会跳过）→ 尝试开启 main 保护。想先看效果加 `--dry-run`。

**方式 B：手工命令**

```bash
git remote add origin git@github.com:<你的账号>/picklight.git
git push -u origin main
gh api -X PUT repos/:owner/:repo/branches/main/protection --input .github/branch-protection.json
```

推完在 Settings → Collaborators 邀请 6 位成员，权限选 **Write**。私有仓库的免费账号可能无法开分支保护，那就退一步：群里约定不直推，靠本地钩子和评审兜住。

## 3. 提交信息

格式：`类型(任务编号): 说明`，说明写"做了什么结果"，不写"改了文件"。

```text
feat(T-101): 登录页与表单校验
fix(T-305): 连点导致重复评分
docs: 补第 1 周会议记录
test(T-509): 补动态检索边界用例
chore: 升级 Element Plus 到 2.6
```

仓库自带提交钩子，格式不对会直接拦下，并打印正确示例。新成员 clone 后**必须**先跑一次：

```bash
sh scripts/setup-dev.sh            # macOS / Linux / Git Bash
powershell -ExecutionPolicy Bypass -File scripts/setup-dev.ps1   # Windows PowerShell
```

钩子做三件事：`commit-msg` 校验格式；`pre-commit` 拦敏感文件（`.env`、`*.pem`、`*.key`、`application-local.yml`）、超过 10MB 的文件和残留冲突标记；`pre-push` 提醒别直推 `main`。

一次提交只做一件事。改格式和改逻辑分开提，评审时才看得清。

## 4. 一个任务的完整流程

```bash
git switch main && git pull                 # 1. 更新 main
git switch -c feat/T-101-login-page         # 2. 开分支
# ...写代码，小步提交...
git push -u origin feat/T-101-login-page    # 3. 推分支
gh pr create --fill                         # 4. 开 PR（标题带 T-101）
```

5. 在 PR 描述里写 `Closes #12`，勾选自查清单，附截图。
6. 找一位同伴评审（涉及接口或库表时，必须叫上对应前后端负责人）。
7. 评审通过后 **Squash and merge**，删分支，回 Issue 勾完验收标准并关闭。

评审看四件事：权限有没有漏、异常路径有没有处理、接口是否向后兼容、有没有误提交密钥或媒体文件。评审意见用"建议/必须"区分，别用"随便看看"。

## 5. 标签与里程碑

标签三组，建 Issue 时按需勾：

| 组 | 值 | 用途 |
| --- | --- | --- |
| 类型 | `type/feat` `type/bug` `type/docs` `type/test` `type/chore` | 区分工作性质 |
| 范围 | `area/miniprogram` `area/api` `area/admin` `area/infra` `area/docs` | 谁受影响 |
| 优先级 | `priority/P0` `priority/P1` `priority/P2` | P0 必做主链路，P2 是加分项 |

里程碑与周次一一对应，用来判断"这周该交付什么"：

| 里程碑 | 截止 | 退出条件 |
| --- | --- | --- |
| M1 需求与设计 | 11/27 | 契约、库表、三端骨架、原型 |
| M2 账号·动态·媒体 | 12/04 | 登录/发布/列表可联调 |
| M3 必做功能闭环 | 12/11 | 检索、评分评论、管理全流程通过 |
| M4 加分与系统测试 | 12/18 | 敏感词、统计图、黑盒白盒执行 |
| M5 验收与交付 | 12/26 | 代码冻结、文档、演练 |

任务清单以 `docs/06-task-breakdown.md` 为准，Issue 是它的执行副本；任务范围要改，先改 `scripts/gen_task_docs.py` 里的数据并重新生成，不要只改 Issue 标题。

## 6. CI 检查什么

每次 PR 和推 `main` 会跑 `.github/workflows/repo-check.yml`：

1. PR 标题是否符合 `feat(T-101): 说明`；
2. 有没有提交敏感文件、超过 10MB 的文件、冲突标记（`scripts/check-repo.sh`）；
3. `docs/tasks.csv` 能否解析（防止任务表被改坏）。

红了的 PR 不合并。第 2 周起再加入后端 `mvn test` 与前端 `npm run build` 两个作业。

## 7. 接口与数据变更

- 接口字段、状态码、表结构变更必须同时改 `docs/08-api-contract.md`，并在 PR 里写明影响哪个端。
- 库表只通过 `db/migration/` 下的脚本变更，不许在共享库里手改后不提交脚本。
- 密码、令牌、微信密钥放进被忽略的本地配置，仓库只留 `.env.example`。
- 媒体文件不提交；演示素材放本地 `uploads/`（已忽略），需要共享就传网盘并在文档里写链接。

## 8. 常见问题

| 情况 | 处理 |
| --- | --- |
| `git push` 被拒，提示 protected branch | 你在往 `main` 推。推特性分支，然后开 PR |
| 分支落后 main 有冲突 | `git switch main && git pull` 后回自己分支 `git rebase main`，冲突文件找原作者一起看 |
| 提交了 `.env` 或密钥 | 别只删文件，密钥已进历史。告知欧阳文锦，轮换密钥，再决定是否清理历史 |
| 提交了大文件 | `git rm --cached 文件名` 加入 `.gitignore`，用 `git commit --amend` 或后续提交修正；已推送则联系负责人处理历史 |
| 钩子没生效 | 运行 `git config core.hooksPath`，应为 `.githooks`；不是就重跑 `scripts/setup-dev.sh` |
| 忘了开分支，已在 main 上提交 | 提交还没推就从 main 切分支：`git switch -c feat/T-xxx`，main 回退到 origin/main |
