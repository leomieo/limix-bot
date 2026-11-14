# Maintenance

Read for update failures, browser failures, channel errors or uninstall requests.

- `agent-reach update` updates Reach, added channel tools and skills. `agent-reach update --check` checks only. Update only with the user's authorization.
- `agent-reach doctor --text` reads local status without network. `agent-reach check <channel> --text` performs one live check; `--search` tests search/jobs only. Installation success is not functional acceptance.
- Browser: `agent-reach browser status`, `browser setup`, `browser stop`. After fixing connectivity, retry a failed CloakBrowser download using `browser setup --retry-cloak`.
- Distinguish dependency download, browser connection, login, page load and rate-limit failures. A network timeout does not prove an expired login.
- Record upstream errors and versions. If authorized, update once. Do not patch installed upstream tools or loop retries.
- Stop the attempt on `PLATFORM_BLOCKED`, `RATE_LIMITED`, `NEED_LOGIN` or `BUSY`. Resume after the necessary user/external action; do not repeatedly open windows.
- Keys/proxy: `agent-reach configure groq-key | openai-key | proxy | github-token`; the user provides values. Never log secrets.
- `Port <n> belongs to an unmanaged browser` means another program owns the dedicated port (default 9222). Do not close it. If authorized, set a free port with `agent-reach configure browser-port <port>`.
- Uninstall: show scope using `agent-reach uninstall --dry-run`, then execute `agent-reach uninstall` when authorized. Remove Reach-managed resources only; preserve other files and browsers.
