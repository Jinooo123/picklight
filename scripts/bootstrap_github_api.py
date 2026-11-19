#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用 GitHub REST API 建标签、里程碑、Issue 与分支保护，不依赖 gh CLI。

为什么单独有这个脚本：部分校园网/代理环境下 gh（Go 的 TLS 栈）会 TLS handshake timeout，
而 curl 正常。本脚本只用 curl + 标准库，成功率更高。

前置：环境变量 GH_TOKEN（classic token 勾 repo）
用法：
    python scripts/bootstrap_github_api.py --repo Jinooo123/picklight --dry-run
    python scripts/bootstrap_github_api.py --repo Jinooo123/picklight
    python scripts/bootstrap_github_api.py --repo Jinooo123/picklight --skip-issues --skip-protect
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from task_lib import EXTRA_LABELS, PROTECTION, issue_body, load_tasks  # noqa: E402

API = "https://api.github.com"
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""


def api(method: str, path: str, payload=None, retries: int = 4):
    """返回 (status, data)。网络类错误重试，403 二级限流等待后重试。"""
    body_path = out_path = None
    try:
        args = ["curl", "-sS", "--noproxy", "*", "--max-time", "40",
                "-X", method,
                "-H", f"Authorization: Bearer {TOKEN}",
                "-H", "Accept: application/vnd.github+json",
                "-H", "X-GitHub-Api-Version: 2022-11-28",
                "-H", "User-Agent: picklight-bootstrap",
                f"{API}{path}"]

        if payload is not None:
            f = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
            json.dump(payload, f, ensure_ascii=False)
            f.close()
            body_path = f.name
            args += ["-H", "Content-Type: application/json", "--data-binary", "@" + body_path]

        with tempfile.NamedTemporaryFile("w", suffix=".out", delete=False) as of:
            out_path = of.name
        args += ["-o", out_path, "-w", "%{http_code}"]

        attempt = 0
        while True:
            r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8",
                               errors="replace", shell=False)
            raw = pathlib.Path(out_path).read_text(encoding="utf-8", errors="replace") if out_path else ""
            try:
                status = int((r.stdout or "0").strip()[-3:])
            except ValueError:
                status = 0
            try:
                data = json.loads(raw) if raw.strip() else None
            except json.JSONDecodeError:
                data = raw

            retryable = status == 0 or status >= 500
            secondary = status == 403 and isinstance(data, dict) and "rate limit" in (data.get("message", "")).lower()
            if attempt < retries and (retryable or secondary):
                wait = 60 if secondary else 2 * (attempt + 1)
                print(f"    .. {status or 'network'} 重试中（{wait}s）")
                time.sleep(wait)
                attempt += 1
                continue
            return status, data
    finally:
        for p in (body_path, out_path):
            if p and os.path.exists(p):
                os.remove(p)


def ensure_labels(slug):
    created = updated = 0
    for name, color in EXTRA_LABELS.items():
        status, _ = api("POST", f"/repos/{slug}/labels",
                        {"name": name, "color": color, "description": ""})
        if status == 201:
            created += 1
        elif status == 422:  # 已存在，改为更新颜色
            status2, _ = api("PATCH", f"/repos/{slug}/labels/{name}", {"color": color})
            if status2 == 200:
                updated += 1
        else:
            print(f"[label] {name} 失败（{status}）")
    print(f"[label] 新建 {created} 个，更新 {updated} 个")


def ensure_milestones(rows):
    """返回 {里程碑标题: 编号}，已存在的复用。"""
    status, existing = api("GET", f"/repos/{slug_holder[0]}/milestones?state=all&per_page=100")
    numbers = {m["title"]: m["number"] for m in existing} if isinstance(existing, list) else {}

    due = {}
    for row in rows:
        due.setdefault(row["milestone"], row["end"])

    created = 0
    for title, end in due.items():
        if title in numbers:
            print(f"[milestone] 已存在 {title}")
            continue
        st, data = api("POST", f"/repos/{slug_holder[0]}/milestones",
                       {"title": title, "due_on": f"{end}T23:59:59Z"})
        if st == 201 and isinstance(data, dict):
            numbers[title] = data["number"]
            created += 1
            print(f"[milestone] 已创建 {title}（{end}）")
        else:
            print(f"[milestone] {title} 创建失败（{st}）")
    print(f"[milestone] 新建 {created} 个，可用 {len(numbers)} 个")
    return numbers


