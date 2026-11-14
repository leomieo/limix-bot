[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [ValidateSet("Tailscale", "LAN", "Local")][string]$Connection = "Tailscale",
    [ValidateRange(1024, 65534)][int]$Port = 18799
)
$ErrorActionPreference = 'Stop'
$betaRoot = Join-Path $env:LOCALAPPDATA 'LimixBot-Server-Beta'
$betaData = Join-Path $betaRoot 'data'
$betaVersion = '0.3.47'

Get-CimInstance Win32_Processor | Format-Table Name, NumberOfLogicalProcessors
Get-CimInstance Win32_OperatingSystem | Format-List Caption, Version
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
$dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
if (!$nodeCommand -or !$npxCommand) { throw 'Install Node.js 24 LTS or newer, reopen PowerShell, then run this again.' }
$nodeVersion = & $nodeCommand.Source --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.') { throw 'Node.js version check failed.' }
if ([int]$Matches[1] -lt 24) { throw "Node.js 24+ is required. Found $nodeVersion. Update Node and reopen PowerShell." }
Write-Host "Node $nodeVersion"
if (!$dockerCommand) { throw 'Docker CLI is missing. Install and start Docker Desktop, then run this again.' }
$dockerInfo = & $dockerCommand.Source info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0 -or "$dockerInfo".Trim() -ne 'linux') { throw 'Start Docker Desktop in Linux containers mode, wait until ready, then run this again.' }
Write-Host 'Docker Linux engine is ready.'
$ports = @($Port, ($Port + 1))
$occupied = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in $ports })
if ($occupied.Count) { throw "Port $Port or $($Port + 1) is already in use. Stop the beta server or choose another -Port." }
$priorPath = $env:PATH
if ($Connection -eq 'Tailscale') {
    $tailscaleCommand = Get-Command tailscale.exe -ErrorAction SilentlyContinue
    $tailscaleBinary = if ($tailscaleCommand) { $tailscaleCommand.Source } else { Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe' }
    if (!(Test-Path -LiteralPath $tailscaleBinary)) { throw 'Install Tailscale on both PCs and sign in to the same private network, then run this again: https://tailscale.com/download/windows' }
    $tailnetStatus = & $tailscaleBinary status --json
    if ($LASTEXITCODE -ne 0) { throw 'Open Tailscale and sign in before starting the beta server.' }
    $tailnet = $tailnetStatus | ConvertFrom-Json
    if ($tailnet.BackendState -ne 'Running' -or !$tailnet.Self.Online) { throw 'Tailscale is offline. Sign in and connect before continuing.' }
}
Write-Host "Beta data: $betaData"
Write-Host "Server port: $Port. Webhook port: $($Port + 1)."
if ($CheckOnly) { Write-Host 'Preflight PASS. No server was started.'; return }

$configPath = Join-Path $betaData 'config.json'
if (!(Test-Path -LiteralPath $configPath)) {
    if ((Test-Path -LiteralPath $betaData) -and @(Get-ChildItem -LiteralPath $betaData -Force).Count) {
        throw 'The beta data folder contains files without config.json. Choose a clean beta folder before continuing.'
    }
    New-Item -ItemType Directory -Path $betaData -Force | Out-Null
    $config = @{ language = 'vi'; localVm = @{ mode = 'per-bot'; automaticCapacity = $false; maxInstances = 1; memoryGb = 4; cpus = 2; idleTimeoutMinutes = 30 } }
    [System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
}
Write-Host 'Starting Limix Server beta. Keep this window open; Ctrl+C stops it.'
Write-Host 'Pair your client using the link printed below. Keep the pairing code private.'
$serveArgs = @('--yes', "--package=limixbot@$betaVersion", 'limixbot', 'serve', '--port', "$Port", '--data-dir', $betaData, '--label', 'Limix Xeon Beta')
if ($Connection -eq 'LAN') { $serveArgs += '--lan' }
if ($Connection -eq 'Tailscale') { $serveArgs += '--tailscale' }
$priorWebhookPort = $env:OMB_WEBHOOK_PORT
try {
    if ($Connection -eq 'Tailscale') { $env:PATH = [System.IO.Path]::GetDirectoryName($tailscaleBinary) + ';' + $priorPath }
    $env:OMB_WEBHOOK_PORT = "$($Port + 1)"
    & $npxCommand.Source @serveArgs
    if ($LASTEXITCODE -ne 0) { throw "Limix Server exited with code $LASTEXITCODE." }
} finally {
    $env:OMB_WEBHOOK_PORT = $priorWebhookPort
    $env:PATH = $priorPath
}
