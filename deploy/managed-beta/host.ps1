[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Configure', 'Run', 'Once')][string]$Action,
    [ValidateRange(1, 64)][int]$Capacity = 1,
    [string]$Image = 'limix-managed-home:beta'
)
$ErrorActionPreference = 'Stop'
$settingsDir = Join-Path $env:LOCALAPPDATA 'LimixBot-Managed-Host'
$settings = Join-Path $settingsDir 'host.xml'
if ($Action -eq 'Configure') {
    New-Item -ItemType Directory -Force -Path $settingsDir | Out-Null
    $token = Read-Host 'Limix beta host token (same secret configured on Worker)' -AsSecureString
    if ($token.Length -lt 43) { throw 'The host token must contain at least 43 characters.' }
    [pscustomobject]@{ Token = $token; Capacity = $Capacity; Image = $Image } | Export-Clixml -LiteralPath $settings
    return
}
$config = Import-Clixml -LiteralPath $settings
$secret = [System.Net.NetworkCredential]::new('', $config.Token)
$original = @{}
foreach ($key in @('LIMIX_BETA_HOST_TOKEN','LIMIX_BETA_CAPACITY','LIMIX_HOME_IMAGE')) {
    $original[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}
try {
    $env:LIMIX_BETA_HOST_TOKEN = $secret.Password
    $env:LIMIX_BETA_CAPACITY = [string]$config.Capacity
    $env:LIMIX_HOME_IMAGE = $config.Image
    $entry = Join-Path $PSScriptRoot 'host.mjs'
    if ($Action -eq 'Once') { & node.exe $entry --once } else { & node.exe $entry }
    if ($LASTEXITCODE -ne 0) { throw "Limix host exited with code $LASTEXITCODE." }
} finally {
    foreach ($key in $original.Keys) { [Environment]::SetEnvironmentVariable($key, $original[$key], 'Process') }
}
