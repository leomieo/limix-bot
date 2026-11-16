using System.Diagnostics;
using System.Text.Json;
using Microsoft.Win32;

namespace LimixServer;

sealed class DockerStartupWindow : Form
{
    sealed record ServiceContainer(string Id,string Name,string Status);
    readonly CheckedListBox items=new() { Dock=DockStyle.Fill,CheckOnClick=true,BackColor=Color.FromArgb(28,28,28),ForeColor=Color.White,DisplayMember="Name" };
    readonly ServerLabel status=new() { AutoSize=true,MaximumSize=new Size(740,0) };
    readonly FlowLayoutPanel controls=new() { Dock=DockStyle.Top,AutoSize=true,FlowDirection=FlowDirection.TopDown,WrapContents=false,Padding=new Padding(18) };
    readonly ServerButton refresh=new() {Text="Quét container đang chạy",AutoSize=true};
    readonly ServerButton apply=new() {Text="Bật khởi động cùng Windows cho dịch vụ đã chọn",AutoSize=true};
    public DockerStartupWindow()
    {
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Text="Docker · Khởi động các dịch vụ cùng Windows";Size=new Size(850,580);MinimumSize=new Size(780,500);
        BackColor=Color.FromArgb(18,18,18);ForeColor=Color.White;Font=new Font("Segoe UI",10);StartPosition=FormStartPosition.CenterParent;
        controls.Controls.Add(new ServerLabel {AutoSize=true,MaximumSize=new Size(760,0),Text="Giữ các dịch vụ trên Docker Desktop hiện tại. Chọn container để đặt chính sách unless-stopped: Docker tự chạy lại sau reboot, nhưng giữ tắt dịch vụ bạn đã chủ động dừng. Không chuyển dữ liệu, không khởi động lại container lúc cấu hình. Nếu dùng Compose, cần giữ restart: unless-stopped trong cấu hình gốc để lần triển khai sau không ghi đè."});
        controls.Controls.Add(new ServerLabel {AutoSize=true,MaximumSize=new Size(760,0),Text="Docker Desktop chạy sau đăng nhập Windows. Cấu hình tự đăng nhập trong mục Limix Bot nền nếu cần phục hồi sau mất điện. Máy Cloud Hyper-V chạy riêng; không chuyển CRM hoặc dịch vụ khác vào máy đó."});
        controls.Controls.Add(refresh);controls.Controls.Add(apply);controls.Controls.Add(status);
        Controls.Add(items);Controls.Add(controls);
        refresh.Click+=async(_,_)=>await Work(Scan);
        apply.Click+=async(_,_)=>await Work(Apply);
    }
    async Task Work(Func<Task> action)
    {
        controls.Enabled=false;items.Enabled=false;
        try { await action(); } catch(Exception e) {status.Text=e.Message;}
        finally {controls.Enabled=true;items.Enabled=true;}
    }
    static async Task<string> Docker(params string[] args)
    {
        var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Docker","Docker","resources","bin","docker.exe")) {UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        ProcessEncoding.Utf8(info);
        foreach(var arg in args)info.ArgumentList.Add(arg);
        using var p=Process.Start(info) ?? throw new InvalidOperationException("Không mở được Docker.");
        var output=p.StandardOutput.ReadToEndAsync();var error=p.StandardError.ReadToEndAsync();
        using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(30));
        try {await p.WaitForExitAsync(timeout.Token);}catch(OperationCanceledException){p.Kill(true);throw new InvalidOperationException("Docker chưa phản hồi. Mở Docker Desktop và thử lại.");}
        var result=await output;await error;
        if(p.ExitCode!=0)throw new InvalidOperationException("Docker chưa sẵn sàng hoặc lệnh không thành công. Mở Docker Desktop và quét lại.");
        return result.Trim();
    }
    async Task Scan()
    {
        var lines=await Docker("ps","--no-trunc","--format","{{json .}}");items.Items.Clear();
        foreach(var line in lines.Split('\n',StringSplitOptions.RemoveEmptyEntries))
        {
            using var doc=JsonDocument.Parse(line);var row=doc.RootElement;
            items.Items.Add(new ServiceContainer(row.GetProperty("ID").GetString()!,row.GetProperty("Names").GetString()!,row.GetProperty("Status").GetString()!),false);
        }
        status.Text=$"Có {items.Items.Count} container đang chạy. Chỉ chọn dịch vụ cần tự khởi động.";
    }
    async Task Apply()
    {
        var selected=items.CheckedItems.Cast<ServiceContainer>().ToArray();
        if(selected.Length==0)throw new InvalidOperationException("Chọn ít nhất một container.");
        var desktop=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Docker","Docker","Docker Desktop.exe");
        if(!File.Exists(desktop))throw new InvalidOperationException("Không tìm thấy Docker Desktop đã cài.");
        var previous=new List<object>();
        foreach(var container in selected)
        {
            using var doc=JsonDocument.Parse(await Docker("inspect",container.Id));var info=doc.RootElement[0];
            if(!info.GetProperty("State").GetProperty("Running").GetBoolean())throw new InvalidOperationException("Danh sách đã thay đổi. Quét lại trước khi áp dụng.");
            var policy=info.GetProperty("HostConfig").GetProperty("RestartPolicy");
            previous.Add(new {container.Id,container.Name,Policy=policy.GetProperty("Name").GetString(),MaximumRetryCount=policy.GetProperty("MaximumRetryCount").GetInt32()});
        }
        Directory.CreateDirectory(Program.Root);
        var backup=Path.Combine(Program.Root,"docker-restart-policy-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff")+".json");
        File.WriteAllText(backup,JsonSerializer.Serialize(previous));
        var changed=0;
        try {
            foreach(var container in selected) {
                await Docker("update","--restart","unless-stopped",container.Id);
                using var verify=JsonDocument.Parse(await Docker("inspect",container.Id));
                if(verify.RootElement[0].GetProperty("HostConfig").GetProperty("RestartPolicy").GetProperty("Name").GetString()!="unless-stopped")throw new InvalidOperationException("Chưa xác nhận được chính sách khởi động.");
                changed++;
            }
            using var run=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
            run.SetValue("Limix Docker Desktop Startup","\""+desktop+"\"",RegistryValueKind.String);
            status.Text=$"Đã cấu hình và kiểm tra {changed} container; Docker Desktop tự mở sau đăng nhập. Cần thử reboot để xác nhận dịch vụ sẵn sàng. Chính sách cũ lưu tại: {backup}";
        } catch {throw new InvalidOperationException($"Đã áp dụng {changed}/{selected.Length} container. Các dịch vụ vẫn giữ trạng thái chạy. Quét lại và thử tiếp; chính sách cũ lưu tại {backup}");}
    }
}

