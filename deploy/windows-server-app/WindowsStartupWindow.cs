using System.Diagnostics;
using System.Security.Principal;
using Microsoft.Win32;

namespace LimixServer;

sealed class WindowsStartupWindow : Form
{
    readonly TextBox executable = new() { Width=650, ReadOnly=true };
    readonly Label status = new() { AutoSize=true, MaximumSize=new Size(720,0) };
    readonly FlowLayoutPanel content = new() { Dock=DockStyle.Fill, FlowDirection=FlowDirection.TopDown, WrapContents=false, Padding=new Padding(20), AutoScroll=true };
    const string RunPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    const string Entry = "Limix Bot Server Desktop";
    public WindowsStartupWindow()
    {
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Text="Limix Bot · Tự đăng nhập và chạy nền";
        Size=new Size(800,500); MinimumSize=new Size(760,460);
        StartPosition=FormStartPosition.CenterParent;
        BackColor=Color.FromArgb(18,18,18); ForeColor=Color.White; Font=new Font("Segoe UI",10);
        Controls.Add(content);
        AddText("Chạy bot điều khiển ứng dụng Windows",18);
        AddText("1. Cấu hình tự đăng nhập bằng Microsoft Autologon. Dùng tài khoản Windows đang chạy bot; mật khẩu Windows khác mã PIN. Máy không có mật khẩu có thể để trống trong công cụ Microsoft.");
        AddButton("Mở Microsoft Autologon (bật / tắt)", async () => await OpenAutologon());
        AddText("2. Chọn Limix Bot đã cài rồi bật chạy nền sau đăng nhập.");
        content.Controls.Add(executable);
        AddButton("Chọn Limix Bot.exe", () => {
            using var picker=new OpenFileDialog { Filter="Limix Bot (*.exe)|*.exe", CheckFileExists=true };
            if(picker.ShowDialog(this)==DialogResult.OK) executable.Text=picker.FileName;
            return Task.CompletedTask;
        });
        AddButton("Bật Limix Bot chạy nền", () => {
            var path=Path.GetFullPath(executable.Text);
            if(!File.Exists(path)||!path.EndsWith(".exe",StringComparison.OrdinalIgnoreCase)||path.Contains('"')) throw new InvalidOperationException("Chọn tệp Limix Bot.exe đã cài.");
            using var key=Registry.CurrentUser.CreateSubKey(RunPath);
            key.SetValue(Entry, StartupCommand(path), RegistryValueKind.String);
            RefreshStatus(); return Task.CompletedTask;
        });
        AddButton("Tắt Limix Bot tự chạy", () => {
            using var key=Registry.CurrentUser.OpenSubKey(RunPath,true);
            key?.DeleteValue(Entry,false); RefreshStatus(); return Task.CompletedTask;
        });
        AddText("Tài khoản cấu hình: "+WindowsIdentity.GetCurrent().Name);
        AddText("Tự đăng nhập cho phép người có mặt tại máy truy cập desktop. Không Sleep, khóa hoặc đăng xuất nếu bot cần thao tác giao diện. Sau khi cài, thử khởi động lại và kiểm tra từ máy khác.");
        content.Controls.Add(status); ServerTheme.Apply(this); RefreshStatus();
    }
    internal static string StartupCommand(string path) => "\""+path+"\" --omb-hidden";
    void AddText(string value,int size=10) => content.Controls.Add(new Label { Text=value,AutoSize=true,MaximumSize=new Size(720,0),Font=new Font("Segoe UI",size),Margin=new Padding(0,8,0,8) });
    void AddButton(string text,Func<Task> action)
    {
        var button=new ServerButton { Text=text,AutoSize=true };
        button.Click+=async(_,_)=>{ button.Enabled=false;try { await action(); } catch { MessageBox.Show(this,"Chưa thực hiện được. Kiểm tra mạng, quyền quản trị và tệp ứng dụng đã chọn.","Limix Bot"); } finally { button.Enabled=true; } };
        content.Controls.Add(button);
    }
    void RefreshStatus()
    {
        using var run=Registry.CurrentUser.OpenSubKey(RunPath);
        using var winlogon=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon");
        status.Text="Limix Bot tự chạy: "+(run?.GetValue(Entry) is string ? "Đã bật" : "Chưa bật")+". Windows AutoAdminLogon: "+(winlogon?.GetValue("AutoAdminLogon") as string == "1" ? "Đã bật (cần thử reboot)" : "Chưa bật")+".";
    }
    async Task OpenAutologon()
    {
        var directory=Path.Combine(Program.Root,"MicrosoftAutologon"); Directory.CreateDirectory(directory);
        var path=Path.Combine(directory,"Autologon64.exe");
        // Windows must verify the downloaded executable before it receives credentials.
        using var client=new HttpClient { Timeout=TimeSpan.FromSeconds(90) };
        var bytes=await client.GetByteArrayAsync("https://live.sysinternals.com/Autologon64.exe");
        await File.WriteAllBytesAsync(path,bytes);
        var start=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe")) { UseShellExecute=false,CreateNoWindow=true };
        start.ArgumentList.Add("-NoProfile"); start.ArgumentList.Add("-Command");
        start.ArgumentList.Add("$s=Get-AuthenticodeSignature -LiteralPath $env:LIMIX_AUTOLOGON_EXE; if($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation,'){exit 1}");
        start.Environment["LIMIX_AUTOLOGON_EXE"]=path;
        using(var verify=Process.Start(start)!) { await verify.WaitForExitAsync(); if(verify.ExitCode!=0) throw new InvalidDataException("Microsoft signature verification failed"); }
        using var tool=Process.Start(new ProcessStartInfo(path) { UseShellExecute=true });
        if(tool!=null) await tool.WaitForExitAsync();
        RefreshStatus();
    }
}

