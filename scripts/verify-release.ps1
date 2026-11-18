# Local developer verification. Does not mark missing or failing checks as success.
# Run from a Windows PowerShell terminal with Node.js 22 and network access.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Invoke-Checked([string]$Title, [string[]]$NpmArgs) {
  Write-Host "`n>>> $Title" -ForegroundColor Cyan
  & npm @NpmArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: $Title; exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Invoke-Checked 'Install dependencies' @('ci','--include=optional')
Invoke-Checked 'TypeScript' @('run','typecheck')
Invoke-Checked 'ESLint' @('run','lint')
Invoke-Checked 'Backend core tests' @('run','test:core')
Invoke-Checked 'Production build' @('run','build')
Write-Host "`n>>> Install Chromium for Playwright" -ForegroundColor Cyan
& npx playwright install chromium
if ($LASTEXITCODE -ne 0) { Write-Host 'FAILED: Playwright browser install' -ForegroundColor Red; exit $LASTEXITCODE }
Invoke-Checked 'Authenticated browser tests' @('run','test:smoke')
Invoke-Checked 'Dependency advisories' @('audit','--audit-level=high')

Write-Host 'Automated checks passed. Manual security, DR, performance and visual acceptance remain mandatory.' -ForegroundColor Yellow
