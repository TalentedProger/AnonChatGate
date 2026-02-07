#!/usr/bin/env pwsh
# AguGram - Diagnostic Script
# Checks configuration and connectivity

$ErrorActionPreference = "SilentlyContinue"

function Write-Section($title) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor White
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

function Write-Check($name, $status, $details) {
    $icon = if ($status) { "[OK]" } else { "[FAIL]" }
    $color = if ($status) { "Green" } else { "Red" }
    
    Write-Host "  $icon " -ForegroundColor $color -NoNewline
    Write-Host "$name" -NoNewline
    if ($details) {
        Write-Host " - " -NoNewline
        Write-Host $details -ForegroundColor Gray
    } else {
        Write-Host ""
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "       AguGram - Diagnostic Tool                            " -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta

# 1. Check .env file
Write-Section "1. Checking .env file"

$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Write-Check ".env file exists" $true ""
    
    $envContent = Get-Content $envPath
    
    # Check required variables
    $dbUrl = ""
    $jwtSecret = ""
    $botToken = ""
    $webappUrl = ""
    
    foreach ($line in $envContent) {
        if ($line -match "^DATABASE_URL=(.*)") { $dbUrl = $Matches[1] }
        if ($line -match "^JWT_SECRET=(.*)") { $jwtSecret = $Matches[1] }
        if ($line -match "^TELEGRAM_BOT_TOKEN=(.*)") { $botToken = $Matches[1] }
        if ($line -match "^WEBAPP_URL=(.*)") { $webappUrl = $Matches[1] }
    }
    
    $dbDisplay = if ($dbUrl) { "configured" } else { "NOT SET" }
    Write-Check "DATABASE_URL" ($dbUrl -ne "") $dbDisplay
    
    $jwtLen = $jwtSecret.Length
    $jwtDisplay = "Length: $jwtLen chars"
    if ($jwtLen -lt 32) { $jwtDisplay += " (min 32!)" }
    Write-Check "JWT_SECRET" ($jwtLen -ge 32) $jwtDisplay
    
    $botDisplay = if ($botToken -and $botToken -ne "your-bot-token") { "configured" } else { "NOT SET" }
    Write-Check "TELEGRAM_BOT_TOKEN" ($botToken -ne "" -and $botToken -ne "your-bot-token") $botDisplay
    
    Write-Check "WEBAPP_URL" ($webappUrl -ne "") $webappUrl
} else {
    Write-Check ".env file" $false "File not found!"
}

# 2. Check network connectivity
Write-Section "2. Checking network connectivity"

Write-Host "  Testing api.telegram.org..." -ForegroundColor Gray
$telegramTest = Test-NetConnection -ComputerName api.telegram.org -Port 443 -WarningAction SilentlyContinue
$telegramDisplay = if ($telegramTest.TcpTestSucceeded) { "via $($telegramTest.InterfaceAlias)" } else { "Unreachable - VPN needed?" }
Write-Check "api.telegram.org" $telegramTest.TcpTestSucceeded $telegramDisplay

# Check DNS
$dnsTest = Resolve-DnsName api.telegram.org -ErrorAction SilentlyContinue
$dnsDisplay = if ($dnsTest) { $dnsTest[0].IPAddress } else { "DNS error" }
Write-Check "DNS resolution" ($null -ne $dnsTest) $dnsDisplay

# 3. Check ngrok
Write-Section "3. Checking ngrok"

$ngrokProcess = Get-Process ngrok -ErrorAction SilentlyContinue
Write-Check "ngrok process" ($null -ne $ngrokProcess) ""

$httpsTunnelUrl = ""
if ($ngrokProcess) {
    try {
        $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction Stop
        $httpsTunnel = $tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
        
        if ($httpsTunnel) {
            $httpsTunnelUrl = $httpsTunnel.public_url
            Write-Check "HTTPS tunnel" $true $httpsTunnelUrl
            
            # Check if WEBAPP_URL matches
            if ($webappUrl -and $httpsTunnelUrl -ne $webappUrl) {
                Write-Host ""
                Write-Host "  WARNING: WEBAPP_URL does not match active ngrok tunnel!" -ForegroundColor Yellow
                Write-Host "    .env:   $webappUrl" -ForegroundColor Gray
                Write-Host "    ngrok:  $httpsTunnelUrl" -ForegroundColor Gray
                Write-Host "    -> Update WEBAPP_URL in .env" -ForegroundColor Yellow
            }
        } else {
            Write-Check "HTTPS tunnel" $false "No HTTPS tunnel"
        }
    } catch {
        Write-Check "ngrok API" $false "API unavailable on :4040"
    }
} else {
    Write-Host "  -> Start ngrok: ngrok http 3000" -ForegroundColor Yellow
}

# 4. Check Node.js processes
Write-Section "4. Checking Node.js processes"

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "  Found Node.js processes: $($nodeProcesses.Count)" -ForegroundColor Yellow
    foreach ($proc in $nodeProcesses) {
        Write-Host "    PID: $($proc.Id), Started: $($proc.StartTime)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "  WARNING: Multiple processes may cause bot polling conflict" -ForegroundColor Yellow
    Write-Host "    -> Stop all: Get-Process node | Stop-Process -Force" -ForegroundColor Gray
} else {
    Write-Check "Node.js processes" $true "No running processes"
}

# 5. Summary
Write-Section "Recommendations"

$issues = @()

if (-not $telegramTest.TcpTestSucceeded) {
    $issues += "Enable VPN for Telegram API access"
}

if (-not $ngrokProcess) {
    $issues += "Start ngrok: ngrok http 3000"
}

if ($ngrokProcess -and $webappUrl -and $httpsTunnelUrl -and $httpsTunnelUrl -ne $webappUrl) {
    $issues += "Update WEBAPP_URL=$httpsTunnelUrl in .env"
}

if ($nodeProcesses.Count -gt 0) {
    $issues += "Stop Node.js processes before starting"
}

if ($issues.Count -eq 0) {
    Write-Host "  [OK] All ready! Run: npm run dev" -ForegroundColor Green
} else {
    Write-Host "  Fix the following issues:" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        Write-Host "    -> $issue" -ForegroundColor Yellow
    }
}

Write-Host ""
