$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::InputEncoding = [Text.Encoding]::UTF8
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$root = Split-Path -Parent $PSScriptRoot
$taskName = 'Limix Cloud Server'
$sourceConfig = Join-Path $env:LOCALAPPDATA 'LimixBot-Managed-Host\host.xml'
if (-not (Test-Path -LiteralPath $sourceConfig)) { throw 'Không tìm thấy cấu hình Cloud host. Cần dùng tài khoản Windows đã chạy Cloud.' }
$hostConfig = Import-Clixml -LiteralPath $sourceConfig
$null = [Net.NetworkCredential]::new('', $hostConfig.Token).Password
$node = (Get-Command node.exe -ErrorAction Stop).Source
$nodeVersion = & $node -p 'process.versions.node.split(".")[0]'
if ($LASTEXITCODE -ne 0 -or [int]$nodeVersion -lt 24) { throw 'Cần Node.js 24 trở lên.' }
$docker = (Get-Command docker.exe -ErrorAction Stop).Source
if ((& $docker info --format '{{.OSType}}' 2>$null) -ne 'linux') { throw 'Mở Docker Desktop ở chế độ Linux trước khi chuyển Cloud.' }
$activeHost = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'managed-beta[\\/]host\.mjs' })
if ($activeHost.Count) { throw 'Dừng cửa sổ Cloud host cũ bằng Ctrl+C trước khi cài. Giữ Docker Desktop mở.' }
if (Test-Path -LiteralPath (Join-Path $root 'server.json')) { throw 'Đã cài Cloud Server. Dùng Bắt đầu/Dừng; không chuyển dữ liệu lần nữa.' }
function WslPath([string]$path) {
    if ($path -notmatch '^[A-Za-z]:[\\/]') { throw 'Cần đường dẫn trên ổ đĩa Windows cục bộ.' }
    return '/mnt/' + $path.Substring(0,1).ToLowerInvariant() + $path.Substring(2).Replace('\','/')
}
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'supervisor.ps1') + '"') -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT30S'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$settings.Enabled = $false
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User $currentUser -Password $request.Password -RunLevel Highest -Force | Out-Null
$request.Password = $null
Write-Output 'Đã đăng ký tác vụ khởi động Windows, đang tắt trong lúc chuyển dữ liệu.'
$backup = Join-Path $root ('backup-' + (Get-Date -Format yyyyMMdd-HHmmss))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$distros = ((& wsl.exe --list --quiet) -join "`n").Replace([string][char]0,'')
if ($distros -notmatch '(?m)^LimixCloud\s*$') {
    Write-Output 'Đang tải Ubuntu 24.04 chính thức. Có thể mất vài phút.'
    $archive = Join-Path $root 'ubuntu-rootfs.tar.gz'
    $expected = '8251e27ffff381a4af5f41dcb94d867de3e0d9774a9241908ab34555d99315ea'
    if (-not (Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
        Invoke-WebRequest -UseBasicParsing -Uri 'https://cloud-images.ubuntu.com/wsl/releases/noble/current/ubuntu-noble-wsl-amd64-wsl.rootfs.tar.gz' -OutFile $archive
    }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Checksum Ubuntu không khớp. Dừng để kiểm tra bản nguồn.' }
    & wsl.exe --import LimixCloud (Join-Path $root 'wsl') $archive --version 2
    if ($LASTEXITCODE -ne 0) { throw 'Không nhập được WSL. Cần WSL 2 và ảo hóa hoạt động.' }
}
Write-Output 'Đang chuẩn bị Docker Engine riêng cho Cloud.'
& wsl.exe --distribution LimixCloud --user root --exec sh -lc 'apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 && service docker start && docker info >/dev/null'
if ($LASTEXITCODE -ne 0) { throw 'Cài Docker Engine trong WSL chưa thành công.' }
$image = $hostConfig.Image
if ($image -notmatch '^[A-Za-z0-9._/:@-]+$') { throw 'Tên image không hợp lệ.' }
Write-Output 'Đang sao lưu image Cloud. Không đóng bộ cài.'
$imageTar = Join-Path $backup 'cloud-image.tar'
& $docker image save --output $imageTar $image
if ($LASTEXITCODE -ne 0) { throw 'Không sao lưu được image Cloud.' }
& wsl.exe --distribution LimixCloud --user root --exec docker image load --input (WslPath $imageTar)
if ($LASTEXITCODE -ne 0) { throw 'Không tải được image vào Docker Engine mới.' }
$ids = @(& $docker ps -a --filter 'label=com.limix.managed-home=beta-xeon' --format '{{.ID}}')
$volumes = @()
foreach ($id in $ids) {
    $mounts = (& $docker inspect --format '{{json .Mounts}}' $id | ConvertFrom-Json)
    foreach ($mount in $mounts) {
        if ($mount.Type -eq 'volume' -and $mount.Name -match '^limix-home-[a-f0-9-]{36}_(cloud|data)$') { $volumes += $mount.Name }
    }
}
$volumes = @($volumes | Select-Object -Unique)
$stopped = @()
try {
    foreach ($name in @($ids) + @('limix-managed-tunnel','limix-managed-wake')) {
        $running = & $docker inspect --format '{{.State.Running}}' $name 2>$null
        if ($LASTEXITCODE -eq 0 -and $running -eq 'true') {
            & $docker stop $name | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Không dừng được container Cloud cũ.' }
            $stopped += $name
        }
    }
    foreach ($volume in $volumes) {
        Write-Output ('Đang sao lưu/chuyển volume: ' + $volume)
        & $docker run --rm --user 0 --entrypoint tar --mount "type=volume,source=$volume,target=/source,readonly" --mount "type=bind,source=$backup,target=/backup" $image -czf "/backup/$volume.tgz" -C /source .
        if ($LASTEXITCODE -ne 0) { throw 'Không sao lưu được volume Cloud.' }
        & wsl.exe --distribution LimixCloud --user root --exec docker volume create $volume | Out-Null
        & wsl.exe --distribution LimixCloud --user root --exec docker run --rm --user 0 --entrypoint sh --mount "type=volume,source=$volume,target=/target" $image -c 'test -z "$(ls -A /target)"'
        if ($LASTEXITCODE -ne 0) { throw 'Volume đích đã có dữ liệu. Không tự ghi đè; kiểm tra chuyển đổi.' }
        & wsl.exe --distribution LimixCloud --user root --exec docker run --rm --user 0 --entrypoint tar --mount "type=volume,source=$volume,target=/target" --mount ('type=bind,source=' + (WslPath $backup) + ',target=/backup,readonly') $image -xzf "/backup/$volume.tgz" -C /target
        if ($LASTEXITCODE -ne 0) { throw 'Khôi phục volume đích chưa thành công.' }
    }
    @{Node=$node;Backup=$backup;OriginalContainers=$stopped} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'server.json') -Encoding UTF8
    $stopFile = Join-Path $root 'stop'
    if (Test-Path -LiteralPath $stopFile) { Remove-Item -LiteralPath $stopFile }
} catch {
    foreach ($name in $stopped) { & $docker start $name 2>$null | Out-Null }
    throw
}
Enable-ScheduledTask -TaskName $taskName | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output 'Đã bật khởi động trước đăng nhập Windows. Dữ liệu Docker Desktop gốc và bản sao lưu được giữ.'
