#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""任务表读取与 Issue 正文模板，供 bootstrap 脚本复用。"""

from __future__ import annotations

import csv
import pathlib

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


def load_tasks():
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise SystemExit("docs/tasks.csv 为空，先运行 python scripts/gen_task_docs.py")
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
        "```bash",
        "git switch main && git pull",
        f"git switch -c feat/{row['id']}-<简述>",
        f"# 提交：feat({row['id']}): <一句话说明结果>",
        "```",
        "",
        f"PR 里写 `Closes #<本 Issue 号>`，验收标准逐条勾完再请人评审。"
        f"任务定义见 `docs/06-task-breakdown.md`。",
    ]
    return "\n".join(lines)
