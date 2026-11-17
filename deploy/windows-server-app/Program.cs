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
            using var preview = new SetupWindow(previewOnly:true);
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
    readonly NumericUpDown cpu = new() { Minimum=2,Value=4,Width=80 };
    readonly NumericUpDown memory = new() { Minimum=8,Value=12,Width=80 };
    readonly NumericUpDown resizeCpu = new() { Minimum=2, Value=4, Width=80 };
    readonly NumericUpDown resizeMemory = new() { Minimum=8, Value=12, Width=80 };
    readonly ServerButton applyResources = new() { Text="Lưu CPU và RAM", AutoSize=true, Enabled=false, Primary=true };
    readonly ServerButton maxResources = new() { Text="Dùng mức tối đa", AutoSize=true, Enabled=false };
    readonly ServerButton maxSetupResources = new() { Text="Dùng mức tối đa", AutoSize=true, Enabled=false };
    readonly ServerLabel resourceStatus = new() { AutoSize=true, MaximumSize=new Size(730,0) };
    readonly ServerLabel setupLimits = new() { AutoSize=true, MaximumSize=new Size(730,0) };
    readonly NumericUpDown disk = new() { Minimum=80,Maximum=512,Value=120,Width=75 };
    readonly TextBox network = new() { Text="Default Switch",Width=170 };
    readonly TextBox storage = new() { Width=600,ReadOnly=true };
    readonly TextBox output = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill, BackColor = Color.FromArgb(24, 24, 24), ForeColor = Color.White };
    readonly ServerButton install = new() { Text = "Cài đặt và chuyển Cloud", AutoSize = true, Primary = true };
    readonly Panel buttons = new() { Dock = DockStyle.Top, AutoSize = true };
    readonly CheckBox consent = new() { AutoSize = true, Text = "Tôi đã dừng Cloud host cũ; cho phép sao lưu và chuyển các container Cloud." };
    bool busy;
    internal void PreviewBusy() { buttons.Enabled=false; }
    readonly ServerLabel summary=new() {AutoSize=true,MaximumSize=new Size(740,0),Font=new Font("Segoe UI",12,FontStyle.Bold)};
    FlowLayoutPanel actionPage=null!;
    bool HasSetup => File.Exists(Path.Combine(Program.Root,"hyperv.json"));
    public SetupWindow(bool previewOnly=false)
    {
        Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Text="Limix Cloud Server 0.3.4 beta";
        Size=new Size(1120,860);MinimumSize=new Size(1000,760);StartPosition=FormStartPosition.CenterScreen;
        Font=new Font("Segoe UI",11);BackColor=ServerTheme.Window;ForeColor=Color.White;
        var header=new Panel {Dock=DockStyle.Top,Height=76,Padding=new Padding(24,18,22,8)};
        header.Controls.Add(new ServerLabel {Text="Limix Cloud Server",Dock=DockStyle.Top,Height=36,Font=new Font("Segoe UI",22,FontStyle.Bold)});
        var sidebar=new FlowLayoutPanel {Dock=DockStyle.Left,Width=210,FlowDirection=FlowDirection.TopDown,WrapContents=false,Padding=new Padding(12,16,8,12),BackColor=ServerTheme.Rail};
        buttons.Dock=DockStyle.Fill;buttons.AutoSize=false;
        var logPanel=new Panel {Dock=DockStyle.Bottom,Height=200,Padding=new Padding(24,12,24,16),BackColor=ServerTheme.Rail};
        logPanel.Controls.Add(output);
        logPanel.Controls.Add(new ServerLabel {Text="Nhật ký hoạt động",Dock=DockStyle.Top,Height=28});
        var pages=new List<FlowLayoutPanel>();
        var navigation=new List<ServerButton>();
        FlowLayoutPanel Page(string name,string title,string description) {
            var page=new FlowLayoutPanel {Dock=DockStyle.Fill,AutoScroll=true,FlowDirection=FlowDirection.TopDown,WrapContents=false,Padding=new Padding(24,18,24,12),Visible=false};
            page.Controls.Add(new ServerLabel {Text=title,AutoSize=true,Font=new Font("Segoe UI",18,FontStyle.Bold),Margin=new Padding(0,0,0,12)});
            page.Controls.Add(new ServerLabel {Text=description,AutoSize=true,MaximumSize=new Size(730,0),Margin=new Padding(0,0,0,16)});
            pages.Add(page);buttons.Controls.Add(page);
            var nav=new ServerButton {Text=name,Width=185,Height=44,Navigation=true,Selected=navigation.Count==0};
            nav.Click+=(_,_)=>{
                foreach(var item in pages)item.Visible=item==page;
                foreach(var item in navigation)item.Selected=item==nav;
                page.BringToFront();
            };
            navigation.Add(nav);
            sidebar.Controls.Add(nav);
            return page;
        }
        void Note(FlowLayoutPanel page,string text) => page.Controls.Add(new ServerLabel {Text=text,AutoSize=true,MaximumSize=new Size(730,0),Margin=new Padding(0,8,0,8)});
        var overview=Page("Tổng quan","Theo dõi máy chủ","Kiểm tra trạng thái trước khi thay đổi. Cài mới chỉ dùng khi chưa có máy Cloud; không cài lại để cập nhật ứng dụng.");
        summary.Text=HasSetup?"Đã có cấu hình Cloud. Bấm Làm mới để kiểm tra máy đang chạy hay đang tắt.":"Chưa có cấu hình Cloud trên tài khoản Windows này. Vào Cài đặt lần đầu để bắt đầu.";
        summary.Margin=new Padding(0,8,0,12);
        overview.Controls.Add(summary);
        actionPage=overview;
        AddButton("Làm mới trạng thái",async()=>await Control("Status"),primary:true);
        var powerActions=new FlowLayoutPanel {AutoSize=true,WrapContents=true,MaximumSize=new Size(730,0),Margin=new Padding(0,4,0,0)};
        overview.Controls.Add(powerActions);
        AddButton("Bật máy Cloud",async()=>await ControlTask(true),parent:powerActions);
        AddButton("Tắt máy Cloud",async()=>await ControlTask(false),parent:powerActions);
        AddButton("Xem nhật ký Linux",async()=>await Control("Logs"),parent:powerActions);
        Note(overview,"Tắt máy Cloud cũng tắt chế độ tự khởi động. Bấm Bật máy Cloud để bật lại cả hai.");
        var setup=Page("Cài đặt lần đầu","Chuẩn bị và cài server","Bước 1: kiểm tra Hyper-V và Docker Desktop. Bước 2: chọn tài nguyên và ổ lưu. Bước 3: cài đặt, rồi quay lại Tổng quan để xác nhận sẵn sàng.");
        actionPage=setup;
        AddButton("1 · Kiểm tra Hyper-V và mạng",async()=>await Control("Check"));
        AddButton("Bật tính năng Hyper-V nếu chưa có",async()=>{
            if(MessageBox.Show("Bật Hyper-V có thể cần khởi động lại Windows. Tiếp tục?","Limix Server",MessageBoxButtons.YesNo)==DialogResult.Yes)await Control("EnableHyperV");
        });
        var resources=new FlowLayoutPanel {AutoSize=true,WrapContents=true,MaximumSize=new Size(730,0)};
        foreach(var pair in new (string,Control)[]{("CPU",cpu),("RAM (GB)",memory),("Ổ máy Cloud (GB)",disk),("Switch mạng",network)}) {resources.Controls.Add(new ServerLabel {Text=pair.Item1,AutoSize=true,Margin=new Padding(0,6,8,0)});resources.Controls.Add(pair.Item2);}
        Note(setup,"2 · Tài nguyên dành cho máy Cloud");setup.Controls.Add(resources);
        setup.Controls.Add(setupLimits);
        setup.Controls.Add(maxSetupResources);
        maxSetupResources.Click+=(_,_)=>{ cpu.Value=cpu.Maximum; memory.Value=memory.Maximum; };
        Note(setup,"Thư mục lưu máy Cloud và bản sao lưu (chọn ổ còn đủ chỗ)");
        storage.Width=670;if(Directory.Exists(@"D:\DockerData"))storage.Text=@"D:\DockerData";setup.Controls.Add(storage);
        AddButton("Chọn thư mục lưu",()=>{using var picker=new FolderBrowserDialog {Description="Chọn ổ lưu dữ liệu Cloud"};if(picker.ShowDialog(this)==DialogResult.OK)storage.Text=picker.SelectedPath;return Task.CompletedTask;});
        consent.MaximumSize=new Size(730,0);consent.Text="Tôi đã dừng host Cloud cũ; cho phép sao lưu dữ liệu Cloud nếu có. Các dịch vụ Docker khác được giữ nguyên.";setup.Controls.Add(consent);
        install.Text="3 · Cài đặt server";install.Enabled=false;setup.Controls.Add(install);
        if(HasSetup)Note(setup,"Đã có cấu hình. Dùng Tổng quan để bật/tắt, Khắc phục để sửa, hoặc Dữ liệu để chuyển ổ. Không cài lại đè lên máy hiện có.");
        var compute=Page("CPU và RAM","Tài nguyên máy Cloud",
            "Đổi CPU và RAM của máy Cloud Hyper-V đã cài. Tắt máy Cloud trong Tổng quan trước khi lưu, rồi bật lại để áp dụng.");
        compute.Controls.Add(resourceStatus);
        actionPage=compute;
        AddButton("Đọc lại cấu hình", LoadResourceLimits);
        var resizeFields=new FlowLayoutPanel {AutoSize=true,WrapContents=false};
        resizeFields.Controls.Add(new ServerLabel {Text="vCPU",AutoSize=true});
        resizeFields.Controls.Add(resizeCpu);
        resizeFields.Controls.Add(new ServerLabel {Text="RAM (GB)",AutoSize=true});
        resizeFields.Controls.Add(resizeMemory);
        compute.Controls.Add(resizeFields);
        compute.Controls.Add(maxResources);
        maxResources.Click+=(_,_)=>{ resizeCpu.Value=resizeCpu.Maximum; resizeMemory.Value=resizeMemory.Maximum; };
        compute.Controls.Add(applyResources);
        applyResources.Click+=async(_,_)=>await ResizeResources();
        Note(compute,"Giới hạn RAM chừa lại 8 GB cho Windows. Nếu Windows hoặc Docker Desktop đang dùng nhiều RAM, hãy chọn mức thấp hơn. Số máy Cloud chạy cùng lúc là thiết lập riêng.");
        var startup=Page("Khởi động tự động","Chạy lại sau khi bật máy","Cloud Hyper-V tự khởi động cùng Windows khi đã bấm Bật máy Cloud. Bot điều khiển ứng dụng Windows và Docker Desktop cần phiên desktop đã đăng nhập.");
        actionPage=startup;
        AddButton("Windows và Limix Bot chạy nền",()=>{using var window=new WindowsStartupWindow();window.ShowDialog(this);return Task.CompletedTask;});
        AddButton("Các dịch vụ Docker Desktop",()=>{using var window=new DockerStartupWindow();window.ShowDialog(this);return Task.CompletedTask;});
        Note(startup,"Microsoft Autologon không hỗ trợ mật khẩu trống. Nếu giữ Windows không mật khẩu, cần bấm Sign in để mở desktop; Cloud Hyper-V không cần bước này. Sau khi cấu hình, thử reboot khi thuận tiện để xác nhận từng dịch vụ.");
        var data=Page("Dữ liệu","Lưu trữ và chuyển server","Chuyển ổ máy Cloud, xuất bản sao mã hóa hoặc nhập trên máy mới. Dừng máy Cloud trước khi thao tác; không di chuyển dữ liệu nội bộ Docker Desktop.");
        actionPage=data;AddButton("Mở quản lý dữ liệu",()=>{using var window=new ServerStorageWindow();window.ShowDialog(this);return Task.CompletedTask;});
        var repair=Page("Khắc phục","Sửa cấu hình dịch vụ","Chỉ dùng sửa chữa khi đã có máy Cloud nhưng dịch vụ lỗi. Giữ nguyên ổ dữ liệu, không khôi phục host cũ song song.");
        actionPage=repair;
        AddButton("Sửa máy Cloud đã cài",async()=>{
            if(MessageBox.Show("Dừng máy Cloud trước khi sửa. Công cụ giữ nguyên ổ dữ liệu. Tiếp tục?","Limix Server",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;
            busy=true;buttons.Enabled=false;
            try{Program.Extract();await Run(null,Path.Combine(Program.Root,"app","repair.ps1"));}finally{busy=false;buttons.Enabled=true;}
        });
        AddButton("Xem nhật ký chẩn đoán",async()=>await Control("Logs"));
        Controls.Add(buttons);Controls.Add(sidebar);Controls.Add(logPanel);Controls.Add(header);
        ServerTheme.Apply(this);overview.Visible=true;overview.BringToFront();
        install.Click+=async(_,_)=>await Install();
        if (!previewOnly) Shown+=async(_,_)=>await LoadResourceLimits();
        FormClosing+=(_,e)=>{if(busy){e.Cancel=true;MessageBox.Show("Đang xử lý. Chờ hoàn tất trước khi đóng.");}};
    }
    void AddButton(string text, Func<Task> action, bool primary=false, Control? parent=null)
    {
        var button=new ServerButton { Text=text,AutoSize=true,Primary=primary };
        button.Click += async (_,_) => { try { await action(); } catch(Exception e) { Log(e.Message); } };
        (parent ?? actionPage).Controls.Add(button);
    }
    void Log(string text) { if(IsDisposed)return; if(InvokeRequired) { BeginInvoke(()=>Log(text));return; } output.AppendText(text+Environment.NewLine);
        if(text.Contains("Hyper-V:")||text.Contains("Máy Cloud đạt")||text.StartsWith("Dịch vụ Cloud đang chạy")||text.Contains("Chưa nhận được")||text.Contains("Đã kích hoạt"))summary.Text=text; }
    async Task Install()
    {
        if(HasSetup) {MessageBox.Show("Đã có cấu hình. Dùng Tổng quan hoặc Khắc phục.");return;}
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
            else Log("Đã chuyển sang Hyper-V. Kiểm tra Cloud từ máy khác, rồi khởi động lại máy chủ và thử kết nối trước khi đăng nhập Windows.");
        }
        catch(Exception e) { Log(e.Message); }
        finally { busy=false;buttons.Enabled=true; }
    }
    async Task ControlTask(bool start)
    {
        if(busy)return;
        if(!start && MessageBox.Show("Tắt máy Linux sẽ ngắt Cloud và bot, đồng thời tắt tự khởi động. Tiếp tục?","Dừng Cloud",MessageBoxButtons.YesNo)!=DialogResult.Yes)return;
        await Control(start ? "Start" : "Stop");
        await LoadResourceLimits();
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
    async Task LoadResourceLimits()
    {
        if (busy) return;
        busy=true; buttons.Enabled=false;
        var response=new StringBuilder();
        install.Enabled=maxSetupResources.Enabled=applyResources.Enabled=maxResources.Enabled=false;
        setupLimits.Text=resourceStatus.Text="Đang đọc cấu hình máy chủ…";
        try {
            Program.Extract();
            var code=await Run(null,Path.Combine(Program.Root,"app","hyperv-control.ps1"),
                argument:"ResourceLimits", captureOutput:line=>response.AppendLine(line));
            if (code!=0) throw new InvalidOperationException("Không đọc được tài nguyên. Xem nhật ký rồi chọn Đọc lại cấu hình.");
            using var document=JsonDocument.Parse(response.ToString());
            var config=document.RootElement;
            int maxCpu=config.GetProperty("MaxCpu").GetInt32();
            int maxRam=config.GetProperty("MaxMemoryGb").GetInt32();
            if (maxCpu<2 || maxRam<8) throw new InvalidOperationException("Máy chủ cần ít nhất 2 luồng CPU và 16 GB RAM để cài Cloud.");
            setupLimits.Text=$"Tối đa {maxCpu} vCPU và {maxRam} GB RAM, chừa 8 GB cho Windows.";
            SetResourceRange(cpu,maxCpu,cpu.Value);
            SetResourceRange(memory,maxRam,memory.Value);
            install.Enabled=maxSetupResources.Enabled=!HasSetup;
            if (!config.TryGetProperty("VmState",out var state)) {
                resourceStatus.Text="Chưa có máy Cloud. Hãy chọn tài nguyên trong Cài đặt lần đầu.";
                return;
            }
            int configuredCpu=config.GetProperty("ConfiguredCpu").GetInt32();
            int configuredRam=config.GetProperty("ConfiguredMemoryGb").GetInt32();
            SetResourceRange(resizeCpu,maxCpu,configuredCpu);
            SetResourceRange(resizeMemory,maxRam,configuredRam);
            bool off=state.GetString()=="Off";
            resourceStatus.Text=$"Hiện tại: {configuredCpu} vCPU · {configuredRam} GB RAM. {setupLimits.Text}";
            if (!off) resourceStatus.Text+=" Tắt máy Cloud trước khi lưu.";
            applyResources.Enabled=maxResources.Enabled=off;
        }
        catch (Exception e) { setupLimits.Text=resourceStatus.Text=e.Message; }
        finally { busy=false; buttons.Enabled=true; }
    }

    static void SetResourceRange(NumericUpDown input, int maximum, decimal value)
    {
        input.Maximum=maximum;
        input.Value=Math.Clamp(value,input.Minimum,input.Maximum);
    }

    async Task ResizeResources()
    {
        if (busy || !HasSetup) return;
        busy=true; buttons.Enabled=false;
        try {
            Program.Extract();
            var request=JsonSerializer.Serialize(new { Cpu=(int)resizeCpu.Value, MemoryGb=(int)resizeMemory.Value });
            var code=await Run(null,Path.Combine(Program.Root,"app","hyperv-control.ps1"),request,"Resize");
            if (code!=0) Log("Chưa xác nhận cấu hình CPU và RAM mới. Xem lỗi phía trên.");
        }
        catch (Exception e) { Log(e.Message); }
        finally { busy=false; buttons.Enabled=true; }
        await LoadResourceLimits();
    }

    async Task<int> Run(string? command, string? file=null, string? input=null, string? argument=null, Action<string>? captureOutput=null)
    {
        var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe")) { UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,RedirectStandardInput=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8 };
        ProcessEncoding.Utf8(info);
        info.ArgumentList.Add("-NoProfile");info.ArgumentList.Add("-ExecutionPolicy");info.ArgumentList.Add("Bypass");
        info.Environment["PSModulePath"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","Modules");
        if(file!=null) { info.ArgumentList.Add("-File");info.ArgumentList.Add(file); if(argument!=null) { info.ArgumentList.Add("-Action");info.ArgumentList.Add(argument); } }
        else { info.ArgumentList.Add("-Command");info.ArgumentList.Add("[Console]::OutputEncoding=[Text.Encoding]::UTF8; $ErrorActionPreference='Stop'; "+command); }
        using var process=new Process { StartInfo=info };
        process.OutputDataReceived+=(_,e)=>{if(e.Data!=null){ if(captureOutput!=null)captureOutput(e.Data); else Log(e.Data); }};
        process.ErrorDataReceived+=(_,e)=>{if(e.Data!=null)Log(e.Data);};
        process.Start();process.BeginOutputReadLine();process.BeginErrorReadLine();
        if(input!=null) await process.StandardInput.WriteAsync(input);
        process.StandardInput.Close();await process.WaitForExitAsync();return process.ExitCode;
    }
}







