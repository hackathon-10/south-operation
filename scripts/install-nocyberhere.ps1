$Root = Resolve-Path "$PSScriptRoot.."
$GitHooks = Join-Path $Root ".git\hooks"
$Hook = Join-Path $GitHooks "pre-commit"

if (-not (Test-Path (Join-Path $Root ".git"))) {
Write-Host "ERROR: This is not a Git repository." -ForegroundColor Red
exit 1
}

New-Item -ItemType Directory -Force -Path $GitHooks | Out-Null

$ScriptPath = Join-Path $Root "scripts\NoCyberHere-Security.ps1"

$HookContent = @"
#!/bin/sh

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ScriptPath"

RESULT=$?

if [ $RESULT -ne 0 ]; then
echo ""
echo "NoCyberHere: SECURITY CHECK FAILED"
echo "Commit blocked."
exit 1
fi

echo ""
echo "NoCyberHere: OK"
exit 0
"@

Set-Content -Path $Hook -Value $HookContent -Encoding UTF8

Write-Host ""
Write-Host "NoCyberHere pre-commit hook installed." -ForegroundColor Green
Write-Host ""
Write-Host "Every git commit will now run:"
Write-Host "  - Semgrep"
Write-Host "  - Gitleaks"
Write-Host "  - OSV-Scanner"
Write-Host "  - npm audit"
Write-Host "  - OWASP ZAP"
Write-Host "  - Trivy when Docker is detected"
Write-Host ""
