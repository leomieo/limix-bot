[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$OutputEncoding=[Text.UTF8Encoding]::new($false)
param([ValidateSet('Status','Start','Stop','Check','EnableHyperV','Logs')][string]$Action='Status')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
. (Join-Path $PSScriptRoot 'hyperv-common.ps1')
if ($Action -eq 'EnableHyperV') {
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -All -NoRestart | Out-Null
    Write-Output 'Đã yêu cầu bật Hyper-V. Nếu Windows yêu cầu, hãy khởi động lại rồi mở lại bộ cài. Chưa chuyển dữ liệu Cloud.'
    exit 0
}
Import-Module Hyper-V -ErrorAction Stop
if ($Action -eq 'Check') {
    Get-Service vmms | Select-Object Name,Status | Format-Table
    Get-VMSwitch | Select-Object Name,SwitchType | Format-Table
    Write-Output 'Cần switch có Internet. Default Switch thường có sẵn trên Windows Pro; không tự thay cấu hình card mạng.'
    exit 0
}
$root=Split-Path -Parent $PSScriptRoot
$path=Join-Path $root 'hyperv.json'
if (-not (Test-Path -LiteralPath $path)) { throw 'Chưa cài Cloud Server Hyper-V. Bấm Cài đặt trước; Bắt đầu không thay cho cài đặt.' }
$config=Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
if (-not (Test-Path -LiteralPath $config.Store -PathType Container)) {throw 'Không tìm thấy ổ hoặc thư mục dữ liệu Cloud. Kết nối lại ổ; không tạo máy mới hoặc ghi dữ liệu trống.'}
$vm=Get-ServerVm $config
if ($Action -eq 'Start') {
    if ($config.MigrationState -eq 'rolled-back') { throw 'Lần chuyển trước đã quay lại bản gốc. Không tự khởi động bản sao cũ; cần kiểm tra dữ liệu trước.' }
    Set-VM -VM $vm -AutomaticStartAction Start
    if ($vm.State -eq 'Off') { Start-VM -VM $vm }
    Write-Output 'Đã gửi yêu cầu bật máy Linux. Cloud sẵn sàng hay chưa cần kiểm tra trạng thái.'
} elseif ($Action -eq 'Stop') {
    Set-VM -VM $vm -AutomaticStartAction Nothing
    if ($vm.State -eq 'Running') { Stop-VM -VM $vm }
    Write-Output 'Đã yêu cầu tắt máy Linux và tắt tự khởi động. Không xóa dữ liệu.'
}
Write-Output ('Hyper-V: ' + (Get-ServerVm $config).State + '; Chuyển dữ liệu: ' + $config.MigrationState)
$health=Get-GuestHealth $config
if ($health) {
    Write-Output ((Get-GuestPhaseText $health.Data.phase) + '; Máy Cloud đạt kiểm tra: ' + $health.Data.healthyHomes + '/' + $health.Data.expectedHomes)
    if ($Action -eq 'Logs') {
        $answer = Invoke-RestMethod -Uri ('http://' + $health.Address + ':9876/logs') -Headers @{Authorization=('Bearer ' + $config.HealthKey)} -TimeoutSec 15
        Write-Output $answer.logs
    }
} else { Write-Output 'Chưa nhận được trạng thái Linux. Máy có thể đang khởi động/cài gói hoặc chưa có mạng.' }
