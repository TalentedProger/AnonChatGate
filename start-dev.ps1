#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Запуск локальной среды разработки для AguGram (Telegram Mini App)

.DESCRIPTION
    Этот скрипт:
    1. Проверяет и останавливает конфликтующие процессы
    2. Запускает туннель (ngrok или localtunnel)
    3. Обновляет WEBAPP_URL в .env
    4. Запускает сервер

.PARAMETER Tunnel
    Тип туннеля: ngrok (по умолчанию) или localtunnel

.PARAMETER Port
    Порт сервера (по умолчанию 3000)

.PARAMETER SkipTunnel
    Пропустить запуск туннеля (если уже запущен)

.EXAMPLE
    .\start-dev.ps1
    .\start-dev.ps1 -Tunnel localtunnel
    .\start-dev.ps1 -SkipTunnel
#>

param(
    [ValidateSet("ngrok", "localtunnel")]
    [string]$Tunnel = "ngrok",
    
    [int]$Port = 3000,
    
    [switch]$SkipTunnel
)

$ErrorActionPreference = "Stop"

function Write-Header($text) {
    Write-Host ""
    Write-Host ("═" * 70) -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor White
    Write-Host ("═" * 70) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($number, $text) {
    Write-Host "[$number] $text" -ForegroundColor Yellow
}

function Write-Success($text) {
    Write-Host "  ✓ $text" -ForegroundColor Green
}

function Write-Warning($text) {
    Write-Host "  ⚠ $text" -ForegroundColor Yellow
}

function Write-Error($text) {
    Write-Host "  ✗ $text" -ForegroundColor Red
}

function Test-VPNConnection {
    try {
        $result = Test-NetConnection -ComputerName api.telegram.org -Port 443 -WarningAction SilentlyContinue
        return $result.TcpTestSucceeded
    } catch {
        return $false
    }
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================

Write-Header "AguGram Dev Environment Starter"

# Step 1: Check network connectivity
Write-Step 1 "Проверка сетевого подключения к Telegram API..."

$telegramConnected = Test-VPNConnection
if ($telegramConnected) {
    Write-Success "Подключение к api.telegram.org успешно"
} else {
    Write-Warning "Нет подключения к api.telegram.org"
    Write-Warning "Если используете VPN, убедитесь что он активен"
    Write-Warning "Telegram бот может не работать без VPN в некоторых регионах"
    
    $continue = Read-Host "Продолжить без подключения к Telegram? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}

# Step 2: Stop conflicting processes
Write-Step 2 "Проверка конфликтующих процессов..."

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Warning "Найдено $($nodeProcesses.Count) процесс(ов) Node.js"
    $stop = Read-Host "Остановить? (y/n)"
    if ($stop -eq "y") {
        Stop-Process -Name node -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        Write-Success "Процессы Node.js остановлены"
    }
} else {
    Write-Success "Конфликтующих процессов не найдено"
}

# Step 3: Start tunnel
if (-not $SkipTunnel) {
    Write-Step 3 "Запуск туннеля ($Tunnel)..."
    
    $tunnelUrl = $null
    
    if ($Tunnel -eq "ngrok") {
        # Check if ngrok is already running
        $ngrokProcess = Get-Process ngrok -ErrorAction SilentlyContinue
        if ($ngrokProcess) {
            Write-Warning "ngrok уже запущен. Получаем URL..."
            try {
                $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction Stop
                $tunnelUrl = ($tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1).public_url
            } catch {
                Write-Error "Не удалось получить URL от ngrok. Перезапустите ngrok."
                Write-Host ""
                Write-Host "Запустите в отдельном терминале:" -ForegroundColor Cyan
                Write-Host "  ngrok http $Port" -ForegroundColor Yellow
                exit 1
            }
        } else {
            Write-Host "  Запустите в ОТДЕЛЬНОМ терминале:" -ForegroundColor Cyan
            Write-Host "    ngrok http $Port" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Затем нажмите Enter для продолжения..."
            Read-Host
            
            # Get ngrok URL
            try {
                $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction Stop
                $tunnelUrl = ($tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1).public_url
            } catch {
                Write-Error "Не удалось получить URL от ngrok."
                Write-Host "Убедитесь, что ngrok запущен и попробуйте снова."
                exit 1
            }
        }
    }
    elseif ($Tunnel -eq "localtunnel") {
        Write-Host "  Запускаем localtunnel в фоновом режиме..."
        
        # Start localtunnel
        $ltJob = Start-Job -ScriptBlock {
            param($port)
            & lt --port $port 2>&1
        } -ArgumentList $Port
        
        # Wait for URL
        Start-Sleep -Seconds 3
        $ltOutput = Receive-Job $ltJob 2>&1
        $tunnelUrl = ($ltOutput | Select-String "https://.*\.loca\.lt").Matches.Value
        
        if (-not $tunnelUrl) {
            Write-Error "Не удалось запустить localtunnel"
            Stop-Job $ltJob -ErrorAction SilentlyContinue
            Remove-Job $ltJob -ErrorAction SilentlyContinue
            exit 1
        }
    }
    
    if ($tunnelUrl) {
        Write-Success "Tunnel URL: $tunnelUrl"
        
        # Step 4: Update .env
        Write-Step 4 "Обновление WEBAPP_URL в .env..."
        
        $envPath = Join-Path $PSScriptRoot ".env"
        if (Test-Path $envPath) {
            $envContent = Get-Content $envPath -Raw
            
            # Update or add WEBAPP_URL
            if ($envContent -match "WEBAPP_URL=.*") {
                $envContent = $envContent -replace "WEBAPP_URL=.*", "WEBAPP_URL=$tunnelUrl"
            } else {
                $envContent += "`nWEBAPP_URL=$tunnelUrl"
            }
            
            Set-Content $envPath $envContent -NoNewline
            Write-Success "WEBAPP_URL обновлён: $tunnelUrl"
        } else {
            Write-Error ".env файл не найден!"
            exit 1
        }
    }
} else {
    Write-Step 3 "Пропуск запуска туннеля (--SkipTunnel)"
    
    # Read current WEBAPP_URL
    $envPath = Join-Path $PSScriptRoot ".env"
    if (Test-Path $envPath) {
        $webappUrl = (Get-Content $envPath | Select-String "WEBAPP_URL=(.*)").Matches.Groups[1].Value
        Write-Success "Текущий WEBAPP_URL: $webappUrl"
    }
}

# Step 5: Start the server
Write-Step 5 "Запуск сервера..."
Write-Host ""
Write-Host ("─" * 70) -ForegroundColor Gray
Write-Host ""
Write-Host "  Сервер запускается на порту $Port" -ForegroundColor Green
Write-Host "  Локальный URL: http://localhost:$Port" -ForegroundColor Cyan
Write-Host ""
Write-Host ("─" * 70) -ForegroundColor Gray
Write-Host ""

# Start the server
npm run dev
