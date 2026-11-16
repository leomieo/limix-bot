function Write-Utf8([string]$Path, [string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, [Text.UTF8Encoding]::new($false))
}
function Protect-ServerDirectory([string]$Path) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544')) {
        $identity = [Security.Principal.SecurityIdentifier]::new($sid)
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
function Get-VerifiedDownload([string]$Url, [string]$Destination, [string]$Sha256) {
    if (-not (Test-Path -LiteralPath $Destination) -or (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Sha256) {
        Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination
    }
    if ((Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Sha256) { throw 'Checksum nguồn tải không khớp. Không tiếp tục.' }
}
function Grant-ServerVmAccess([string]$Store, $Vm) {
    $account = [Security.Principal.NTAccount]::new('NT VIRTUAL MACHINE', $Vm.Id.ToString())
    $sid = $account.Translate([Security.Principal.SecurityIdentifier])
    $acl = Get-Acl -LiteralPath $Store
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    Set-Acl -LiteralPath $Store -AclObject $acl
}
function Assert-ServerResources($Request) {
    if ($Request.Cpu -notin 2..16 -or $Request.MemoryGb -notin 8..32 -or $Request.DiskGb -notin 80..512) { throw 'Cấu hình máy ảo nằm ngoài giới hạn cho phép.' }
    $path = [string]$Request.StorageRoot
    if ($path -notmatch '^[A-Za-z]:\\' -or $path.Contains(',') -or $path.Contains('"') -or -not (Test-Path -LiteralPath $path -PathType Container)) { throw 'Chọn thư mục lưu trên ổ đĩa cục bộ. Không dùng thư mục mạng hoặc đường dẫn chứa dấu phẩy.' }
    if ($path.StartsWith($env:WINDIR, [StringComparison]::OrdinalIgnoreCase)) { throw 'Không lưu máy Cloud trong thư mục Windows.' }
}
function Get-GuestPhaseText([string]$Phase) {
    $labels = @{booting='Đang khởi động Linux';packages='Đang cài thành phần hệ thống';verifying='Đang kiểm tra dữ liệu';image='Đang nhập image Cloud';volumes='Đang khôi phục dữ liệu bot';prepared='Đã chuẩn bị xong, chờ kích hoạt';starting='Đang khởi động Cloud';ready='Các máy Cloud được theo dõi đã đạt kiểm tra sức khỏe';'setup-error'='Chuẩn bị lỗi; dịch vụ sẽ thử lại, xem Nhật ký Linux'}
    if ($labels.ContainsKey($Phase)) { return $labels[$Phase] }
    return $Phase
}
function Get-ServerVm($Config) {
    $vm = Get-VM -Name 'LimixCloudServer' -ErrorAction SilentlyContinue
    if (-not $vm -or $vm.Notes -ne ('LimixCloudServer:' + $Config.InstallId)) { throw 'Chưa cài máy chủ Hyper-V phù hợp. Hãy bấm Cài đặt trước.' }
    return $vm
}
function Get-GuestHealth($Config) {
    $vm = Get-ServerVm $Config
    $ips = @((Get-VMNetworkAdapter -VM $vm).IPAddresses | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' -and $_ -notmatch '^127\.' })
    foreach ($adapter in @(Get-VMNetworkAdapter -VM $vm)) {
        $mac = $adapter.MacAddress -replace '(.{2})(?!$)', '$1-'
        $ips += @(Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.LinkLayerAddress -eq $mac } | Select-Object -ExpandProperty IPAddress)
    }
    $ips = @($ips | Select-Object -Unique)
    foreach ($ip in $ips) {
        try {
            $result = Invoke-RestMethod -Uri "http://${ip}:9876/healthz" -Headers @{Authorization=('Bearer ' + $Config.HealthKey)} -TimeoutSec 8
            if ($result.InstallId -eq $Config.InstallId) { return @{Address=$ip;Data=$result} }
        } catch { }
    }
    return $null
}
function New-CloudInit([string]$InstallId, [string]$Key, [string]$HostToken, [int]$Capacity, [string]$Image, [string]$Payload) {
    if ($HostToken -notmatch '^[A-Za-z0-9_-]{43,256}$' -or $Image -notmatch '^[A-Za-z0-9._/:@-]+$') { throw 'Cấu hình host không hợp lệ.' }
    $files = @{
        '/etc/limix-server/install-id' = $InstallId
        '/etc/limix-server/health-key' = $Key
        '/etc/limix-server/host.env' = "LIMIX_BETA_HOST_TOKEN=$HostToken`nLIMIX_BETA_CAPACITY=$Capacity`nLIMIX_HOME_IMAGE=$Image`nLIMIX_HOME_GATEWAY=1`n"
        '/opt/limix-server/host.mjs' = [IO.File]::ReadAllText((Join-Path $Payload 'host.mjs'))
        '/opt/limix-server/power-probe.mjs' = [IO.File]::ReadAllText((Join-Path $Payload 'power-probe.mjs'))
        '/opt/limix-server/updater.mjs' = [IO.File]::ReadAllText((Join-Path $Payload 'updater.mjs'))
        '/opt/limix-server/docker-backend.mjs' = [IO.File]::ReadAllText((Join-Path $Payload 'docker-backend.mjs'))
        '/opt/limix-server/compose.yaml' = [IO.File]::ReadAllText((Join-Path $Payload 'compose.yaml'))
        '/opt/limix-server/bootstrap.py' = [IO.File]::ReadAllText((Join-Path $Payload 'linux-bootstrap.py'))
        '/opt/limix-server/health.py' = [IO.File]::ReadAllText((Join-Path $Payload 'linux-health.py'))
        '/etc/sysctl.d/99-limix-recovery.conf' = "kernel.panic = 10`n"
        '/etc/systemd/system/limix-cloud-host.service' = @"
[Unit]
Description=Limix Cloud Host
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service
StartLimitIntervalSec=0
[Service]
Type=simple
WorkingDirectory=/opt/limix-server
EnvironmentFile=/etc/limix-server/host.env
ExecStart=/opt/limix-node/bin/node /opt/limix-server/host.mjs
Restart=always
RestartSec=30
UMask=0077
[Install]
WantedBy=multi-user.target
"@
        '/etc/systemd/system/limix-cloud-health.service' = @"
[Unit]
Description=Limix private guest readiness
After=network.target
StartLimitIntervalSec=0
[Service]
ExecStart=/usr/bin/python3 /opt/limix-server/health.py
Restart=always
RestartSec=10
UMask=0077
[Install]
WantedBy=multi-user.target
"@
        '/etc/systemd/system/limix-cloud-bootstrap.service' = @"
[Unit]
Description=Limix Cloud preparation
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /opt/limix-server/bootstrap.py
TimeoutStartSec=infinity
Restart=on-failure
RestartSec=30
UMask=0077
[Install]
WantedBy=multi-user.target
"@
    }
    $text = "#cloud-config`nssh_pwauth: false`ndisable_root: true`nwrite_files:`n"
    foreach ($entry in $files.GetEnumerator()) {
        $bytes = [Text.Encoding]::UTF8.GetBytes($entry.Value.Replace("`r`n","`n"))
        $mode = if ($entry.Key -like '/etc/limix-server/*') {'0600'} else {'0644'}
        $text += "  - path: $($entry.Key)`n    owner: root:root`n    permissions: '$mode'`n    encoding: b64`n    content: $([Convert]::ToBase64String($bytes))`n"
    }
    $text += "runcmd:`n  - [systemctl, daemon-reload]`n  - [systemctl, enable, --now, limix-cloud-health.service, limix-cloud-bootstrap.service]`n"
    return $text
}
