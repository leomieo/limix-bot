[English](#english) · [Tiếng Việt](#tieng-viet)

<a id="english"></a>

# Limix Bot Security Policy

Limix Bot welcomes responsible reports of vulnerabilities affecting the application, server and user data. Report privately so the project can investigate and address issues before information can be misused.

## Reporting a vulnerability

Email **[tqtuan@limixmedia.com](mailto:tqtuan@limixmedia.com)** with the subject **[Limix Bot — Security Report]**.

**Do not open a public Issue or Pull Request containing exploit details, credentials or user data.** Use [Issues](https://github.com/leomieo/limix-bot/issues) for ordinary bugs and the [Code of Conduct](CODE_OF_CONDUCT.md) for community incidents.

## What to include

- Limix Bot version, operating system and deployment type: desktop or a server you manage.
- Affected component and the conditions required to reproduce the issue.
- Minimal reproduction steps in a test environment you control.
- Expected and actual results, and the potential impact.
- Redacted evidence, such as screenshots, short logs or a minimal proof of concept.
- A way to contact you; if you want public acknowledgment, explicitly state your preference and display name.

Do not send passwords, recovery codes, tokens, API keys, session cookies or a complete real user profile. Use synthetic data or the minimum sanitized information required. Revoke or rotate any secrets accidentally exposed through the relevant service.

## Areas of concern

Examples include:

- Bypassing authentication, authorization or bot/tool permissions.
- Unauthorized access across accounts, sessions, bots or data boundaries.
- Exposure of credentials, secrets or private data through the UI, APIs, logs or exports.
- Unauthorized command/code execution or file access outside the permitted scope.
- Problems in device pairing, remote connections, software updates or package verification.
- Failures in account binding, version checks or restoration for Offline computer transfer.
- Untrusted content causing a reproducible breach of an enforced protection boundary. Identify the permission bypassed and the actual action, rather than submitting only model-generated text.

For external AI services and platforms, distinguish a Limix Bot integration issue from a problem in that service. Report vulnerabilities entirely within a third-party service to its operator.

## Versions and verification

When possible, reproduce on the latest stable version from [Releases](https://github.com/leomieo/limix-bot/releases). If an issue occurs only in an older version, include that version and its reproduction steps.

Accepting a report does not mean every older version is supported or will receive a separate patch. The scope and remedy depend on verification, impact and compatibility.

## Responsible testing

- Test only devices, accounts and environments you own or are explicitly authorized to test.
- Use disposable profiles, synthetic data and the minimum required privileges.
- Do not access, copy, change, delete or publish another person's data.
- Do not disrupt services, send high traffic, guess passwords or automatically scan running infrastructure without permission.
- If you encounter data you are not authorized to access, stop and report it; do not expand access to gather more evidence.

This policy does not authorize testing third-party systems or access beyond existing permission.

## Handling and disclosure

The project reviews reports, may request further evidence, and discusses mitigation or fixes. Response and remediation depend on severity and reproducibility; no fixed response or resolution deadline is currently promised.

Coordinate disclosure timing so users have an opportunity to apply protections. Avoid disclosing personal data, secrets or details unnecessary for defense.

Report information should be shared only as necessary for investigation and resolution. Public acknowledgment requires the reporter's agreement. The project currently announces no bug bounty program or payment commitment.

## Protecting your installation

Download through official Limix Bot channels, apply security updates and grant bot permissions or install skills only from sources you trust. Review and remove sensitive information before sharing screenshots, logs or backups for support.

---

[English](#english) · [Tiếng Việt](#tieng-viet)

<a id="tieng-viet"></a>

# Chính sách bảo mật Limix Bot

Limix Bot tiếp nhận các báo cáo có trách nhiệm về lỗ hổng ảnh hưởng đến ứng dụng, máy chủ và dữ liệu người dùng. Vui lòng báo cáo riêng để dự án có thể xác minh và khắc phục trước khi thông tin có thể bị lợi dụng.

## Báo cáo lỗ hổng

Gửi email tới **[tqtuan@limixmedia.com](mailto:tqtuan@limixmedia.com)** với tiêu đề **[Limix Bot — Security Report]**.

**Không mở Issue hoặc Pull Request công khai chứa chi tiết khai thác, thông tin đăng nhập hay dữ liệu người dùng.** Báo lỗi chức năng thông thường tại [Issues](https://github.com/leomieo/limix-bot/issues); báo cáo hành vi cộng đồng theo [Quy tắc ứng xử](CODE_OF_CONDUCT.md).

## Thông tin cần cung cấp

- Phiên bản Limix Bot, hệ điều hành và kiểu triển khai: desktop hoặc máy chủ riêng.
- Thành phần bị ảnh hưởng và điều kiện cần thiết để lỗi xảy ra.
- Các bước tái hiện tối thiểu trong môi trường thử nghiệm do bạn kiểm soát.
- Kết quả mong đợi, kết quả thực tế và tác động có thể xảy ra.
- Bằng chứng đã che thông tin nhạy cảm, chẳng hạn ảnh chụp, nhật ký ngắn hoặc mã minh họa tối thiểu.
- Cách liên hệ để trao đổi thêm; nếu muốn được ghi nhận công khai, hãy nêu rõ mong muốn và tên hiển thị.

Không gửi mật khẩu, mã khôi phục, token, khóa API, cookie phiên đăng nhập hoặc toàn bộ hồ sơ dữ liệu thật. Chỉ gửi dữ liệu giả hoặc phần thông tin cần thiết đã được làm sạch. Nếu đã vô tình lộ bí mật, hãy thu hồi hoặc thay mới bí mật đó qua dịch vụ liên quan.

## Phạm vi quan tâm

Các vấn đề cần báo cáo gồm, nhưng không giới hạn ở:

- Vượt qua đăng nhập, phân quyền hoặc giới hạn quyền của bot và công cụ.
- Truy cập chéo tài khoản, phiên làm việc, bot hoặc dữ liệu không được cấp phép.
- Lộ thông tin đăng nhập, bí mật hoặc dữ liệu riêng tư qua giao diện, API, nhật ký hay file xuất.
- Thực thi lệnh hoặc mã trái phép, truy cập tệp ngoài phạm vi được cho phép.
- Sai sót trong ghép cặp thiết bị, kết nối từ xa, cập nhật phần mềm hoặc xác minh gói tải về.
- Lỗi xác thực tài khoản, kiểm tra phiên bản hoặc khôi phục dữ liệu trong Chuyển máy Offline.
- Nội dung không đáng tin cậy khiến bot hoặc ứng dụng vượt qua một ranh giới bảo vệ có thể tái hiện. Vui lòng chỉ rõ quyền bị vượt qua và hành động thực tế, thay vì chỉ gửi phản hồi văn bản của mô hình.

Đối với dịch vụ AI hoặc nền tảng bên ngoài, hãy phân biệt vấn đề trong tích hợp Limix Bot với vấn đề thuộc dịch vụ đó. Lỗ hổng nằm hoàn toàn ở bên thứ ba cần được báo cho đơn vị vận hành liên quan.

## Phiên bản và xác minh

Khi có thể, tái hiện trên bản ổn định mới nhất tại [Releases](https://github.com/leomieo/limix-bot/releases). Nếu lỗi chỉ xảy ra trên bản cũ, vẫn gửi kèm số phiên bản và các bước tái hiện.

Việc tiếp nhận báo cáo không đồng nghĩa mọi phiên bản cũ đều được hỗ trợ hoặc được phát hành bản vá riêng. Phạm vi và phương án khắc phục phụ thuộc vào kết quả xác minh, tác động và khả năng tương thích.

## Nguyên tắc kiểm thử có trách nhiệm

- Chỉ kiểm tra trên thiết bị, tài khoản và môi trường bạn sở hữu hoặc được phép kiểm thử rõ ràng.
- Dùng hồ sơ thử nghiệm, dữ liệu giả và quyền tối thiểu cần thiết.
- Không truy cập, sao chép, sửa, xóa hoặc công khai dữ liệu của người khác.
- Không gây gián đoạn dịch vụ, gửi tải lớn, dò mật khẩu hoặc tự động quét hạ tầng đang hoạt động khi chưa được cho phép.
- Nếu phát hiện dữ liệu không thuộc quyền của mình, hãy dừng kiểm tra và báo cáo; không mở rộng phạm vi để thu thập thêm bằng chứng.

Chính sách này không cấp quyền kiểm thử hệ thống của bên thứ ba hoặc quyền truy cập vượt quá sự cho phép hiện có.

## Xử lý và công bố

Dự án xem xét báo cáo, có thể yêu cầu bổ sung bằng chứng và trao đổi phương án giảm thiểu hoặc khắc phục. Thời gian xử lý phụ thuộc mức độ nghiêm trọng và khả năng tái hiện; hiện không cam kết thời hạn phản hồi hay sửa lỗi cố định.

Vui lòng phối hợp về thời điểm công bố để người dùng có cơ hội áp dụng biện pháp bảo vệ. Nội dung công bố cần tránh làm lộ dữ liệu cá nhân, bí mật hoặc thông tin không cần thiết cho việc phòng vệ.

Thông tin báo cáo chỉ nên được chia sẻ trong phạm vi cần thiết để xác minh và xử lý. Việc ghi nhận người báo cáo được thực hiện khi có sự đồng ý của họ. Dự án hiện không công bố chương trình thưởng lỗ hổng hoặc cam kết chi trả.

## Bảo vệ bản cài của bạn

Tải ứng dụng từ các kênh chính thức của Limix Bot, cập nhật khi có bản sửa lỗi và chỉ cấp quyền bot hoặc cài skills từ nguồn bạn tin cậy. Khi chia sẻ ảnh chụp, nhật ký hoặc file sao lưu để nhận hỗ trợ, hãy kiểm tra và loại bỏ thông tin nhạy cảm trước.
