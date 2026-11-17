param([string]$Output = "$PSScriptRoot\..\..\.omb-scratch\server-installer")
$ErrorActionPreference = 'Stop'
$stage = Join-Path $PSScriptRoot 'payload'
New-Item -ItemType Directory -Path $stage -Force | Out-Null
foreach ($name in @('host.ps1','host.mjs','power-probe.mjs','updater.mjs','docker-backend.mjs','compose.yaml')) {
    Copy-Item -LiteralPath (Join-Path "$PSScriptRoot\..\managed-beta" $name) -Destination $stage -Force
}
foreach ($name in @('setup.ps1','supervisor.ps1')) {
    $legacy = Join-Path $stage $name
    if (Test-Path -LiteralPath $legacy) { Remove-Item -LiteralPath $legacy }
}
foreach ($name in @('repair.ps1','server-storage.ps1','hyperv-setup.ps1','hyperv-common.ps1','hyperv-control.ps1','linux-bootstrap.py','linux-health.py','image-tools.Dockerfile')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $stage -Force
}
foreach ($script in Get-ChildItem -LiteralPath $stage -Filter '*.ps1') {
    $content = [IO.File]::ReadAllText($script.FullName, [Text.Encoding]::UTF8)
    [IO.File]::WriteAllText($script.FullName, $content, [Text.UTF8Encoding]::new($true))
    $parseErrors = $null
    $ast = [Management.Automation.Language.Parser]::ParseFile($script.FullName, [ref]$null, [ref]$parseErrors)
    if ($parseErrors.Count) { throw "Invalid packaged PowerShell script: $($script.Name)" }
    if ($script.Name -in @('host.ps1','hyperv-control.ps1') -and -not $ast.ParamBlock) {
        throw "Missing script parameter block: $($script.Name)"
    }
}
Compress-Archive -Path "$stage\*" -DestinationPath "$PSScriptRoot\payload.zip" -Force
dotnet publish "$PSScriptRoot\LimixServer.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $Output
if ($LASTEXITCODE -ne 0) { throw 'Build installer failed.' }
Get-FileHash -LiteralPath (Join-Path $Output 'LimixServer-Setup.exe') -Algorithm SHA256
