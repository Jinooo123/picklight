# 新成员第一次 clone 后运行：powershell -ExecutionPolicy Bypass -File scripts/setup-dev.ps1

$ErrorActionPreference = "Continue"

$root = git rev-parse --show-toplevel 2>$null
if (-not $root) { Write-Host "请在仓库目录内运行" -ForegroundColor Red; exit 1 }
Set-Location $root

Write-Host "== 启用提交钩子 ==" -ForegroundColor Cyan
git config core.hooksPath .githooks
Write-Host ("core.hooksPath = " + (git config core.hooksPath))

Write-Host "`n== 工具版本 ==" -ForegroundColor Cyan
foreach ($cmd in @("git", "java", "node", "npm", "mvn", "python")) {
    $c = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($c) {
        $ver = ""
        try { $ver = (& $cmd --version 2>&1 | Select-Object -First 1) } catch { }
        Write-Host ("{0,-8} {1}" -f $cmd, $ver)
    } else {
        Write-Host ("{0,-8} 未安装（第一周需要）" -f $cmd) -ForegroundColor Yellow
    }
}

Write-Host "`n== 下一步 ==" -ForegroundColor Cyan
Write-Host @"
1. 确认已加入远程仓库：git remote -v
2. 拉最新 main：git pull
3. 从任务表挑一项（docs/06-task-breakdown.md），开分支：
   git switch -c feat/T-101-login-page
4. 提交规范：feat(T-101): 登录页与表单校验
"@
