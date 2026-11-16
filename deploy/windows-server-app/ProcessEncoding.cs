using System.Diagnostics;
using System.Text;

namespace LimixServer;

static class ProcessEncoding
{
    public static void Utf8(ProcessStartInfo info)
    {
        if(info.RedirectStandardInput)info.StandardInputEncoding=new UTF8Encoding(false);
        if(info.RedirectStandardOutput)info.StandardOutputEncoding=new UTF8Encoding(false);
        if(info.RedirectStandardError)info.StandardErrorEncoding=new UTF8Encoding(false);
    }
    public static void Verify()
    {
        const string sentence="Đã chuyển ổ máy Cloud. Dữ liệu tiếng Việt: ă â ê ô ơ ư đ.";
        var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe")) {UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true};
        Utf8(info);
        info.ArgumentList.Add("-NoProfile");info.ArgumentList.Add("-Command");
        info.ArgumentList.Add("[Console]::InputEncoding=[Text.UTF8Encoding]::new($false); [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $s=[Console]::In.ReadToEnd(); [Console]::Out.Write($s); [Console]::Error.Write($s)");
        using var p=Process.Start(info)!;
        var stdout=p.StandardOutput.ReadToEndAsync();var stderr=p.StandardError.ReadToEndAsync();
        p.StandardInput.Write(sentence);p.StandardInput.Close();p.WaitForExit();
        if(p.ExitCode!=0||stdout.Result!=sentence||stderr.Result!=sentence)throw new InvalidDataException("UTF-8 process roundtrip failed");
        File.WriteAllText(Path.Combine(Program.Root,"encoding-check.txt"),"PASS UTF-8 stdin/stdout/stderr: "+sentence,Encoding.UTF8);
    }
}
