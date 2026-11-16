$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
. (Join-Path $PSScriptRoot 'hyperv-common.ps1')
$request=[Console]::In.ReadToEnd() | ConvertFrom-Json
$root=Split-Path -Parent $PSScriptRoot
$configPath=Join-Path $root 'hyperv.json'
Import-Module Hyper-V -ErrorAction Stop
$destination=[IO.Path]::GetFullPath([string]$request.Destination)
if ($destination -notmatch '^[A-Za-z]:\\' -or $destination.Contains(',') -or -not (Test-Path -LiteralPath $destination -PathType Container)) {throw 'Chọn thư mục trên ổ đĩa cục bộ đang kết nối.'}
if ($request.Action -eq 'Import') {
    if (Test-Path -LiteralPath $configPath) {throw 'Máy này đã có cấu hình Cloud. Không ghi đè.'}
    if (Get-VM -Name 'LimixCloudServer' -ErrorAction SilentlyContinue) {throw 'Máy Cloud đã tồn tại. Không ghi đè.'}
    $package=[IO.Path]::GetFullPath([string]$request.Package)
    $manifest=Get-Content -LiteralPath (Join-Path $package 'manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.Format -ne 1 -or [version]$manifest.Version -gt [version]'0.2.6') {throw 'Bản xuất mới hơn bộ cài này hoặc sai định dạng.'}
    $config=Get-Content -LiteralPath (Join-Path $package 'hyperv.json') -Raw | ConvertFrom-Json
    if ($config.InstallId -notmatch '^[a-f0-9-]{36}$') {throw 'Mã cài đặt không hợp lệ.'}
    $files=@(Get-ChildItem -LiteralPath $package -Recurse -Filter '*.vmcx')
    if ($files.Count -ne 1) {throw 'Gói chuyển máy phải chứa đúng một máy Hyper-V.'}
    $switch=Get-VMSwitch -Name $request.Switch -ErrorAction Stop
    if ($switch.SwitchType -notin @('Internal','External')) {throw 'Chọn switch có kết nối Internet.'}
    $target=Join-Path $destination ('LimixCloudServer\'+[guid]::NewGuid())
    Protect-ServerDirectory $target
    $report=Compare-VM -Path $files[0].FullName -Copy -GenerateNewId -VirtualMachinePath $target -VhdDestinationPath (Join-Path $target 'Disks') -SnapshotFilePath (Join-Path $target 'Snapshots') -SmartPagingFilePath $target
    foreach ($issue in $report.Incompatibilities) {
        if ($issue.MessageId -eq 33012) {$issue.Source | Disconnect-VMNetworkAdapter} else {throw 'Máy mới không tương thích với bản xuất Hyper-V. Cần kiểm tra phiên bản Windows/Hyper-V và tài nguyên.'}
    }
    $report=Compare-VM -CompatibilityReport $report
    if ($report.Incompatibilities.Count) {throw 'Chưa giải quyết được tương thích Hyper-V.'}
    $vm=Import-VM -CompatibilityReport $report
    # Keep imported guests off until the operator verifies the original host is stopped.
    Set-VM -VM $vm -AutomaticStartAction Nothing -Notes ('LimixCloudServer:'+$config.InstallId)
    if ($vm.Name -ne 'LimixCloudServer') {Rename-VM -VM $vm -NewName 'LimixCloudServer'}
    Get-VMNetworkAdapter -VM $vm | Connect-VMNetworkAdapter -SwitchName $switch.Name
    Grant-ServerVmAccess $target $vm
    $config.Store=$target
    $config.MigrationState='imported-off'
    $config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding UTF8
    Write-Output 'Đã nhập máy Cloud, đang tắt. Giữ server cũ tắt; kiểm tra mạng rồi bấm Bắt đầu.'
    exit
}
if (-not (Test-Path -LiteralPath $configPath)) {throw 'Chưa có máy Cloud Hyper-V để chuyển hoặc xuất.'}
$config=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$vm=Get-ServerVm $config
if ($vm.State -ne 'Off') {throw 'Bấm Dừng và chờ máy Cloud tắt hoàn toàn trước khi chuyển hoặc xuất.'}
if ($request.Action -eq 'Move') {
    $target=Join-Path $destination ('LimixCloudServer\'+[guid]::NewGuid())
    Protect-ServerDirectory $target
    Move-VMStorage -VM $vm -DestinationStoragePath $target
    Grant-ServerVmAccess $target $vm
    $config.Store=$target
    $config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding UTF8
    Write-Output 'Đã chuyển ổ máy Cloud bằng Hyper-V. Máy vẫn tắt; kiểm tra trạng thái rồi bấm Bắt đầu. Các bản sao lưu cũ được giữ tại vị trí cũ.'
} elseif ($request.Action -eq 'Export') {
    if (@(Get-ChildItem -LiteralPath $destination -Force).Count) {throw 'Thư mục xuất phải trống.'}
    Export-VM -VM $vm -Path $destination
    Copy-Item -LiteralPath $configPath -Destination (Join-Path $destination 'hyperv.json')
    @{Format=1;Version='0.2.6'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding UTF8
    Write-Output 'Đã xuất máy Cloud đang tắt. Server cũ tiếp tục được giữ tắt.'
} else {throw 'Thao tác lưu trữ không hợp lệ.'}