def assign_milestones(rows, numbers):
    """把 Issue 归到对应里程碑；已归好的跳过。修复早期漏传 milestone 的数据。"""
    issues = {}
    page = 1
    while True:
        st, data = api("GET", f"/repos/{slug_holder[0]}/issues?state=all&per_page=100&page={page}")
        if st != 200 or not isinstance(data, list) or not data:
            break
        for item in data:
            if "pull_request" in item:
                continue
            issues[item["title"]] = item
        if len(data) < 100:
            break
        page += 1

    todo = []
    for row in rows:
        item = issues.get(f"[{row['id']}] {row['title']}")
        if not item or item.get("milestone"):
            continue
        num = numbers.get(row["milestone"])
        if num:
            todo.append((item["number"], num, row["id"]))

    if not todo:
        print("[milestone] 所有 Issue 已归属里程碑")
        return

    fixed = 0
    for issue_no, ms_no, tid in todo:
        st, _ = api("PATCH", f"/repos/{slug_holder[0]}/issues/{issue_no}", {"milestone": ms_no})
        if st == 200:
            fixed += 1
        else:
            print(f"[milestone] {tid}（#{issue_no}）归属失败（{st}）")
        time.sleep(0.4)
    print(f"[milestone] 已为 {fixed}/{len(todo)} 个 Issue 补充里程碑")


def create_issues(rows, numbers):
    slug = slug_holder[0]
    status, page1 = api("GET", f"/repos/{slug}/issues?state=all&per_page=100&page=1")
    existing = {i["title"] for i in page1} if isinstance(page1, list) else set()

    dep_numbers: dict[str, str] = {}
    created = skipped = failed = 0

    for row in rows:
        title = f"[{row['id']}] {row['title']}"
        if title in existing:
            skipped += 1
            continue
        payload = {
            "title": title,
            "body": issue_body(row, dep_numbers),
            "labels": [lb.strip() for lb in row["labels"].split(",") if lb.strip()],
        }
        if numbers.get(row["milestone"]):
            payload["milestone"] = numbers[row["milestone"]]
        st, data = api("POST", f"/repos/{slug}/issues", payload)
        if st == 201 and isinstance(data, dict):
            dep_numbers[row["id"]] = str(data["number"])
            created += 1
            print(f"[issue] #{data['number']} {row['id']} {row['title']}")
        else:
            failed += 1
            msg = data.get("message") if isinstance(data, dict) else str(data)[:120]
            print(f"[issue] 失败 {row['id']}（{st}）{msg}")
        time.sleep(0.9)  # 避开二级限流：每分钟内容类请求不超过 ~60

    print(f"[issue] 新建 {created} 个，跳过 {skipped} 个，失败 {failed} 个")


def protect_main():
    if not PROTECTION.exists():
        print("[protect] 缺少 .github/branch-protection.json，跳过")
        return
    body = json.loads(PROTECTION.read_text(encoding="utf-8"))
    st, data = api("PUT", f"/repos/{slug_holder[0]}/branches/main/protection", body)
    if st == 200:
        print("[protect] main 已开启保护：禁止直推、需 1 人评审")
    else:
        msg = data.get("message") if isinstance(data, dict) else str(data)[:160]
        print(f"[protect] 开启失败（{st}）：{msg}")


slug_holder = [""]


def normalize_repo(value: str) -> str:
    """允许传 owner/repo，也允许传 git@github.com:owner/repo.git 这类地址。"""
    s = (value or "").strip().rstrip("/")
    if s.endswith(".git"):
        s = s[:-4]
    if "://" in s or s.startswith("git@"):
        s = s.replace("git@", "").replace("https://", "").replace("http://", "").replace("ssh://", "")
        s = s.replace(":", "/", 1)
        parts = [x for x in s.split("/") if x]
        if len(parts) >= 3:
            return f"{parts[1]}/{parts[2]}"
    return s


def main():
    ap = argparse.ArgumentParser(description="用 REST API 初始化 GitHub 仓库")
    ap.add_argument("--repo", required=True, help="owner/repo 或仓库地址，如 Jinooo123/picklight")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-issues", action="store_true")
    ap.add_argument("--skip-protect", action="store_true")
    args = ap.parse_args()

    global TOKEN
    rows = load_tasks()
    slug_holder[0] = normalize_repo(args.repo)

    if args.dry_run:
        print(f"仓库 {slug_holder[0]}；任务 {len(rows)} 项；标签 {len(EXTRA_LABELS)} 个；"
              f"里程碑 {len({r['milestone'] for r in rows})} 个")
        print("（dry-run 不联网）")
        return

    if not TOKEN:
        sys.exit("缺少 GH_TOKEN（classic token 勾 repo）")

    st, me = api("GET", "/user")
    if st != 200:
        sys.exit(f"token 校验失败（{st}）：{me}")
    print(f"[auth] 已登录 {me.get('login')}")

    st, repo = api("GET", f"/repos/{slug_holder[0]}")
    if st != 200:
        sys.exit(f"无法访问仓库 {slug_holder[0]}（{st}）："
                 f"{repo.get('message') if isinstance(repo, dict) else repo}")
    print(f"[repo] {repo['full_name']}（{'公开' if not repo['private'] else '私有'}）")

    ensure_labels(slug_holder[0])
    numbers = ensure_milestones(rows)
    if not args.skip_issues:
        create_issues(rows, numbers)
    assign_milestones(rows, numbers)
    if not args.skip_protect:
        protect_main()

    print("\n完成。")


if __name__ == "__main__":
    main()
