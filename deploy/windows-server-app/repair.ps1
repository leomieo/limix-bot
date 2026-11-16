$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'hyperv-common.ps1')
Import-Module Hyper-V -ErrorAction Stop
$root=Split-Path -Parent $PSScriptRoot
$configPath=Join-Path $root 'hyperv.json'
$config=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$vm=Get-ServerVm $config
if ($vm.State -ne 'Off') {throw 'Bấm Dừng, chờ máy Cloud tắt rồi bấm Sửa máy Cloud. Không dừng Docker Desktop.'}
if (-not (Test-Path -LiteralPath $config.Store)) {throw 'Không tìm thấy ổ dữ liệu Cloud. Kết nối lại ổ trước khi sửa.'}
$source=Import-Clixml -LiteralPath (Join-Path $env:LOCALAPPDATA 'LimixBot-Managed-Host\host.xml')
$token=[Net.NetworkCredential]::new('', $source.Token).Password
$repair=Join-Path $config.Store ('repair-'+[guid]::NewGuid())
Protect-ServerDirectory $repair
Write-Utf8 (Join-Path $repair 'user-data') (New-CloudInit $config.InstallId $config.HealthKey $token $source.Capacity $source.Image $PSScriptRoot)
Write-Utf8 (Join-Path $repair 'meta-data') ("instance-id: limix-repair-$([guid]::NewGuid())`nlocal-hostname: limix-cloud-server`n")
$iso=Join-Path $repair 'repair.iso'
$docker=(Get-Command docker.exe -ErrorAction Stop).Source
& $docker run --rm --network none --mount "type=bind,source=$repair,target=/work" limix-server-image-tools:0.2 genisoimage -output /work/repair.iso -volid cidata -joliet -rock /work/user-data /work/meta-data
if ($LASTEXITCODE -ne 0) {throw 'Chưa tạo được đĩa sửa chữa. Giữ máy Cloud tắt; kiểm tra Docker Desktop.'}
Get-VMDvdDrive -VM $vm | Set-VMDvdDrive -Path $iso
Grant-ServerVmAccess $repair $vm
Start-VM -VM $vm
Write-Output 'Đã khởi động máy với cấu hình dịch vụ mới. Giữ nguyên ổ dữ liệu. Chờ vài phút rồi bấm Xem trạng thái hoặc Nhật ký Linux. Chưa xác nhận Cloud đã hoạt động.'
