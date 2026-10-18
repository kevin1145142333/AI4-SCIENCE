# Makes sure the AI4 Science web service is running, then opens it in the browser.
# Used by the desktop shortcut. ASCII only on purpose.
$ErrorActionPreference = 'SilentlyContinue'

$Root = Split-Path -Parent $PSScriptRoot
$Port = 8501
$Url = "http://127.0.0.1:$Port/ui/api/system"
$Python = Join-Path $Root 'venv\Scripts\python.exe'

function Test-ServiceUp {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        return ($response.StatusCode -eq 200)
    } catch {
        return $false
    }
}

if (-not (Test-ServiceUp)) {
    if (Test-Path -LiteralPath $Python) {
        Start-Process -FilePath $Python -ArgumentList 'main.py', '--mode', 'web' -WorkingDirectory $Root -WindowStyle Hidden
    }
    $deadline = (Get-Date).AddSeconds(150)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 2
        if (Test-ServiceUp) { break }
    }
}

if (Test-ServiceUp) {
    Start-Process "http://localhost:$Port"
    exit 0
}

$msg = "AI4 Science service did not start." + [Environment]::NewLine +
       "See: " + (Join-Path $Root 'logs\watchdog.log')
try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($msg, 'AI4 Science') | Out-Null
} catch {
    Write-Host $msg
}
exit 1
