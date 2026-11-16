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
            var required = new[] { "server-storage.ps1", "hyperv-setup.ps1", "hyperv-common.ps1", "hyperv-control.ps1", "linux-bootstrap.py", "linux-health.py", "image-tools.Dockerfile", "host.mjs", "power-probe.mjs", "updater.mjs", "docker-backend.mjs", "compose.yaml" };
            if (required.Any(x => !zip.Entries.Any(e => e.FullName == x && e.Length > 0))) Environment.Exit(1);
            Console.WriteLine("Embedded server payload: PASS");
            return;
        }
        if(args.Contains("--verify-encoding")) { Directory.CreateDirectory(Root);ProcessEncoding.Verify();return; }
        ApplicationConfiguration.Initialize();
        if(args.Length==2 && args[0]=="--preview-storage-busy") {
            using var preview=new ServerStorageWindow();preview.PreviewBusy();preview.Show();Application.DoEvents();
            using var bitmap=new Bitmap(preview.Width,preview.Height);preview.DrawToBitmap(bitmap,new Rectangle(0,0,preview.Width,preview.Height));bitmap.Save(args[1]);return;
        }
        if (args.Length == 2 && args[0] == "--preview-startup")
        {
            using var preview = new WindowsStartupWindow();
            preview.Show(); Application.DoEvents();
            using var bitmap = new Bitmap(preview.Width, preview.Height);
            preview.DrawToBitmap(bitmap, new Rectangle(0,0,preview.Width,preview.Height));
            bitmap.Save(args[1], System.Drawing.Imaging.ImageFormat.Png);
            return;
        }
        if (args.Length == 2 && (args[0] == "--preview" || args[0] == "--preview-disabled"))
        {
            using var preview = new SetupWindow();
            if(args[0] == "--preview-disabled") preview.PreviewBusy();
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
    readonly NumericUpDown cpu = new() { Minimum=2,Maximum=16,Value=4,Width=65 };
    readonly NumericUpDown memory = new() { Minimum=8,Maximum=32,Value=12,Width=65 };
    readonly NumericUpDown disk = new() { Minimum=80,Maximum=512,Value=120,Width=75 };
    readonly TextBox network = new() { Text="Default Switch",Width=170 };
    readonly TextBox storage = new() { Width=600,ReadOnly=true };
    readonly TextBox output = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill, BackColor = Color.FromArgb(24, 24, 24), ForeColor = Color.White };
    readonly ServerButton install = new() { Text = "Cài đặt và chuyển Cloud", AutoSize = true };
    readonly FlowLayoutPanel buttons = new() { Dock = DockStyle.Top, AutoSize = true };
    readonly CheckBox consent = new() { AutoSize = true, Text = "Tôi đã dừng Cloud host cũ; cho phép sao lưu và chuyển các container Cloud." };
    bool busy;
    internal void PreviewBusy() { buttons.Enabled=false; }
    public SetupWindow()
    {
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Text = "Limix Cloud Server 0.2.13 beta · Hyper-V";
        Size = new Size(1000, 760); MinimumSize = new Size(930, 700); StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10); BackColor = Color.FromArgb(18,18,18); ForeColor = Color.White;
        var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, FlowDirection = FlowDirection.TopDown, Padding = new Padding(18), WrapContents = false };
        top.Controls.Add(new ServerLabel { Text = "Limix Cloud Server · Hyper-V", Font = new Font("Segoe UI", 20, FontStyle.Bold), AutoSize = true });
        top.Controls.Add(new ServerLabel { MaximumSize = new Size(820,0), AutoSize = true, Text = "Chạy Cloud trong máy Linux Hyper-V riêng, tự khởi động cùng Windows, không cần bấm Sign in hoặc có mật khẩu Windows. Cần Windows Pro/Enterprise, Hyper-V và Cloud Docker Desktop đã cấu hình. Máy Xeon phải bật và không Sleep." });
        top.Controls.Add(new ServerLabel { Text = "Tài khoản Windows: " + WindowsIdentity.GetCurrent().Name, AutoSize = true });
        var resources = new FlowLayoutPanel { AutoSize=true,WrapContents=false };
        resources.Controls.Add(new ServerLabel { Text="CPU",AutoSize=true });resources.Controls.Add(cpu);
        resources.Controls.Add(new ServerLabel { Text="RAM (GB)",AutoSize=true });resources.Controls.Add(memory);
        resources.Controls.Add(new ServerLabel { Text="Ổ đĩa (GB)",AutoSize=true });resources.Controls.Add(disk);
        resources.Controls.Add(new ServerLabel { Text="Switch mạng",AutoSize=true });resources.Controls.Add(network);
        top.Controls.Add(resources);
        top.Controls.Add(new ServerLabel {Text="Nơi lưu bản sao lưu và máy Cloud (chọn ổ còn đủ chỗ)",AutoSize=true});
        var storageRow=new FlowLayoutPanel {AutoSize=true,WrapContents=false};
        if(Directory.Exists(@"D:\DockerData")) storage.Text=@"D:\DockerData";
        storageRow.Controls.Add(storage);
        var chooseStorage=new ServerButton {Text="Chọn thư mục",AutoSize=true};
        chooseStorage.Click+=(_,_)=>{
            using var picker=new FolderBrowserDialog {Description="Chọn thư mục trên ổ đã dùng cho dữ liệu Docker; bộ cài tạo thư mục riêng LimixCloudServer."};
            if(picker.ShowDialog(this)==DialogResult.OK)storage.Text=picker.SelectedPath;
        };
        storageRow.Controls.Add(chooseStorage);top.Controls.Add(storageRow);
        top.Controls.Add(new ServerLabel { Text="Chỉ chuyển Cloud; giữ CRM và dữ liệu gốc. Cần nhiều dung lượng trống cho bản sao lưu.",AutoSize=true });
        top.Controls.Add(consent);
        buttons.Controls.Add(install);
        AddButton("Bắt đầu", async () => await ControlTask(true));
        AddButton("Dừng", async () => await ControlTask(false));
        AddButton("Xem trạng thái", async () => await Control("Status"));
        AddButton("Nhật ký Linux", async () => await Control("Logs"));
        AddButton("Kiểm tra Hyper-V", async () => await Control("Check"));
        AddButton("Bật Hyper-V", async () => {
            if(MessageBox.Show("Bật tính năng Hyper-V có thể cần khởi động lại Windows. Bộ cài không tự reboot. Tiếp tục?","Hyper-V",MessageBoxButtons.YesNo)==DialogResult.Yes) await Control("EnableHyperV");
        });
        AddButton("Tự đăng nhập / Limix Bot nền", () => {
            using var window = new WindowsStartupWindow();
            window.ShowDialog(this);
            return Task.CompletedTask;
        });
        AddButton("Docker / Dịch vụ khác tự khởi động", () => {
            using var window = new DockerStartupWindow();
            window.ShowDialog(this);
            return Task.CompletedTask;
        });
        AddButton("Đổi ổ / Chuyển server", () => {
            using var window = new ServerStorageWindow();
            window.ShowDialog(this);
            return Task.CompletedTask;
        });
        AddButton("Sửa máy Cloud đã cài", async () => {
            if(MessageBox.Show("Dừng máy Cloud trước khi sửa. Công cụ cập nhật dịch vụ bên trong Linux, giữ nguyên ổ dữ liệu. Tiếp tục?","Limix Server",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;
            busy=true;buttons.Enabled=false;
            try { Program.Extract();await Run(null,Path.Combine(Program.Root,"app","repair.ps1")); }
            finally {busy=false;buttons.Enabled=true;}
        });
        top.Controls.Add(buttons);
        Controls.Add(output); Controls.Add(top);
        ServerTheme.Apply(this);
        install.Click += async (_,_) => await Install();
        FormClosing += (_,e) => { if(busy) { e.Cancel=true; MessageBox.Show("Đang chuyển dữ liệu. Chờ hoàn tất trước khi đóng bộ cài."); } };
    }
    void AddButton(string text, Func<Task> action)
    {
        var button=new ServerButton { Text=text,AutoSize=true };
        button.Click += async (_,_) => { try { await action(); } catch(Exception e) { Log(e.Message); } };
        buttons.Controls.Add(button);
    }
    void Log(string text) { if(IsDisposed)return; if(InvokeRequired) { BeginInvoke(()=>Log(text));return; } output.AppendText(text+Environment.NewLine); }
    async Task Install()
    {
        if(!consent.Checked) { MessageBox.Show("Xác nhận đã dừng Cloud host cũ. Giữ Docker Desktop đang mở để sao lưu.");return; }
        if(string.IsNullOrWhiteSpace(storage.Text)) { MessageBox.Show("Chọn nơi lưu bản sao lưu và máy Cloud trước khi cài. Nên chọn ổ đang lưu dữ liệu Docker.");return; }
        busy=true; buttons.Enabled=false;
        try
        {
            Program.Extract();
            var settings=JsonSerializer.Serialize(new { Cpu=(int)cpu.Value,MemoryGb=(int)memory.Value,DiskGb=(int)disk.Value,Switch=network.Text.Trim(),StorageRoot=storage.Text.Trim() });
            var script=Path.Combine(Program.Root,"app","hyperv-setup.ps1");
            var code=await Run(null,script,settings);
            if(code!=0) Log("Cài đặt chưa hoàn tất. Xem lỗi phía trên; dữ liệu gốc được giữ. Không bật host cũ nếu Cloud mới đã chạy.");
            else Log("Đã chuyển sang Hyper-V. Kiểm tra Cloud trên máy khác, rồi thử reboot Xeon khi chưa đăng nhập Windows.");
        }
        catch(Exception e) { Log(e.Message); }
        finally { busy=false;buttons.Enabled=true; }
    }
    async Task ControlTask(bool start)
    {
        if(busy)return;
        if(!start && MessageBox.Show("Tắt máy Linux sẽ ngắt Cloud và bot, đồng thời tắt tự khởi động. Tiếp tục?","Dừng Cloud",MessageBoxButtons.YesNo)!=DialogResult.Yes)return;
        await Control(start ? "Start" : "Stop");
    }
    async Task Control(string action)
    {
        if(busy)return;
        busy=true;buttons.Enabled=false;
        try {
            Program.Extract();
            var code=await Run(null,Path.Combine(Program.Root,"app","hyperv-control.ps1"),null,action);
            if(code!=0)Log("Lệnh chưa thành công. Xem thông báo phía trên; chưa xác nhận Cloud đã chạy.");
        } finally { busy=false;buttons.Enabled=true; }
    }
    async Task<int> Run(string? command, string? file=null, string? input=null, string? argument=null)
    {
        var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe")) { UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,RedirectStandardInput=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8 };
        ProcessEncoding.Utf8(info);
        info.ArgumentList.Add("-NoProfile");info.ArgumentList.Add("-ExecutionPolicy");info.ArgumentList.Add("Bypass");
        info.Environment["PSModulePath"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","Modules");
        if(file!=null) { info.ArgumentList.Add("-File");info.ArgumentList.Add(file); if(argument!=null) { info.ArgumentList.Add("-Action");info.ArgumentList.Add(argument); } }
        else { info.ArgumentList.Add("-Command");info.ArgumentList.Add("[Console]::OutputEncoding=[Text.Encoding]::UTF8; $ErrorActionPreference='Stop'; "+command); }
        using var process=new Process { StartInfo=info };
        process.OutputDataReceived+=(_,e)=>{if(e.Data!=null)Log(e.Data);};
        process.ErrorDataReceived+=(_,e)=>{if(e.Data!=null)Log(e.Data);};
        process.Start();process.BeginOutputReadLine();process.BeginErrorReadLine();
        if(input!=null) await process.StandardInput.WriteAsync(input);
        process.StandardInput.Close();await process.WaitForExitAsync();return process.ExitCode;
    }
}






