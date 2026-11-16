using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Security.Principal;
using System.Text;
using System.Text.Json;

namespace LimixServer;

static class Program
{
    public static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LimixBot-Server");
    [STAThread]
    static void Main(string[] args)
    {
        if (args.Contains("--verify"))
        {
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("LimixServer.payload.zip") ?? Assembly.GetExecutingAssembly().GetManifestResourceNames().Where(x => x.EndsWith("payload.zip")).Select(x => Assembly.GetExecutingAssembly().GetManifestResourceStream(x)).First()!;
            using var zip = new ZipArchive(stream);
            var required = new[] { "setup.ps1", "supervisor.ps1", "host.ps1", "host.mjs", "docker-backend.mjs", "compose.yaml" };
            if (required.Any(x => !zip.Entries.Any(e => e.FullName == x && e.Length > 0))) Environment.Exit(1);
            Console.WriteLine("Embedded server payload: PASS");
            return;
        }
        ApplicationConfiguration.Initialize();
        if (args.Length == 2 && args[0] == "--preview")
        {
            using var preview = new SetupWindow();
            preview.Show(); Application.DoEvents();
            using var bitmap = new Bitmap(preview.Width, preview.Height);
            preview.DrawToBitmap(bitmap, new Rectangle(0,0,preview.Width,preview.Height));
            bitmap.Save(args[1], System.Drawing.Imaging.ImageFormat.Png);
            preview.Close(); return;
        }
        Application.Run(new SetupWindow());
    }

    public static void Extract()
    {
        Directory.CreateDirectory(Root);
        var payload = Path.Combine(Root, "app");
        Directory.CreateDirectory(payload);
        var name = Assembly.GetExecutingAssembly().GetManifestResourceNames().Single(x => x.EndsWith("payload.zip"));
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)!;
        using var zip = new ZipArchive(stream);
        foreach (var entry in zip.Entries)
        {
            if (entry.FullName != Path.GetFileName(entry.FullName)) throw new InvalidDataException("Invalid payload path");
            entry.ExtractToFile(Path.Combine(payload, entry.FullName), true);
        }
    }
}

