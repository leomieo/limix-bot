$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mutex = [Threading.Mutex]::new($false, 'Global\LimixCloudHost-' + [Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
    $config = Get-Content -LiteralPath (Join-Path $root 'server.json') -Raw | ConvertFrom-Json
    $env:LIMIX_DOCKER_WSL_DISTRO = 'LimixCloud'
    $env:PATH = (Split-Path -Parent $config.Node) + ';' + $env:PATH
    $log = Join-Path $root 'host.log'
    $lease = $null
    while (-not (Test-Path -LiteralPath (Join-Path $root 'stop'))) {
        try {
            & wsl.exe --distribution LimixCloud --user root --exec service docker start *> $null
            if ($LASTEXITCODE -ne 0) { throw 'Docker Engine is not ready.' }
            if (-not $lease -or $lease.HasExited) {
                $lease = Start-Process -FilePath 'wsl.exe' -ArgumentList @('--distribution','LimixCloud','--user','root','--exec','sleep','infinity') -WindowStyle Hidden -PassThru
            }
            if ((Get-Item -LiteralPath $log -ErrorAction SilentlyContinue).Length -gt 5MB) {
                Move-Item -LiteralPath $log -Destination ($log + '.1') -Force
            }
            Add-Content -LiteralPath $log -Value ((Get-Date -Format o) + ' Checking Cloud host')
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'host.ps1') -Action Once 2>&1 | Add-Content -LiteralPath $log
        } catch {
            Add-Content -LiteralPath $log -Value ((Get-Date -Format o) + ' Host unavailable; retrying in 30 seconds.')
        }
        Start-Sleep -Seconds 30
    }
} finally {
    if ($lease -and -not $lease.HasExited) { Stop-Process -Id $lease.Id -ErrorAction SilentlyContinue }
    $mutex.ReleaseMutex(); $mutex.Dispose()
}
