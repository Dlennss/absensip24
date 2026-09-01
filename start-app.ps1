$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mongoExe = "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe"
$mongoData = Join-Path $root ".mongo-data"
$mongoLogDir = Join-Path $root ".mongo-log"
$mongoLog = Join-Path $mongoLogDir "mongod.log"
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$pythonExe = Join-Path $root ".venv\Scripts\python.exe"

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

if (-not (Test-PortOpen 8100)) {
    Start-Process -FilePath $pythonExe -ArgumentList "-m", "uvicorn", "server:app", "--reload", "--host", "127.0.0.1", "--port", "8100" -WorkingDirectory $backendDir -WindowStyle Hidden
    Start-Sleep -Seconds 5
}

if (-not (Test-PortOpen 3100)) {
    Start-Process -FilePath "npm.cmd" -ArgumentList "start" -WorkingDirectory $frontendDir -WindowStyle Hidden
}

Write-Host "MongoDB : mongodb://localhost:27018"
Write-Host "Backend : http://localhost:8100"
Write-Host "Frontend: http://localhost:3100"
Write-Host "Login admin: admin@local.test / admin123"
