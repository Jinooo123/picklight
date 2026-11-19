#!/usr/bin/env bash
# 仓库卫生检查：敏感文件、超大文件、冲突标记
# 用法：
#   sh scripts/check-repo.sh           检查全部已跟踪文件（CI 用）
#   sh scripts/check-repo.sh --staged  只检查暂存区（pre-commit 用）

set -u

MODE="all"
[ "${1:-}" = "--staged" ] && MODE="staged"

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "不在 Git 仓库内，跳过检查"
  exit 0
}
cd "$root" || exit 0

if [ "$MODE" = "staged" ]; then
  files=$(git -c core.quotepath=false diff --cached --name-only --diff-filter=ACM)
else
  files=$(git -c core.quotepath=false ls-files)
fi

[ -z "$files" ] && exit 0

LIMIT=$((10 * 1024 * 1024))
bad=""

while IFS= read -r f; do
  [ -n "$f" ] || continue
  [ -f "$f" ] || continue

  base=$(basename "$f")
  case "$base" in
    .env|.env.*|*.env)
      case "$base" in
        .env.example|*.env.example) : ;;
        *) bad="$bad$(printf '\n  敏感文件：%s' "$f")" ;;
      esac ;;
    application-local.yml|application-local.yaml|*.pem|*.key|*.p12|*.jks)
      bad="$bad$(printf '\n  敏感文件：%s' "$f")" ;;
  esac

  size=$(wc -c < "$f" 2>/dev/null | tr -d ' ')
  if [ -n "$size" ] && [ "$size" -gt "$LIMIT" ] 2>/dev/null; then
    bad="$bad$(printf '\n  超大文件：%s（%sMB，上限 10MB，媒体请放本地上传目录）' "$f" "$((size / 1024 / 1024))")"
  fi

  if [ -n "$size" ] && [ "$size" -lt 2000000 ] 2>/dev/null; then
    if grep -IlE '^(<<<<<<< |>>>>>>> )' "$f" >/dev/null 2>&1; then
      bad="$bad$(printf '\n  残留冲突标记：%s' "$f")"
    fi
  fi
done <<EOF
$files
EOF

if [ -n "$bad" ]; then
  echo ""
  echo "检查未通过，请先处理："
  printf '%s\n' "$bad"
  echo ""
  echo "确属误报可临时跳过：git commit --no-verify（合并前必须修掉）"
  exit 1
fi

exit 0
