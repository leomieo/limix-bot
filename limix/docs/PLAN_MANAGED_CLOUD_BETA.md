# Limix managed Cloud beta

## Quyết định đã chốt ngày 15/11/2026

Khách sử dụng hạ tầng của chủ dự án. Địa chỉ dịch vụ: **https://bot.limixmedia.com**. Khách đăng nhập tài khoản Limix và yêu cầu tạo Cloud Computer trong ứng dụng. Khách không phải cài Docker, Tailscale, SSH hoặc tự thiết lập VPS.

Máy chủ beta dự kiến là máy Windows của chủ dự án, hai Xeon E5-2680 v4, 64 GB RAM, vẫn dùng làm việc hằng ngày. Tailscale đang dùng cho kiểm tra nội bộ hai máy. Dịch vụ khách hàng cần HTTPS công khai và xác thực tài khoản độc lập với mạng Tailscale.

Đây là phạm vi phát triển tiếp theo. Chưa có controller tự cấp máy, chưa có máy Cloud của khách được tạo, và chưa xác minh HTTPS ở tên miền đã chọn. Không bật công tắc Cloud cũ trỏ tới dịch vụ bên ngoài.

## Customer flow

1. Desktop main obtains the existing accepted Limix session through limixRemoteCredential(). No API token enters renderer state.
2. The managed controller validates that session online against the existing Limix account service and resolves the account principal from its response. Never trust a username supplied by the caller.
3. The controller checks beta enrollment and capacity, then creates or returns that account's durable provisioning job. Concurrent requests and retries converge on the same workspace.
4. The host worker reserves resources, prepares persistent tenant storage, starts the account's workspace and computer, and checks readiness. A failed attempt preserves a recoverable job and its volume.
5. Once healthy, the desktop obtains a short-lived account-bound connection grant, redeems it in main and saves the server workspace automatically.
6. The customer enters that workspace, configures their AI connection and uses their bot's Cloud computer. The client does not offer local-computer sharing as part of provisioning.
7. Returning on another client with the same Limix account recovers the same workspace. Account changes invalidate pending connection grants and cached state.

## Required implementation

- Managed controller API for enrollment, provision, status, connection grant and stop/start. Device credentials are validated on every privileged request. Beta operator enrollment is distinct from a paid subscription.
- Durable account/workspace/job registry, serialized capacity reservations and restart reconciliation. Account identifiers are server-generated and mapped to verified Limix principals.
- Host worker with operator-only runtime access. Each account has separate persistent storage, runtime credentials and workspace. Customer code cannot access the host Docker socket or another tenant's processes, volumes, network credentials or files.
- Computer lifecycle broker that scopes every request to the verified account and its bot. Provisioning the workspace and starting a desktop have separate resource accounting.
- Public HTTPS gateway at bot.limixmedia.com and a verified routing strategy for tenant workspaces. The current web app expects an origin, so any additional per-tenant hostname scheme must be implemented and verified with the gateway; a path prefix cannot simply be assumed to work.
- Desktop beta settings and create/connect flow, gated by server capability and enrollment. Display pending, ready, capacity exhausted, stopped and failed states with meaningful retry behavior.
- Resource limits configured by the operator and measured on the Xeon. The existing 4 GiB / two CPU / one active desktop settings apply only to the current isolated beta server; they are not a tested multi-tenant capacity claim.

## Acceptance gates

- Account A and B cannot obtain each other's workspace, connection grants, files, memories, skills, histories or computer operations.
- Duplicate provisioning, concurrent claims, worker restart and a failed image pull leave consistent jobs and durable storage.
- A customer can connect from an unrelated Internet network with only Limix Bot installed. No desktop consent to control the customer's own machine is required.
- A real customer-owned AI connection responds from the hosted workspace. A real desktop operation runs on the Xeon and its result returns to the correct client.
- Closing the customer app leaves server-side jobs running. Host restart and service startup behavior are tested separately from a foreground PowerShell session.
- Stop/start preserves account data. Resource exhaustion reports a queued/capacity state instead of exceeding the operator's limits.
- Manual beta enrollment and operator controls work before customer availability is enabled.

## Current evidence

The user supplied a screenshot of a running isolated Limix Server 0.3.47 on Windows 10 Pro 19045, reached through a Tailscale HTTP address. Docker Linux engine passed its preflight. This establishes a single server start, not managed provisioning, public HTTPS, tenant isolation or a working hosted desktop.
