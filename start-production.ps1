#!/usr/bin/env pwsh
# AguGram Production Startup Script
# Запускает сервер и туннель для production использования

param(
    [string]$TunnelType = "cloudflare"  # cloudflare, ngrok, or none
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 AguGram Production Startup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    exit 1
}

# Load environment variables
$envContent = Get-Content ".env" | Where-Object { $_ -notmatch "^#" -and $_ -match "=" }
foreach ($line in $envContent) {
    $parts = $line -split "=", 2
    if ($parts.Count -eq 2) {
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

# Kill existing processes on port 3000
Write-Host "`n📦 Stopping existing processes..." -ForegroundColor Yellow
$existingProcess = netstat -ano | findstr :3000 | ForEach-Object { 
    $parts = $_ -split '\s+'
    $parts[-1]
} | Select-Object -Unique

foreach ($pid in $existingProcess) {
    if ($pid -and $pid -ne "0") {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "  Stopped process $pid" -ForegroundColor Gray
        } catch {}
    }
}

Start-Sleep -Seconds 2

# Start tunnel if requested
$tunnelUrl = $null
if ($TunnelType -eq "cloudflare") {
    Write-Host "`n🌐 Starting Cloudflare Tunnel..." -ForegroundColor Yellow
    
    # Start cloudflared in background
    $tunnelJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        npx cloudflared tunnel --url http://localhost:3000 2>&1
    }
    
    # Wait for tunnel URL
    Write-Host "  Waiting for tunnel URL..." -ForegroundColor Gray
    $maxWait = 30
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waited += 2
        $output = Receive-Job -Job $tunnelJob -Keep 2>$null
        if ($output -match "https://[a-z0-9-]+\.trycloudflare\.com") {
            $tunnelUrl = $Matches[0]
            break
        }
    }
    
    if ($tunnelUrl) {
        Write-Host "  ✅ Tunnel URL: $tunnelUrl" -ForegroundColor Green
        
        # Update .env with new URL
        $envContent = Get-Content ".env" -Raw
        $envContent = $envContent -replace "WEBAPP_URL=.*", "WEBAPP_URL=$tunnelUrl"
        Set-Content ".env" $envContent -NoNewline
        
    } else {
        Write-Host "  ⚠️ Could not get tunnel URL, using existing WEBAPP_URL" -ForegroundColor Yellow
        $tunnelUrl = $env:WEBAPP_URL
    }
} elseif ($TunnelType -eq "ngrok") {
    Write-Host "`n🌐 Starting ngrok Tunnel..." -ForegroundColor Yellow
    Start-Process ngrok -ArgumentList "http 3000" -WindowStyle Hidden
    Start-Sleep -Seconds 5
    
    try {
        $ngrokApi = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 5
        $tunnelUrl = ($ngrokApi.tunnels | Where-Object { $_.proto -eq "https" }).public_url
        Write-Host "  ✅ Tunnel URL: $tunnelUrl" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️ Could not get ngrok URL" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n⚠️ No tunnel - using WEBAPP_URL from .env" -ForegroundColor Yellow
    $tunnelUrl = $env:WEBAPP_URL
}

# Start the server
Write-Host "`n🖥️ Starting server..." -ForegroundColor Yellow
$serverProcess = Start-Process npm -ArgumentList "run dev" -PassThru -NoNewWindow

Start-Sleep -Seconds 5

# Update Telegram Bot Menu Button
if ($tunnelUrl -and $env:TELEGRAM_BOT_TOKEN) {
    Write-Host "`n📱 Updating Telegram Bot Menu Button..." -ForegroundColor Yellow
    
    $menuBody = @{
        menu_button = @{
            type = "web_app"
            text = "🚀 Открыть"
            web_app = @{ url = $tunnelUrl }
        }
    } | ConvertTo-Json -Depth 5
    
    try {
        $result = Invoke-RestMethod -Uri "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/setChatMenuButton" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($menuBody)) -ContentType "application/json; charset=utf-8"
        if ($result.ok) {
            Write-Host "  ✅ Menu Button updated" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⚠️ Could not update Menu Button" -ForegroundColor Yellow
    }
    
    # Send notification to admin
    if ($env:TELEGRAM_ADMIN_ID) {
        $notifyBody = @{
            chat_id = $env:TELEGRAM_ADMIN_ID
            text = "🚀 AguGram запущен!`n`n📍 URL: $tunnelUrl`n⏰ $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            reply_markup = @{
                inline_keyboard = @(
                    ,@(
                        @{
                            text = "🚀 Открыть приложение"
                            web_app = @{ url = $tunnelUrl }
                        }
                    )
                )
            }
        } | ConvertTo-Json -Depth 10
        
        try {
            Invoke-RestMethod -Uri "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/sendMessage" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($notifyBody)) -ContentType "application/json; charset=utf-8" | Out-Null
            Write-Host "  ✅ Admin notified" -ForegroundColor Green
        } catch {}
    }
}

Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AguGram is running!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🌐 URL: " -NoNewline -ForegroundColor White
Write-Host $tunnelUrl -ForegroundColor Cyan
Write-Host "  🤖 Bot: " -NoNewline -ForegroundColor White
Write-Host "@AguGram_Bot" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Wait for server process
try {
    Wait-Process -Id $serverProcess.Id
} catch {
    Write-Host "`n👋 Shutting down..." -ForegroundColor Yellow
}
