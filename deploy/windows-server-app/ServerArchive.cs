using System.Security.Cryptography;
using System.Text;

namespace LimixServer;

static class ServerArchive
{
    const int Chunk=1024*1024;
    static readonly byte[] Magic=Encoding.ASCII.GetBytes("LIMIXSV1");
    public static void Transform(string source,string destination,string password,bool encrypt)
    {
        if(password.Length<12)throw new InvalidDataException("Mật khẩu gói chuyển máy cần ít nhất 12 ký tự.");
        using var input=File.OpenRead(source);
        using var output=new FileStream(destination,FileMode.CreateNew,FileAccess.Write,FileShare.None);
        try {
            var salt=encrypt?RandomNumberGenerator.GetBytes(16):new byte[16];
            var prefix=encrypt?RandomNumberGenerator.GetBytes(8):new byte[8];
            if(encrypt) {output.Write(Magic);output.Write(salt);output.Write(prefix);}
            else {var magic=new byte[8];input.ReadExactly(magic);if(!magic.SequenceEqual(Magic))throw new InvalidDataException("Sai định dạng gói server.");input.ReadExactly(salt);input.ReadExactly(prefix);}
            var key=Rfc2898DeriveBytes.Pbkdf2(password,salt,600000,HashAlgorithmName.SHA256,32);
            try {
                using var aes=new AesGcm(key,16);using var writer=new BinaryWriter(output,Encoding.UTF8,true);using var reader=new BinaryReader(input,Encoding.UTF8,true);
                var bytes=new byte[Chunk];uint index=0;
                for(;;) {
                    if(index==uint.MaxValue)throw new InvalidDataException("Gói vượt giới hạn kích thước.");
                    var nonce=new byte[12];prefix.CopyTo(nonce,0);System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(nonce.AsSpan(8),index++);
                    int count;
                    if(encrypt) {count=input.ReadAtLeast(bytes,Chunk,false);writer.Write(count);}
                    else {count=reader.ReadInt32();if(count<0||count>Chunk)throw new InvalidDataException("Gói bị hỏng.");}
                    var aad=new byte[36];Magic.CopyTo(aad,0);salt.CopyTo(aad,8);nonce.CopyTo(aad,24);
                    var encrypted=new byte[count];var tag=new byte[16];
                    if(encrypt) {aes.Encrypt(nonce,bytes.AsSpan(0,count),encrypted,tag,aad);writer.Write(encrypted);writer.Write(tag);}
                    else {input.ReadExactly(encrypted);input.ReadExactly(tag);aes.Decrypt(nonce,encrypted,tag,bytes.AsSpan(0,count),aad);output.Write(bytes,0,count);}
                    if(count==0) {if(!encrypt&&input.Position!=input.Length)throw new InvalidDataException("Gói có dữ liệu dư.");break;}
                }
            } finally {CryptographicOperations.ZeroMemory(key);}
        } catch {output.Dispose();File.Delete(destination);throw;}
    }
}
