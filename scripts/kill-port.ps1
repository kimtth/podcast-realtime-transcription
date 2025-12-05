#!/usr/bin/env pwsh
<#
.SYNOPSIS
Kill process running on specified port

.DESCRIPTION
Finds and terminates the process listening on the specified port

.PARAMETER Port
The port number to kill (default: 3000 for Next.js dev server)

.EXAMPLE
.\kill-port.ps1 -Port 3000
.\kill-port.ps1 -Port 8000
#>

param(
    [int]$Port = 3000
)

Write-Host "🔍 Finding process on port $Port..." -ForegroundColor Cyan

# Find process using the port
$process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($process) {
    $pid = $process.OwningProcess
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    
    if ($proc) {
        Write-Host "Found: $($proc.ProcessName) (PID: $pid)" -ForegroundColor Yellow
        Write-Host "Killing process..." -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        Write-Host "✅ Process killed successfully" -ForegroundColor Green
    }
} else {
    Write-Host "❌ No process found on port $Port" -ForegroundColor Red
}

# Verify port is now free
$check = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $check) {
    Write-Host "✅ Port $Port is now free" -ForegroundColor Green
} else {
    Write-Host "⚠️ Port $Port is still in use" -ForegroundColor Yellow
}
