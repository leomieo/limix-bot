# Limix administration center / Trung tâm quản trị Limix

## English

The account server serves the admin panel at `https://admin.limixmedia.com/`.
The existing account, plan, transaction and settings tabs are retained; the Cloud tab lists requests, workspace IDs and reported runtime states and provides approve, decline and revoke actions.

Web sign-in authenticates only the existing Limix `leox` account. It uses the shared account database or the existing configured Limix master credential, without changing passwords. The old separate web-admin password is no longer used. The Cloud adapter accepts only an authenticated admin cookie. Mutations require the exact admin origin and JSON content type. The backend generates the owner bearer in memory and sends it only to the fixed Cloud API over HTTPS; redirects are refused. Neither that bearer nor the master password is exposed to the browser.

Deploy `cloud_admin_bridge.py`, `cloud-panel.html` and `install.py` to an extension directory beside the account server. Run:

```sh
python3 admin-center/install.py /var/www/tiktok-checker
python3 -m py_compile /var/www/tiktok-checker/gui_server.py /var/www/tiktok-checker/cloud_admin_bridge.py
systemctl restart tiktok-checker
```

The installer backs up the two changed legacy files and can be rerun. Keep the existing service environment and database; do not put them in Git. The Nginx example uses the existing HTTP origin behind Cloudflare and must follow that deployment's TLS settings. `/admin` redirects to the canonical HTTPS root. Old clients keep their account API endpoint.

Validation: `python -m unittest discover -s limix/admin-center -p 'test_*.py'`.
Live verification on 2026-11-16: owner login 200, Cloud request list 200 with the owner's running workspace, repeat approval of the already-approved owner 200, anonymous access 401 and foreign-origin mutation 403. Browser rendering has not been verified by automation.

Custom Cloud CPU/RAM/storage quotas, a unified plan editor and Cloud resource billing are not implemented by this extension. The account server's existing plan controls do not yet configure Docker resource limits. The older Cloud owner page remains available for compatibility. The updated desktop management button opens this admin center; installed desktops receive that change with a subsequent application release.

## Tiếng Việt

Trang quản trị dùng địa chỉ `https://admin.limixmedia.com/`, giữ các mục tài khoản, gói, giao dịch và cài đặt hiện có; bổ sung mục Limix Cloud để xem yêu cầu, mã máy, trạng thái và duyệt/từ chối/thu hồi quyền.

Chỉ tài khoản Limix `leox` đăng nhập được. Dùng mật khẩu tài khoản hiện có; không đổi mật khẩu. Thông tin xác thực Cloud được xử lý ở máy chủ, không đưa ra trình duyệt. Địa chỉ `/admin` chuyển về trang gốc HTTPS.

Chạy bộ cài mở rộng theo lệnh ở trên; bộ cài tự sao lưu hai file cũ. Không đưa cơ sở dữ liệu hoặc biến môi trường bí mật lên GitHub. Sau khi chuyển từ mật khẩu quản trị riêng, cần thu hồi các phiên quản trị cũ để yêu cầu đăng nhập lại bằng Leox.

Đã kiểm tra thực tế ngày 16/11/2026: đăng nhập, đọc danh sách Cloud và duyệt lại chủ tài khoản đã được duyệt đều trả 200; truy cập chưa đăng nhập trả 401; lệnh từ website khác trả 403. Chưa xác minh hình thức giao diện bằng trình duyệt tự động.

Phần mở rộng này chưa có chỉnh CPU/RAM/ổ đĩa theo khách hoặc trình sửa gói Cloud thống nhất. Các nút gói tài khoản cũ chưa thay đổi hạn mức Docker. Nút quản trị trên mã desktop đã trỏ về trung tâm này; ứng dụng đã cài cần bản phát hành tiếp theo để nhận thay đổi.

Deployment note: legacy web-admin sessions were revoked on the deployed VPS on 2026-11-16; sign in again with the existing Leox account. No account passwords were changed.
