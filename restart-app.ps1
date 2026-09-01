$ErrorActionPreference = "Stop"

$ports = @(3100, 8100, 8101, 27018)

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -eq $port }

    foreach ($connection in $connections) {
        $processId = $connection.OwningProcess
        if ($processId -and $processId -ne 0) {
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

Start-Sleep -Seconds 2
& "$PSScriptRoot\start-app.ps1"
