#!/usr/bin/env bash
# 新成员第一次 clone 后运行：sh scripts/setup-dev.sh

set -u

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "请在仓库目录内运行"; exit 1
}
cd "$root" || exit 1

echo "== 启用提交钩子 =="
git config core.hooksPath .githooks
git config commit.template "" 2>/dev/null || true
chmod +x .githooks/* scripts/*.sh 2>/dev/null || true
echo "core.hooksPath = $(git config core.hooksPath)"

echo ""
echo "== 工具版本 =="
for cmd in git java node npm mvn python; do
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '%-8s %s\n' "$cmd" "$(command -v "$cmd")"
  else
    printf '%-8s 未安装（第一周需要）\n' "$cmd"
  fi
done

echo ""
echo "== 下一步 =="
cat <<'EOF'
1. 确认已加入远程仓库：git remote -v
2. 拉最新 main：git pull
3. 从任务表挑一项（docs/06-task-breakdown.md），开分支：
   git switch -c feat/T-101-login-page
4. 提交规范：feat(T-101): 登录页与表单校验
EOF
