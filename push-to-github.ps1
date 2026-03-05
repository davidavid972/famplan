# Push famplan to GitHub - run this script with a valid token
# Usage: .\push-to-github.ps1 -Token "ghp_YOUR_NEW_TOKEN"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$ErrorActionPreference = "Stop"

# 1. Verify token
Write-Host "Verifying token..." -ForegroundColor Cyan
$headers = @{
    Authorization = "token $Token"
    Accept = "application/vnd.github.v3+json"
}
try {
    $user = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers
    Write-Host "Logged in as: $($user.login)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Invalid token. Create a new one at https://github.com/settings/tokens" -ForegroundColor Red
    exit 1
}

# 2. Create repo if it doesn't exist
Write-Host "Checking if repo exists..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "https://api.github.com/repos/$($user.login)/famplan" -Headers $headers | Out-Null
    Write-Host "Repo exists." -ForegroundColor Green
} catch {
    Write-Host "Creating repo famplan..." -ForegroundColor Cyan
    Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body '{"name":"famplan"}' -ContentType "application/json" | Out-Null
    Write-Host "Repo created." -ForegroundColor Green
}

# 3. Push
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
$repoUrl = "https://${Token}@github.com/$($user.login)/famplan.git"
Set-Location $PSScriptRoot
git remote set-url origin $repoUrl
git push -u origin ui-v1

# 4. Remove token from URL (security)
git remote set-url origin "https://github.com/$($user.login)/famplan.git"

Write-Host "`nDone! Your code is on GitHub." -ForegroundColor Green
