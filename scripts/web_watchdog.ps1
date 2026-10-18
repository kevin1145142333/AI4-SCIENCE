# Keeps the AI4 Science web service alive on port 8501.
# Runs from Task Scheduler (at logon + every 5 minutes). ASCII only on purpose.
$ErrorActionPreference = 'SilentlyContinue'

$Root = Split-Path -Parent $PSScriptRoot
$Port = 8501
$Url = "http://127.0.0.1:$Port/ui/api/system"
$LogFile = Join-Path $Root 'logs\watchdog.log'
$Python = Join-Path $Root 'venv\Scripts\python.exe'

function Write-Note([string]$Text) {
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $LogFile -Value "$stamp  $Text" -Encoding UTF8
}

function Test-ServiceUp {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        return ($response.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Test-PortInUse {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        $finished = $async.AsyncWaitHandle.WaitOne(1500, $false)
        $connected = ($finished -and $client.Connected)
        $client.Close()
        return $connected
    } catch {
        return $false
    }
}

if (Test-ServiceUp) { exit 0 }

# Something that is not our app may already hold the port; do not fight it.
if (Test-PortInUse) {
    Write-Note "port $Port is answering but not with our app signature - skipped"
    exit 2
}

if (-not (Test-Path -LiteralPath $Python)) {
    Write-Note "virtual environment missing: $Python"
    exit 3
}

Write-Note "service is down - starting it"
Start-Process -FilePath $Python -ArgumentList 'main.py', '--mode', 'web' -WorkingDirectory $Root -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(150)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    if (Test-ServiceUp) {
        Write-Note "service is up on http://localhost:$Port"
        exit 0
    }
}

Write-Note "service did not answer within 150 seconds - see logs\error_*.log"
exit 4
