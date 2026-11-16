using System.Diagnostics;
using System.IO.Compression;
using System.Text.Json;
using System.Security.AccessControl;
using System.Security.Principal;

namespace LimixServer;

sealed class ServerStorageWindow : Form
{
    readonly TextBox destination=new() {Width=610,ReadOnly=true};
    readonly TextBox password=new() {Width=400,UseSystemPasswordChar=true};
    readonly TextBox network=new() {Width=220,Text="Default Switch"};
    readonly Label status=new() {AutoSize=true,MaximumSize=new Size(740,0)};
    readonly FlowLayoutPanel panel=new() {Dock=DockStyle.Fill,AutoScroll=true,FlowDirection=FlowDirection.TopDown,WrapContents=false,Padding=new Padding(20)};
    bool busy;
    public ServerStorageWindow()
    {
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Text="Limix Server · Lưu trữ và chuyển máy";Size=new Size(830,590);BackColor=Color.FromArgb(18,18,18);ForeColor=Color.White;Font=new Font("Segoe UI",10);StartPosition=FormStartPosition.CenterParent;Controls.Add(panel);
        Note("Dừng máy Cloud trước khi chuyển ổ hoặc xuất. Giữ server cũ tắt sau khi nhập trên máy mới để tránh hai máy cùng xử lý tài khoản. Công cụ này chỉ chuyển máy Cloud Hyper-V, không chuyển CRM hay container Docker Desktop khác.");
        Note("Thư mục đích trên ổ đĩa cục bộ (cần đủ chỗ cho toàn bộ máy Cloud và file tạm)");panel.Controls.Add(destination);
        Button("Chọn thư mục",()=>{using var pick=new FolderBrowserDialog();if(pick.ShowDialog(this)==DialogResult.OK)destination.Text=pick.SelectedPath;return Task.CompletedTask;});
        Note("Mật khẩu mã hóa gói chuyển máy (ít nhất 12 ký tự; phải ghi nhớ để nhập lại)");panel.Controls.Add(password);
        Note("Switch mạng trên máy mới");panel.Controls.Add(network);
        Button("Chuyển ổ máy Cloud",()=>Execute("Move"));
        Button("Xuất gói server mã hóa",()=>Execute("Export"));
        Button("Nhập gói server mã hóa",()=>Execute("Import"));
        panel.Controls.Add(status);ServerTheme.Apply(this);
        FormClosing+=(_,e)=>{if(busy)e.Cancel=true;};
    }
    void Note(string text)=>panel.Controls.Add(new Label {Text=text,AutoSize=true,MaximumSize=new Size(740,0),Margin=new Padding(0,5,0,8)});
    void Button(string text,Func<Task> action) {var button=new ServerButton {Text=text,AutoSize=true};button.Click+=async(_,_)=>{busy=true;panel.Enabled=false;try{await action();}catch{status.Text="Thao tác chưa hoàn tất. Kiểm tra mật khẩu, dung lượng và trạng thái Hyper-V. Dữ liệu nguồn không bị xóa.";}finally{busy=false;panel.Enabled=true;password.Clear();}};panel.Controls.Add(button);}
    async Task Execute(string action)
    {
        if(!Directory.Exists(destination.Text))throw new IOException();
        if(MessageBox.Show(this,"Xác nhận máy Cloud đã tắt. Khi chuyển server, giữ server cũ tắt cho tới khi quyết định quay lại bản cũ.","Limix Server",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;
        string? archive=null;
        if(action=="Export") {using var save=new SaveFileDialog {Filter="Limix Server (*.limixserver)|*.limixserver",InitialDirectory=destination.Text,FileName="LimixServer-"+DateTime.Now.ToString("yyyyMMdd")+".limixserver"};if(save.ShowDialog(this)!=DialogResult.OK)return;archive=save.FileName;}
        if(action=="Import") {using var open=new OpenFileDialog {Filter="Limix Server (*.limixserver)|*.limixserver"};if(open.ShowDialog(this)!=DialogResult.OK)return;archive=open.FileName;}
        if(action!="Move"&&password.Text.Length<12)throw new InvalidDataException();
        Program.Extract();
        var staging=Path.Combine(destination.Text,"LimixTransfer-"+Guid.NewGuid());
        Directory.CreateDirectory(staging);
        var acl=new DirectorySecurity();acl.SetAccessRuleProtection(true,false);
        foreach(var sid in new[]{WindowsIdentity.GetCurrent().User!,new SecurityIdentifier("S-1-5-18"),new SecurityIdentifier("S-1-5-32-544")})acl.AddAccessRule(new FileSystemAccessRule(sid,FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
        new DirectoryInfo(staging).SetAccessControl(acl);
        var secret=password.Text;
        var package=Path.Combine(staging,"package");var zip=Path.Combine(staging,"transfer.zip");
        try {
            if(action=="Import") {await Task.Run(()=>ServerArchive.Transform(archive!,zip,secret,false));await Task.Run(()=>ZipFile.ExtractToDirectory(zip,package));}
            else Directory.CreateDirectory(package);
            var input=JsonSerializer.Serialize(new {Action=action,Destination=action=="Export"?package:destination.Text,Package=package,Switch=network.Text.Trim()});
            status.Text="Đang xử lý, không đóng bộ cài. Máy Cloud sẽ được giữ tắt.";
            var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe")) {UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true};
            foreach(var arg in new[]{"-NoProfile","-ExecutionPolicy","Bypass","-File",Path.Combine(Program.Root,"app","server-storage.ps1")})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)!;var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();await process.StandardInput.WriteAsync(input);process.StandardInput.Close();await process.WaitForExitAsync();var text=await output;await error;
            if(process.ExitCode!=0)throw new InvalidOperationException();
            if(action=="Export") {await Task.Run(()=>ZipFile.CreateFromDirectory(package,zip,CompressionLevel.NoCompression,false));await Task.Run(()=>ServerArchive.Transform(zip,archive!,secret,true));}
            status.Text=text.Trim()+(action=="Export"?" Gói mã hóa: "+archive:"");
        } finally {
            // Delete only the unique temporary directory created by this invocation.
            if(Directory.Exists(staging))Directory.Delete(staging,true);
        }
    }
}
