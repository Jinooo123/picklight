#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把本地仓库接到 GitHub：推 main、建标签、建里程碑、按 docs/tasks.csv 批量建 Issue、开分支保护。

前置：
    winget install --id GitHub.cli      # 或 https://cli.github.com
    gh auth login                       # 浏览器登录一次

用法：
    python scripts/bootstrap_github.py --dry-run                       # 只看会建什么，不联网
    python scripts/bootstrap_github.py --repo-url https://github.com/you/picklight.git
    python scripts/bootstrap_github.py --repo-url ... --skip-issues     # 只推仓库和标签

不用 gh 也能手工做，命令见 docs/04-git-workflow.md。
"""

from __future__ import annotations

import argparse
import csv
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "docs" / "tasks.csv"
PROTECTION = ROOT / ".github" / "branch-protection.json"

EXTRA_LABELS = {
    "type/feat": "1f6feb",
    "type/bug": "d73a4a",
    "type/docs": "0e8a16",
    "type/test": "5319e7",
    "type/chore": "ededed",
    "area/miniprogram": "fbca04",
    "area/api": "0052cc",
    "area/admin": "c2e0c6",
    "area/infra": "bfd4f2",
    "area/docs": "d4c5f9",
    "priority/P0": "b60205",
    "priority/P1": "d93f0b",
    "priority/P2": "fbca04",
}


def run(cmd, check=True, capture=True):
    return subprocess.run(
        cmd, cwd=ROOT, check=check,
        capture_output=capture, text=True, encoding="utf-8", errors="replace",
    )


def load_tasks():
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit("docs/tasks.csv 为空，先运行 python scripts/gen_task_docs.py")
    return rows


def issue_body(row, dep_numbers):
    deps = [d for d in row["depends_on"].split(";") if d]
    if deps:
        dep_line = "、".join(f"#{dep_numbers[d]}" if d in dep_numbers else d for d in deps)
    else:
        dep_line = "无"
    checks = [a for a in row["acceptance"].split("；") if a.strip()]
    lines = [
        f"**负责人**　{row['owner']}　·　**预估**　{row['estimate_h']}h　·　**优先级**　{row['priority']}",
        f"**周次**　{row['week']}（{row['start']} ~ {row['end']}）　·　**里程碑**　{row['milestone']}",
        f"**依赖**　{dep_line}",
        f"**产物**　`{row['artifact']}`",
        "",
        "## 验收标准",
        "",
    ]
    lines += [f"- [ ] {c.strip()}" for c in checks]
    lines += [
        "",
        "## 开工提示",
        "",
        f"```bash",
        f"git switch -c feat/{row['id']}-<简述>",
        f"# 提交：feat({row['id']}): <一句话说明结果>",
        "```",
        "",
        f"PR 里写 `Closes #<本 Issue 号>`，验收标准逐条勾完再请人评审。任务定义见 `docs/06-task-breakdown.md`。",
    ]
    return "\n".join(lines)


def check_gh():
    if not shutil.which("gh"):
        sys.exit(
            "未找到 GitHub CLI（gh）。\n"
            "  Windows: winget install --id GitHub.cli\n"
            "  macOS:   brew install gh\n"
            "装好后执行 gh auth login，再重跑本脚本；或按 docs/04-git-workflow.md 手工操作。"
        )
    r = run(["gh", "auth", "status"], check=False)
    if r.returncode != 0:
        sys.exit("gh 未登录，先执行：gh auth login")


def repo_slug(repo_url):
    r = run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], check=False)
    if r.returncode == 0 and r.stdout.strip():
        return r.stdout.strip()
    raise SystemExit("无法识别仓库名，请确认已在 GitHub 上创建空仓库并添加 origin")


def ensure_remote(repo_url):
    r = run(["git", "remote", "get-url", "origin"], check=False)
    current = r.stdout.strip() if r.returncode == 0 else ""
    if not current:
        run(["git", "remote", "add", "origin", repo_url])
        print(f"[remote] 已添加 origin = {repo_url}")
    elif current != repo_url:
        print(f"[remote] 已存在 origin = {current}，保持不变（如需修改用 git remote set-url）")
    else:
        print(f"[remote] origin 已就绪 = {current}")


def push_main():
    print("[push] 推送 main ...")
    r = run(["git", "push", "-u", "origin", "main"], check=False)
    if r.returncode != 0:
        print(r.stdout + r.stderr)
        sys.exit("推送失败：确认远程是空仓库、地址正确、账号有权限")
    print("[push] 完成")


def ensure_labels(rows):
    labels = dict(EXTRA_LABELS)
    for row in rows:
        for lb in row["labels"].split(","):
            labels.setdefault(lb.strip(), "ededed")
    for name, color in labels.items():
        r = run(["gh", "label", "create", name, "--color", color, "--force"], check=False)
        if r.returncode != 0:
            print(f"[label] 跳过 {name}：{(r.stderr or '').strip().splitlines()[:1]}")
    print(f"[label] 已确保 {len(labels)} 个标签存在")


def ensure_milestones(rows):
    r = run(["gh", "api", "repos/{owner}/{repo}/milestones?state=all&per_page=100", "--jq", ".[].title"], check=False)
    existing = {l.strip() for l in (r.stdout or "").splitlines() if l.strip()}

    seen = {}
    for row in rows:
        seen.setdefault(row["milestone"], row["end"])
    for title, due in seen.items():
        if title in existing:
            print(f"[milestone] 已存在 {title}")
            continue
        r = run(["gh", "api", "-X", "POST", "repos/{owner}/{repo}/milestones",
                 "-f", f"title={title}", "-f", f"due_on={due}T23:59:59Z"], check=False)
        if r.returncode == 0:
            print(f"[milestone] 已创建 {title}（截止 {due}）")
        else:
            print(f"[milestone] 创建失败 {title}：{(r.stderr or '').strip()[:200]}")


def create_issues(rows):
    r = run(["gh", "issue", "list", "--state", "all", "--limit", "300", "--json", "title", "--jq", ".[].title"], check=False)
    existing = {l.strip() for l in (r.stdout or "").splitlines() if l.strip()}

    dep_numbers: dict[str, str] = {}
    created = skipped = 0
    tmpdir = pathlib.Path(tempfile.mkdtemp(prefix="issues-"))

    for row in rows:
        title = f"[{row['id']}] {row['title']}"
        if title in existing:
            skipped += 1
            continue
        body_file = tmpdir / f"{row['id']}.md"
        body_file.write_text(issue_body(row, dep_numbers), encoding="utf-8")
        cmd = ["gh", "issue", "create", "--title", title, "--body-file", str(body_file)]
        for lb in row["labels"].split(","):
            cmd += ["--label", lb.strip()]
        cmd += ["--milestone", row["milestone"]]
        r = run(cmd, check=False)
        if r.returncode == 0:
            url = (r.stdout or "").strip().splitlines()[-1] if r.stdout else ""
            num = url.rstrip("/").split("/")[-1] if url else ""
            if num:
                dep_numbers[row["id"]] = num
            created += 1
            print(f"[issue] {row['id']} {row['title']} -> {url or 'ok'}")
        else:
            print(f"[issue] 失败 {row['id']}：{(r.stderr or '').strip()[:200]}")
    print(f"[issue] 新建 {created} 个，跳过已存在 {skipped} 个")


def protect_main():
    if not PROTECTION.exists():
        print("[protect] 缺少 .github/branch-protection.json，跳过")
        return
    r = run(["gh", "api", "-X", "PUT", "repos/{owner}/{repo}/branches/main/protection",
             "--input", str(PROTECTION)], check=False)
    if r.returncode == 0:
        print("[protect] main 已开启保护：禁止直推、需 1 人评审")
    else:
        msg = (r.stderr or "").strip()
        print("[protect] 开启失败（私有仓库免费账号常见）：" + msg[:200])
        print("          改为在 Settings → Branches 手动添加规则，或在群里约定不直推 main。")


def dry_run(rows):
    print(f"仓库文件：docs/tasks.csv（{len(rows)} 项任务）")
    weeks = {}
    for row in rows:
        weeks[row["week"]] = weeks.get(row["week"], 0) + 1
    print("按周分布：" + "，".join(f"{k} {v} 项" for k, v in sorted(weeks.items())))
    print(f"将创建标签 {len(EXTRA_LABELS)} 个、里程碑 {len({r['milestone'] for r in rows})} 个、Issue {len(rows)} 个")
    print("\n前 3 个 Issue 预览：")
    for row in rows[:3]:
        print("\n" + "=" * 60)
        print(f"[{row['id']}] {row['title']}")
        print(f"标签：{row['labels']}　里程碑：{row['milestone']}")
        print("-" * 60)
        print(issue_body(row, {}))
    print("\n（--dry-run 未联网，未做任何修改）")


def main():
    ap = argparse.ArgumentParser(description="接入 GitHub 并批量创建任务 Issue")
    ap.add_argument("--repo-url", help="远程仓库地址，如 https://github.com/you/picklight.git")
    ap.add_argument("--dry-run", action="store_true", help="只预览，不联网")
    ap.add_argument("--skip-issues", action="store_true")
    ap.add_argument("--skip-protect", action="store_true")
    args = ap.parse_args()

    rows = load_tasks()

    if args.dry_run:
        dry_run(rows)
        return

    if not args.repo_url:
        sys.exit("缺少 --repo-url。先在 GitHub 建空仓库（不要勾 README），再把地址传进来。")

    check_gh()
    ensure_remote(args.repo_url)
    slug = repo_slug(args.repo_url)
    print(f"[repo] {slug}")
    push_main()
    ensure_labels(rows)
    ensure_milestones(rows)
    if not args.skip_issues:
        create_issues(rows)
    if not args.skip_protect:
        protect_main()

    print("\n完成。下一步：")
    print("  1. 在 GitHub → Settings → Collaborators 邀请 6 位成员（Write 权限）")
    print("  2. 打开 Issues 页确认任务卡片，按周次认领")
    print("  3. 每人 clone 后运行 sh scripts/setup-dev.sh 启用提交钩子")


if __name__ == "__main__":
    main()
