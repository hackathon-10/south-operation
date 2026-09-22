param(
[string]$Target = "http://localhost:5173",
[switch]$SkipZap,
[switch]$SkipTrivy,
[switch]$InstallOnly
)

$ErrorActionPreference = "Continue"

# ============================================================

# NoCyberHere Security Gate

# ============================================================

#

# Runs security checks before commit.

#

# Tools:

# - Semgrep

# - Gitleaks

# - OSV-Scanner

# - npm audit

# - OWASP ZAP

# - Trivy (optional / Docker projects)

#

# Exit code:

# 0 = PASS

# 1 = SECURITY FINDINGS

#

# Reports:

# .nocyberhere/reports/

#

# ============================================================

$Root = Resolve-Path "$PSScriptRoot.."
$ReportDir = Join-Path $Root ".nocyberhere\reports"
$ToolDir = Join-Path $Root ".nocyberhere\tools"

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
New-Item -ItemType Directory -Force -Path $ToolDir | Out-Null

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$Results = @()
$Failed = $false

# ------------------------------------------------------------

# Helpers

# ------------------------------------------------------------

function Write-Header($Message) {
Write-Host ""
Write-Host "============================================================"
Write-Host " $Message"
Write-Host "============================================================"
}

function Write-OK($Message) {
Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Warn($Message) {
Write-Host "  [WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail($Message) {
Write-Host "  [FAIL] $Message" -ForegroundColor Red
}

function Add-Result {
param(
[string]$Tool,
[string]$Status,
[string]$Summary,
[string]$Report
)

```
$script:Results += [PSCustomObject]@{
    Tool = $Tool
    Status = $Status
    Summary = $Summary
    Report = $Report
}

if ($Status -eq "FAIL") {
    $script:Failed = $true
}
```

}

function CommandExists($Command) {
return $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Run-Command {
param(
[string]$Command,
[string[]]$Arguments
)

```
$output = & $Command @Arguments 2>&1
$exitCode = $LASTEXITCODE

return @{
    Output = $output
    ExitCode = $exitCode
}
```

}

# ------------------------------------------------------------

# Project detection

# ------------------------------------------------------------

$HasNpm = Test-Path (Join-Path $Root "package.json")
$HasDocker = Test-Path (Join-Path $Root "Dockerfile")
$HasCompose = (
(Test-Path (Join-Path $Root "docker-compose.yml")) -or
(Test-Path (Join-Path $Root "docker-compose.yaml"))
)

Write-Header "NoCyberHere Security Gate"

Write-Host "Project: $Root"
Write-Host "Target:  $Target"
Write-Host ""

# ============================================================

# 1. Semgrep

# ============================================================

Write-Header "1/6 - Semgrep"

if (-not (CommandExists "semgrep")) {

```
Write-Warn "Semgrep not found."

if (CommandExists "python") {

    Write-Host "Installing Semgrep..."

    python -m pip install semgrep

    if (-not (CommandExists "semgrep")) {
        Write-Fail "Semgrep installation failed."
        Add-Result "Semgrep" "FAIL" `
            "Semgrep could not be installed." `
            "$ReportDir\semgrep-install.txt"
    }

} else {

    Write-Fail "Python is required to install Semgrep."
    Add-Result "Semgrep" "FAIL" `
        "Python is not installed." `
        "$ReportDir\semgrep-install.txt"
}
```

}

if (CommandExists "semgrep") {

```
Write-Host "Running Semgrep..."

$result = Run-Command "semgrep" @(
    "--config=auto",
    "--json",
    "--output=$ReportDir\semgrep-$Timestamp.json",
    "$Root"
)

if ($result.ExitCode -eq 0) {

    Write-OK "No Semgrep findings."
    Add-Result "Semgrep" "PASS" `
        "No findings reported." `
        "$ReportDir\semgrep-$Timestamp.json"

} else {

    Write-Fail "Semgrep found potential security problems."

    Add-Result "Semgrep" "FAIL" `
        "Review Semgrep findings." `
        "$ReportDir\semgrep-$Timestamp.json"

    Write-Host ""
    Write-Host ($result.Output -join "`n")
}
```

}

# ============================================================

# 2. Gitleaks

# ============================================================

Write-Header "2/6 - Gitleaks"

if (-not (CommandExists "gitleaks")) {

```
Write-Warn "Gitleaks not found."

if (CommandExists "winget") {

    Write-Host "Installing Gitleaks..."

    winget install `
        --id Gitleaks.Gitleaks `
        --accept-source-agreements `
        --accept-package-agreements `
        --silent

} else {

    Write-Warn "winget not available."
    Write-Warn "Install Gitleaks manually or add it to PATH."
}
```

}

if (CommandExists "gitleaks") {

```
Write-Host "Scanning repository for secrets..."

$GitleaksReport = "$ReportDir\gitleaks-$Timestamp.json"

$result = Run-Command "gitleaks" @(
    "dir",
    "--source=$Root",
    "--report-format=json",
    "--report-path=$GitleaksReport"
)

if ($result.ExitCode -eq 0) {

    Write-OK "No secrets detected."

    Add-Result "Gitleaks" "PASS" `
        "No secrets detected." `
        $GitleaksReport

} else {

    Write-Fail "Potential secrets detected."

    Add-Result "Gitleaks" "FAIL" `
        "Potential API keys, passwords, tokens, or other secrets detected." `
        $GitleaksReport

    if (Test-Path $GitleaksReport) {
        Get-Content $GitleaksReport | Write-Host
    }
}
```

}

# ============================================================

# 3. OSV-Scanner

# ============================================================

Write-Header "3/6 - OSV-Scanner"

if (-not (CommandExists "osv-scanner")) {

```
Write-Warn "OSV-Scanner not found."

if (CommandExists "winget") {

    Write-Host "Installing OSV-Scanner..."

    winget install `
        --id Google.OSVScanner `
        --accept-source-agreements `
        --accept-package-agreements `
        --silent

} else {

    Write-Warn "winget not available."
}
```

}

if (CommandExists "osv-scanner") {

```
Write-Host "Scanning dependencies..."

$OsvReport = "$ReportDir\osv-$Timestamp.txt"

$result = Run-Command "osv-scanner" @(
    "scan",
    "source",
    "--recursive",
    "$Root"
)

$result.Output | Out-File $OsvReport

if ($result.ExitCode -eq 0) {

    Write-OK "No OSV dependency vulnerabilities detected."

    Add-Result "OSV-Scanner" "PASS" `
        "No known OSV vulnerabilities detected." `
        $OsvReport

} else {

    Write-Fail "Dependency vulnerabilities detected."

    Add-Result "OSV-Scanner" "FAIL" `
        "Known vulnerable dependencies detected." `
        $OsvReport

    Write-Host ""
    $result.Output | Write-Host
}
```

}

# ============================================================

# 4. npm audit

# ============================================================

Write-Header "4/6 - npm audit"

if ($HasNpm -and (CommandExists "npm")) {

```
Write-Host "Running npm audit..."

$NpmReport = "$ReportDir\npm-audit-$Timestamp.json"

Push-Location $Root

$result = Run-Command "npm" @(
    "audit",
    "--json"
)

Pop-Location

$result.Output | Out-File $NpmReport

try {

    $json = ($result.Output -join "`n") | ConvertFrom-Json

    $Vulnerabilities = $json.metadata.vulnerabilities

    $Critical = [int]$Vulnerabilities.critical
    $High = [int]$Vulnerabilities.high
    $Moderate = [int]$Vulnerabilities.moderate
    $Low = [int]$Vulnerabilities.low

    Write-Host ""
    Write-Host "npm audit:"
    Write-Host "  Critical: $Critical"
    Write-Host "  High:     $High"
    Write-Host "  Moderate: $Moderate"
    Write-Host "  Low:      $Low"

    if (($Critical -gt 0) -or ($High -gt 0)) {

        Write-Fail "High/Critical npm vulnerabilities detected."

        Add-Result "npm audit" "FAIL" `
            "$Critical critical, $High high, $Moderate moderate, $Low low." `
            $NpmReport

    } else {

        Write-OK "No high or critical npm vulnerabilities."

        Add-Result "npm audit" "PASS" `
            "$Critical critical, $High high, $Moderate moderate, $Low low." `
            $NpmReport
    }

} catch {

    Write-Warn "Could not parse npm audit output."

    Add-Result "npm audit" "FAIL" `
        "npm audit returned output that could not be parsed." `
        $NpmReport
}
```

} else {

```
Write-Warn "No package.json detected. npm audit skipped."

Add-Result "npm audit" "PASS" `
    "Not an npm project." `
    ""
```

}

# ============================================================

# 5. OWASP ZAP

# ============================================================

Write-Header "5/6 - OWASP ZAP"

if ($SkipZap) {

```
Write-Warn "ZAP explicitly skipped."

Add-Result "OWASP ZAP" "PASS" `
    "Skipped by command-line option." `
    ""
```

} elseif (-not (CommandExists "docker")) {

```
Write-Warn "Docker is not available."
Write-Warn "ZAP automated scan skipped."

Add-Result "OWASP ZAP" "PASS" `
    "Skipped because Docker is unavailable." `
    ""
```

} else {

```
Write-Host "Checking ZAP image..."

docker pull zaproxy/zap-stable | Out-Host

$ZapReport = "$ReportDir\zap-$Timestamp.html"

Write-Host "Running ZAP baseline scan against:"
Write-Host "  $Target"

docker run --rm `
    -v "${ReportDir}:/zap/wrk/:rw" `
    zaproxy/zap-stable `
    zap-baseline.py `
    -t $Target `
    -r "zap-$Timestamp.html"

$ZapExit = $LASTEXITCODE

if ($ZapExit -eq 0) {

    Write-OK "ZAP did not report baseline failures."

    Add-Result "OWASP ZAP" "PASS" `
        "Baseline scan completed without failure." `
        $ZapReport

} else {

    Write-Fail "ZAP reported potential web security issues."

    Add-Result "OWASP ZAP" "FAIL" `
        "Review the ZAP HTML report." `
        $ZapReport

    if (Test-Path $ZapReport) {
        Write-Host ""
        Write-Host "ZAP report:"
        Write-Host $ZapReport
    }
}
```

}

# ============================================================

# 6. Trivy

# ============================================================

Write-Header "6/6 - Trivy"

if ($SkipTrivy) {

```
Write-Warn "Trivy explicitly skipped."

Add-Result "Trivy" "PASS" `
    "Skipped by command-line option." `
    ""
```

} elseif (-not ($HasDocker -or $HasCompose)) {

```
Write-Host "No Docker project detected."

Add-Result "Trivy" "PASS" `
    "No Dockerfile/docker-compose detected." `
    ""
```

} elseif (-not (CommandExists "trivy")) {

```
Write-Warn "Trivy not installed."

if (CommandExists "winget") {

    Write-Host "Installing Trivy..."

    winget install `
        --id AquaSecurity.Trivy `
        --accept-source-agreements `
        --accept-package-agreements `
        --silent

} else {

    Write-Warn "winget unavailable. Trivy skipped."

    Add-Result "Trivy" "PASS" `
        "Skipped because Trivy could not be installed automatically." `
        ""
}
```

}

if (CommandExists "trivy" -and ($HasDocker -or $HasCompose)) {

```
Write-Host "Running Trivy filesystem scan..."

$TrivyReport = "$ReportDir\trivy-$Timestamp.txt"

$result = Run-Command "trivy" @(
    "fs",
    "--severity",
    "HIGH,CRITICAL",
    "$Root"
)

$result.Output | Out-File $TrivyReport

if ($result.ExitCode -eq 0) {

    Write-OK "No high/critical Trivy findings."

    Add-Result "Trivy" "PASS" `
        "No high/critical findings." `
        $TrivyReport

} else {

    Write-Fail "Trivy found high/critical vulnerabilities."

    Add-Result "Trivy" "FAIL" `
        "High/critical vulnerabilities detected." `
        $TrivyReport

    $result.Output | Write-Host
}
```

}

# ============================================================

# FINAL VERDICT

# ============================================================

Write-Header "NoCyberHere FINAL VERDICT"

Write-Host ""

foreach ($Result in $Results) {

```
if ($Result.Status -eq "PASS") {

    Write-Host ("  [OK]   {0} - {1}" -f `
        $Result.Tool,
        $Result.Summary) `
        -ForegroundColor Green

} else {

    Write-Host ("  [FAIL] {0} - {1}" -f `
        $Result.Tool,
        $Result.Summary) `
        -ForegroundColor Red

    if ($Result.Report) {
        Write-Host "         Report: $($Result.Report)"
    }
}
```

}

Write-Host ""

if ($Failed) {

```
Write-Host "============================================================"
Write-Host " SECURITY CHECK FAILED" -ForegroundColor Red
Write-Host "============================================================"
Write-Host ""
Write-Host "Commit BLOCKED."
Write-Host ""
Write-Host "Review the reports under:"
Write-Host "  $ReportDir"
Write-Host ""

exit 1
```

} else {

```
Write-Host "============================================================"
Write-Host " OK - NO SECURITY FINDINGS DETECTED" -ForegroundColor Green
Write-Host "============================================================"
Write-Host ""

exit 0
```

}
