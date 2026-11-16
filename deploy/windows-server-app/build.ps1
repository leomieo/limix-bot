param([string]$Output = "$PSScriptRoot\..\..\.omb-scratch\server-installer")
$ErrorActionPreference = 'Stop'
$stage = Join-Path $PSScriptRoot 'payload'
New-Item -ItemType Directory -Path $stage -Force | Out-Null
foreach ($name in @('host.ps1','host.mjs','docker-backend.mjs','compose.yaml')) {
    Copy-Item -LiteralPath (Join-Path "$PSScriptRoot\..\managed-beta" $name) -Destination $stage -Force
}
foreach ($name in @('setup.ps1','supervisor.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $stage -Force
}
Compress-Archive -Path "$stage\*" -DestinationPath "$PSScriptRoot\payload.zip" -Force
dotnet publish "$PSScriptRoot\LimixServer.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $Output
if ($LASTEXITCODE -ne 0) { throw 'Build installer failed.' }
Get-FileHash -LiteralPath (Join-Path $Output 'LimixServer-Setup.exe') -Algorithm SHA256
