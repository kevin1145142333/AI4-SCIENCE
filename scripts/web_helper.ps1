# Helper for the AI4 Science launchers. ASCII only on purpose:
# batch/PowerShell files must survive any console code page.
param(
    [ValidateSet('status', 'waitready', 'waitopen', 'open', 'stop')]
    [string]$Action = 'status',
    [int]$Port = 8501,
    [string]$Path = '/ui/api/system',
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = 'SilentlyContinue'
$url = "http://127.0.0.1:$Port$Path"

function Test-AppReady {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Test-PortBusy {
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

function Get-ListenerPids {
    $pids = @()
    $lines = netstat -ano | Select-String -Pattern ":$Port\s"
    foreach ($line in $lines) {
        if ($line.Line -notmatch 'LISTENING') { continue }
        $parts = @(($line.Line -split '\s+') | Where-Object { $_ -ne '' })
        if ($parts.Count -ge 1) { $pids += $parts[-1] }
    }
    return @($pids | Sort-Object -Unique)
}

switch ($Action) {
    'status' {
        if (Test-AppReady) { exit 0 }
        if (Test-PortBusy) { exit 2 }
        exit 1
    }
    'waitready' {
        $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
        while ((Get-Date) -lt $deadline) {
            if (Test-AppReady) { exit 0 }
            Start-Sleep -Milliseconds 1000
        }
        exit 3
    }
    'waitopen' {
        $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
        while ((Get-Date) -lt $deadline) {
            if (Test-AppReady) {
                try { Start-Process "http://localhost:$Port" } catch { }
                exit 0
            }
            Start-Sleep -Milliseconds 1000
        }
        exit 3
    }
    'open' {
        try { Start-Process "http://localhost:$Port" } catch { }
        exit 0
    }
    'stop' {
        $targets = Get-ListenerPids
        if ($targets.Count -eq 0) {
            Write-Output "[stop] nothing is listening on port $Port"
            exit 1
        }
        foreach ($targetId in $targets) {
            $proc = Get-Process -Id ([int]$targetId) -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Output ("[stop] killing PID {0} ({1})" -f $targetId, $proc.ProcessName)
                Stop-Process -Id ([int]$targetId) -Force
            } else {
                Write-Output "[stop] PID $targetId is already gone"
            }
        }
        exit 0
    }
}
