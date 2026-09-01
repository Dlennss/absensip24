$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mongoExe = "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe"
$mongoData = Join-Path $root ".mongo-data"
$mongoLogDir = Join-Path $root ".mongo-log"
$mongoLog = Join-Path $mongoLogDir "mongod.log"
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$pythonExe = Join-Path $root ".venv\Scripts\python.exe"
$backendPort = 8101

New-Item -ItemType Directory -Force -Path $mongoData, $mongoLogDir | Out-Null

function Test-PortOpen($port) {
    $connection = Test-NetConnection 127.0.0.1 -Port $port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

if (-not (Test-PortOpen 27018)) {
    Start-Process -FilePath $mongoExe -ArgumentList "--dbpath", $mongoData, "--port", "27018", "--bind_ip", "127.0.0.1", "--logpath", $mongoLog, "--logappend" -WindowStyle Hidden
    Start-Sleep -Seconds 5
}

if (-not (Test-PortOpen 27018)) {
    throw "MongoDB gagal berjalan di port 27018. Cek log: $mongoLog"
}

if (-not (Test-PortOpen $backendPort)) {
    Start-Process -FilePath $pythonExe -ArgumentList "-m", "uvicorn", "server:app", "--reload", "--host", "0.0.0.0", "--port", $backendPort -WorkingDirectory $backendDir -WindowStyle Hidden
    Start-Sleep -Seconds 5
}

if (-not (Test-PortOpen 3100)) {
    $env:HOST = "0.0.0.0"
    Start-Process -FilePath "npm.cmd" -ArgumentList "start" -WorkingDirectory $frontendDir -WindowStyle Hidden
}

$lanIp = (Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } |
    Select-Object -First 1 -ExpandProperty IPv4Address |
    Select-Object -ExpandProperty IPAddress)

Write-Host "MongoDB : mongodb://localhost:27018"
Write-Host "Backend : http://localhost:$backendPort"
Write-Host "Frontend: http://localhost:3100"
if ($lanIp) {
    Write-Host "Akses dari laptop lain/HP: http://$($lanIp):3100"
}
Write-Host "Login admin: admin@gmail.com / adminp24"
