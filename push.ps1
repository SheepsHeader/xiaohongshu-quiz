# 一键推送本项目到 GitHub
# 用法（在这个目录下打开 PowerShell）：
#   .\push.ps1 -GitHubUser "你的用户名" -RepoName "仓库名"

param(
    [Parameter(Mandatory = $true)][string]$GitHubUser,
    [Parameter(Mandatory = $true)][string]$RepoName
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "`n[1/4] 检查 git 身份" -ForegroundColor Cyan
if (-not (git config user.name)) { git config user.name $GitHubUser }
if (-not (git config user.email)) { git config user.email "$GitHubUser@users.noreply.github.com" }
Write-Host "  作者：$(git config user.name) <$(git config user.email)>"

Write-Host "`n[2/4] 构建最新产物" -ForegroundColor Cyan
$skill = Join-Path $PSScriptRoot '..\..\.dsh\skills\xhs-quiz\scripts'
node "$skill\build.mjs" .
if ($LASTEXITCODE -ne 0) { throw '构建失败，已中止' }

if (git status --short) {
    git add -A
    git commit -q -m "build: 更新产物"
    Write-Host "  已提交产物变更"
} else {
    Write-Host "  无变更"
}

Write-Host "`n[3/4] 配置远端" -ForegroundColor Cyan
$url = "git@github.com:$GitHubUser/$RepoName.git"
$existing = git remote get-url origin 2>$null
if ($existing) {
    git remote set-url origin $url
    Write-Host "  已更新 origin -> $url"
} else {
    git remote add origin $url
    Write-Host "  已添加 origin -> $url"
}

Write-Host "`n[4/4] 推送" -ForegroundColor Cyan
git push -u origin HEAD:main

Write-Host "`n✅ 推送完成" -ForegroundColor Green
Write-Host ""
Write-Host "接下来在浏览器里做两件事：" -ForegroundColor Yellow
Write-Host "  1. 打开 https://github.com/$GitHubUser/$RepoName/settings/pages"
Write-Host "  2. Source 选「Deploy from a branch」→ Branch 选 main / docs → Save"
Write-Host ""
Write-Host "等 1-2 分钟后访问："
Write-Host "  https://$GitHubUser.github.io/$RepoName/" -ForegroundColor Green