sealed class SetupWindow : Form
{
    readonly TextBox password = new() { UseSystemPasswordChar = true, Width = 520 };
    readonly TextBox output = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill, BackColor = Color.FromArgb(24, 24, 24), ForeColor = Color.White };
    readonly Button install = new() { Text = "Cài đặt và chuyển Cloud", AutoSize = true };
    readonly FlowLayoutPanel buttons = new() { Dock = DockStyle.Top, AutoSize = true };
    readonly CheckBox consent = new() { AutoSize = true, Text = "Tôi đã dừng Cloud host cũ; cho phép sao lưu và chuyển các container Cloud." };
    bool busy;
    public SetupWindow()
    {
        Text = "Limix Cloud Server · Thiết lập máy chủ";
        Size = new Size(900, 680); MinimumSize = new Size(800, 600); StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10); BackColor = Color.FromArgb(18,18,18); ForeColor = Color.White;
        var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, FlowDirection = FlowDirection.TopDown, Padding = new Padding(18), WrapContents = false };
        top.Controls.Add(new Label { Text = "Limix Cloud Server", Font = new Font("Segoe UI", 20, FontStyle.Bold), AutoSize = true });
        top.Controls.Add(new Label { MaximumSize = new Size(820,0), AutoSize = true, Text = "Chạy Cloud bằng Docker Engine trong WSL riêng, tự khởi động trước đăng nhập Windows. Cần Node.js, WSL 2, Docker Desktop và Cloud đã cấu hình. Máy Xeon cần luôn bật, có Internet và không Sleep." });
        top.Controls.Add(new Label { Text = "Tài khoản Windows: " + WindowsIdentity.GetCurrent().Name, AutoSize = true });
        top.Controls.Add(new Label { AutoSize = true, Text = "Mật khẩu Windows thật (không dùng mã PIN). Windows lưu cho tác vụ khởi động; không gửi lên Cloud." });
        top.Controls.Add(password); top.Controls.Add(consent);
        buttons.Controls.Add(install);
        AddButton("Bắt đầu", async () => await ControlTask(true));
        AddButton("Dừng", async () => await ControlTask(false));
        AddButton("Xem trạng thái", async () => await Run("$t=Get-ScheduledTask -TaskName 'Limix Cloud Server' -ErrorAction Stop; $i=Get-ScheduledTaskInfo -TaskName $t.TaskName; Write-Output ('Task: '+$t.State+'; Last result: '+$i.LastTaskResult); wsl.exe -d LimixCloud -u root --exec docker ps --format 'table {{.Names}}\t{{.Status}}'"));
        AddButton("Mở nhật ký", () => { var file=Path.Combine(Program.Root,"host.log"); if(File.Exists(file)) Process.Start(new ProcessStartInfo("notepad.exe") { ArgumentList={file},UseShellExecute=true }); return Task.CompletedTask; });
        top.Controls.Add(buttons);
        Controls.Add(output); Controls.Add(top);
        install.Click += async (_,_) => await Install();
        FormClosing += (_,e) => { if(busy) { e.Cancel=true; MessageBox.Show("Đang chuyển dữ liệu. Chờ hoàn tất trước khi đóng bộ cài."); } };
    }
    void AddButton(string text, Func<Task> action)
    {
        var button=new Button { Text=text,AutoSize=true };
        button.Click += async (_,_) => { try { await action(); } catch(Exception e) { Log(e.Message); } };
        buttons.Controls.Add(button);
    }
    void Log(string text) { if(IsDisposed)return; if(InvokeRequired) { BeginInvoke(()=>Log(text));return; } output.AppendText(text+Environment.NewLine); }
    async Task Install()
    {
        if(password.Text.Length==0 || !consent.Checked) { MessageBox.Show("Nhập mật khẩu Windows và xác nhận đã dừng host cũ.");return; }
        busy=true; buttons.Enabled=false;
        try
        {
            Program.Extract();
            var secret=JsonSerializer.Serialize(new { Password=password.Text }); password.Clear();
            var script=Path.Combine(Program.Root,"app","setup.ps1");
            var code=await Run(null,script,secret);
            secret="";
            if(code!=0) Log("Cài đặt chưa hoàn tất. Xem lỗi phía trên; dữ liệu gốc được giữ. Không bật host cũ nếu Cloud mới đã chạy.");
            else Log("Đã cài. Hãy kiểm tra Cloud, sau đó thử khởi động lại Xeon mà chưa đăng nhập Windows để xác minh.");
        }
        catch(Exception e) { Log(e.Message); }
        finally { busy=false;buttons.Enabled=true; }
    }
    async Task ControlTask(bool start)
    {
        if(busy)return;
        var stop=Path.Combine(Program.Root,"stop");
        if(start) { if(File.Exists(stop))File.Delete(stop); }
        else { Directory.CreateDirectory(Program.Root);File.WriteAllText(stop,""); }
        await Run(start ? "Enable-ScheduledTask -TaskName 'Limix Cloud Server' | Out-Null; Start-ScheduledTask -TaskName 'Limix Cloud Server'" : "Disable-ScheduledTask -TaskName 'Limix Cloud Server' | Out-Null; Stop-ScheduledTask -TaskName 'Limix Cloud Server'");
        if(start) Log("Đã yêu cầu chạy host. Xem trạng thái Cloud để xác nhận.");
        else Log("Đã dừng host và tắt tự khởi động. Container đang chạy chưa bị dừng.");
    }
    async Task<int> Run(string? command, string? file=null, string? input=null)
    {
        var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe")) { UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,RedirectStandardInput=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8 };
        info.ArgumentList.Add("-NoProfile");info.ArgumentList.Add("-ExecutionPolicy");info.ArgumentList.Add("Bypass");
        info.Environment["PSModulePath"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","Modules");
        if(file!=null) { info.ArgumentList.Add("-File");info.ArgumentList.Add(file); }
        else { info.ArgumentList.Add("-Command");info.ArgumentList.Add("[Console]::OutputEncoding=[Text.Encoding]::UTF8; $ErrorActionPreference='Stop'; "+command); }
        using var process=new Process { StartInfo=info };
        process.OutputDataReceived+=(_,e)=>{if(e.Data!=null)Log(e.Data);};
        process.ErrorDataReceived+=(_,e)=>{if(e.Data!=null)Log(e.Data);};
        process.Start();process.BeginOutputReadLine();process.BeginErrorReadLine();
        if(input!=null) await process.StandardInput.WriteAsync(input);
        process.StandardInput.Close();await process.WaitForExitAsync();return process.ExitCode;
    }
}
