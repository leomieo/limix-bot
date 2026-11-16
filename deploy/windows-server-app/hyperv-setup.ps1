$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::InputEncoding = [Text.Encoding]::UTF8
. (Join-Path $PSScriptRoot 'hyperv-common.ps1')
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
Assert-ServerResources $request
$root = Split-Path -Parent $PSScriptRoot
$metadataPath = Join-Path $root 'hyperv.json'
if (Test-Path -LiteralPath $metadataPath) { throw 'Đã có cấu hình Hyper-V. Dùng Xem trạng thái; không tự chuyển dữ liệu lần nữa.' }
if (Test-Path -LiteralPath (Join-Path $root 'server.json')) { throw 'Phát hiện bản WSL đã cài. Cần chuyển riêng từ WSL; không tự nhập nhầm bản Docker Desktop cũ.' }
Import-Module Hyper-V -ErrorAction Stop
if ((Get-Service vmms -ErrorAction Stop).Status -ne 'Running') { throw 'Dịch vụ Hyper-V chưa chạy. Kiểm tra tính năng Hyper-V trong Windows.' }
if (Get-VM -Name 'LimixCloudServer' -ErrorAction SilentlyContinue) { throw 'Đã có máy LimixCloudServer. Không ghi đè máy hoặc ổ đĩa hiện có.' }
$switch = Get-VMSwitch -Name $request.Switch -ErrorAction Stop
if ($switch.SwitchType -notin @('Internal','External')) { throw 'Switch cần kết nối mạng ra ngoài. Không dùng Private switch.' }
$hostMemory = [math]::Floor((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
if ($request.MemoryGb -gt ($hostMemory - 8)) { throw 'Cần giữ tối thiểu 8 GB RAM cho Windows và công việc khác.' }
$sourceConfig = Join-Path $env:LOCALAPPDATA 'LimixBot-Managed-Host\host.xml'
if (-not (Test-Path -LiteralPath $sourceConfig)) { throw 'Không tìm thấy cấu hình Cloud. Dùng tài khoản Windows đã chạy host trước đây.' }
$source = Import-Clixml -LiteralPath $sourceConfig
if ([int]$source.Capacity -notin 1..64) { throw 'Giới hạn host không hợp lệ.' }
$hostToken = [Net.NetworkCredential]::new('', $source.Token).Password
$image = [string]$source.Image
if ($hostToken -notmatch '^[A-Za-z0-9_-]{43,256}$' -or $image -notmatch '^[A-Za-z0-9._/:@-]+$') { throw 'Cấu hình host không hợp lệ.' }
if (@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '(managed-beta[\\/]host\.mjs|LimixBot-Server[\\/]app[\\/]host\.mjs)' }).Count) { throw 'Hãy dừng Cloud host cũ bằng Ctrl+C trước khi cài.' }
$oldTask = Get-ScheduledTask -TaskName 'Limix Cloud Server' -ErrorAction SilentlyContinue
if ($oldTask -and $oldTask.State -eq 'Running') { throw 'Tác vụ Cloud cũ đang chạy. Dừng nó trước khi chuyển.' }
$oldTaskEnabled = $oldTask -and $oldTask.Settings.Enabled
$docker = (Get-Command docker.exe -ErrorAction Stop).Source
if ((& $docker info --format '{{.OSType}}' 2>$null) -ne 'linux') { throw 'Mở Docker Desktop Linux để sao lưu dữ liệu Cloud hiện có.' }
$installId = [guid]::NewGuid().ToString()
$storageRoot = [IO.Path]::GetFullPath([string]$request.StorageRoot)
$store = Join-Path $storageRoot ('LimixCloudServer\' + $installId)
Protect-ServerDirectory $store
$transfer = Join-Path $store 'transfer'
$seed = Join-Path $store 'seed'
New-Item -ItemType Directory -Path $transfer,$seed -Force | Out-Null
$free = (Get-PSDrive -Name $store.Substring(0,1)).Free
if ($free -lt 25GB) { throw 'Cần ít nhất 25 GB trống để chuẩn bị; dữ liệu thực tế lớn có thể cần nhiều hơn.' }
Write-Output 'Đang tải Ubuntu và Node.js chính thức, kiểm tra SHA-256.'
$cloudImage = Join-Path $store 'ubuntu.img'
Get-VerifiedDownload 'https://cloud-images.ubuntu.com/noble/20261017/noble-server-cloudimg-amd64.img' $cloudImage '04e8f2461a16a44e78a370284471f29616cdd9baf1893df25807b71f985b6c94'
Get-VerifiedDownload 'https://nodejs.org/dist/v24.14.0/node-v24.14.0-linux-x64.tar.xz' (Join-Path $transfer 'node.tar.xz') '41cd79bb7877c81605a9e68ec4c91547774f46a40c67a17e34d7179ef11729df'
Write-Output 'Đang chuẩn bị công cụ tạo ổ đĩa. Chưa dừng các container Cloud.'
$tools = 'limix-server-image-tools:0.2'
& $docker build -f (Join-Path $PSScriptRoot 'image-tools.Dockerfile') -t $tools $PSScriptRoot
if ($LASTEXITCODE -ne 0) { throw 'Không build được công cụ tạo ổ đĩa.' }
& $docker image save --output (Join-Path $transfer 'cloud-image.tar') $image
if ($LASTEXITCODE -ne 0) { throw 'Không sao lưu được image Cloud.' }
& $docker run --rm --network none --mount "type=bind,source=$store,target=/work" $tools qemu-img convert -f qcow2 -O vhdx -o subformat=dynamic /work/ubuntu.img /work/system.vhdx
if ($LASTEXITCODE -ne 0) { throw 'Không chuyển được ổ đĩa Ubuntu.' }
Resize-VHD -Path (Join-Path $store 'system.vhdx') -SizeBytes ([int64]$request.DiskGb * 1GB)
$ids = @(& $docker ps -a --filter 'label=com.limix.managed-home=beta-xeon' --format '{{.ID}}')
if ($LASTEXITCODE -ne 0) { throw 'Không đọc được danh sách Cloud.' }
$volumes = @(); $homes = @()
foreach ($id in $ids) {
    $info = (& $docker inspect $id | ConvertFrom-Json)[0]
    if ($LASTEXITCODE -ne 0) { throw 'Không kiểm tra được container Cloud.' }
    if ($info.Name.TrimStart('/') -match '^limix-home-[a-f0-9-]{36}-home-1$') { $homes += $info.Name.TrimStart('/') }
    foreach ($mount in $info.Mounts) {
        if ($mount.Type -eq 'volume') {
            if ($mount.Name -notmatch '^limix-home-[a-f0-9-]{36}_(cloud|data)$') { throw 'Có volume Cloud chưa nhận diện được. Không bỏ qua dữ liệu.' }
            $volumes += $mount.Name
        } elseif ($mount.Type -eq 'bind') { throw 'Cloud đang gắn thư mục máy chủ. Cần kiểm tra trước khi chuyển.' }
    }
}
$volumes = @($volumes | Select-Object -Unique)
$bytes = [byte[]]::new(32); [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$healthKey = -join ($bytes | ForEach-Object { $_.ToString('x2') })
Write-Utf8 (Join-Path $seed 'user-data') (New-CloudInit $installId $healthKey $hostToken $source.Capacity $image $PSScriptRoot)
$hostToken = $null
Write-Utf8 (Join-Path $seed 'meta-data') ("instance-id: $installId`nlocal-hostname: limix-cloud-server`n")
$stopped = @(); $vmCreated = $false; $activationAttempted = $false
$config = [ordered]@{InstallId=$installId;HealthKey=$healthKey;Store=$store;VmName='LimixCloudServer';OriginalContainers=@();MigrationState='preparing'}
try {
    if ($oldTaskEnabled) { Disable-ScheduledTask -TaskName 'Limix Cloud Server' | Out-Null }
    Write-Output 'Đang dừng riêng Cloud để chụp dữ liệu nhất quán. CRM tiếp tục chạy.'
    foreach ($name in @($ids) + @('limix-managed-tunnel','limix-managed-wake')) {
        $running = & $docker inspect --format '{{.State.Running}}' $name 2>$null
        if ($LASTEXITCODE -eq 0 -and $running -eq 'true') {
            & $docker stop $name | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Không dừng được Cloud cũ.' }
            $stopped += $name
        }
    }
    foreach ($volume in $volumes) {
        Write-Output ('Đang sao lưu ' + $volume)
        & $docker run --rm --network none --user 0 --entrypoint tar --mount "type=volume,source=$volume,target=/source,readonly" --mount "type=bind,source=$transfer,target=/backup" $image -czf "/backup/$volume.tgz" -C /source .
        if ($LASTEXITCODE -ne 0) { throw 'Không sao lưu được volume; chưa chuyển sang Cloud mới.' }
    }
    Write-Utf8 (Join-Path $transfer 'transfer.json') (@{image=$image;volumes=@($volumes);homes=@($homes)} | ConvertTo-Json -Depth 4)
    $checksums = [ordered]@{}
    foreach ($file in Get-ChildItem -LiteralPath $transfer -File) { $checksums[$file.Name] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
    Write-Utf8 (Join-Path $transfer 'checksums.json') ($checksums | ConvertTo-Json)
    $total = (Get-ChildItem -LiteralPath $transfer -File | Measure-Object -Property Length -Sum).Sum
    $dataSize = [int64]([math]::Ceiling(($total * 1.25 + 1GB) / 1MB)) * 1MB
    if ((Get-PSDrive -Name $store.Substring(0,1)).Free -lt ($dataSize * 2 + 2GB)) { throw 'Không đủ dung lượng tạo ổ dữ liệu và bản sao lưu.' }
    Write-Output 'Đang tạo ổ dữ liệu Linux và đĩa cấu hình.'
    & $docker run --rm --network none --mount "type=bind,source=$store,target=/work" $tools truncate -s $dataSize /work/data.raw
    if ($LASTEXITCODE -ne 0) { throw 'Không tạo được ổ chuyển dữ liệu.' }
    & $docker run --rm --network none --mount "type=bind,source=$store,target=/work" $tools mkfs.ext4 -F -L LIMIXDATA -d /work/transfer /work/data.raw
    if ($LASTEXITCODE -ne 0) { throw 'Không ghi được dữ liệu vào ổ Linux.' }
    & $docker run --rm --network none --mount "type=bind,source=$store,target=/work" $tools qemu-img convert -f raw -O vhdx -o subformat=dynamic /work/data.raw /work/data.vhdx
    if ($LASTEXITCODE -ne 0) { throw 'Không tạo được ổ dữ liệu Hyper-V.' }
    & $docker run --rm --network none --mount "type=bind,source=$store,target=/work" $tools genisoimage -output /work/seed.iso -volid cidata -joliet -rock /work/seed
    if ($LASTEXITCODE -ne 0) { throw 'Không tạo được đĩa cấu hình.' }
    $vm = New-VM -Name 'LimixCloudServer' -Generation 2 -MemoryStartupBytes ([int64]$request.MemoryGb * 1GB) -VHDPath (Join-Path $store 'system.vhdx') -SwitchName $switch.Name -Path $store
    $vmCreated = $true
    Grant-ServerVmAccess $store $vm
    Set-VM -VM $vm -ProcessorCount $request.Cpu -AutomaticStartAction Start -AutomaticStartDelay 30 -AutomaticStopAction ShutDown -AutomaticCheckpointsEnabled $false -Notes ('LimixCloudServer:' + $installId)
    Set-VMFirmware -VM $vm -EnableSecureBoot On -SecureBootTemplate MicrosoftUEFICertificateAuthority
    Add-VMHardDiskDrive -VM $vm -Path (Join-Path $store 'data.vhdx')
    Add-VMDvdDrive -VM $vm -Path (Join-Path $store 'seed.iso')
    $config.OriginalContainers = @($stopped)
    Write-Utf8 $metadataPath ($config | ConvertTo-Json -Depth 5)
    Start-VM -VM $vm
    Write-Output 'Máy Linux đang cài Docker và nhập dữ liệu; có thể mất 10–30 phút. Không đóng bộ cài.'
    $deadline = (Get-Date).AddMinutes(30)
    $lastPhase = ''
    while ((Get-Date) -lt $deadline) {
        $health = Get-GuestHealth $config
        if ($health) {
            $phase = $health.Data.phase
            if ($phase -ne $lastPhase) { Write-Output (Get-GuestPhaseText $phase); $lastPhase=$phase }
            if ($phase -eq 'prepared') { break }
        }
        Start-Sleep -Seconds 10
    }
    if (-not $health -or $health.Data.phase -ne 'prepared') { throw 'Máy Linux chưa chuẩn bị xong. Chưa kích hoạt connector mới.' }
    $activationAttempted = $true
    $config.MigrationState = 'activation-attempted'
    Write-Utf8 $metadataPath ($config | ConvertTo-Json -Depth 5)
    Invoke-RestMethod -Method Post -Uri ("http://" + $health.Address + ':9876/activate') -Headers @{Authorization=('Bearer ' + $healthKey)} -TimeoutSec 25 | Out-Null
    $config.MigrationState = 'active'
    Write-Utf8 $metadataPath ($config | ConvertTo-Json -Depth 5)
    Write-Output 'Đã kích hoạt Cloud trên Hyper-V. Không chạy host Docker Desktop cũ nữa. Bấm Xem trạng thái để xác nhận từng máy Cloud.'
} catch {
    if (-not $activationAttempted) {
        if ($vmCreated) { Stop-VM -Name 'LimixCloudServer' -TurnOff -Force -ErrorAction SilentlyContinue; Set-VM -Name 'LimixCloudServer' -AutomaticStartAction Nothing -ErrorAction SilentlyContinue }
        foreach ($name in $stopped) { & $docker start $name 2>$null | Out-Null }
        if ($oldTaskEnabled) { Enable-ScheduledTask -TaskName 'Limix Cloud Server' | Out-Null }
        if ($vmCreated) { $config.MigrationState='rolled-back'; Write-Utf8 $metadataPath ($config | ConvertTo-Json -Depth 5) }
        Write-Output 'Đã thử mở lại các container gốc. Bản sao và máy chuẩn bị được giữ để kiểm tra; không ghi đè dữ liệu khi cài lại.'
    } else {
        Write-Output 'Đã gửi kích hoạt, cần kiểm tra trạng thái. Không tự bật host cũ để tránh bot chạy trùng.'
    }
    throw
}
