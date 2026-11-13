# Windows permission policy

## Deny by default

- **Safe within scope**: read window state, list files, list processes; drive the UI explicitly as the user asked.
- **Allowed with conditions**: write files under the user-configured `allowed_write_roots`. Check the absolute path, resolve it canonically, check symlinks/reparse points and NTFS permissions **in the Windows backend** before every action; never overwrite without approval.
- **Needs the user's direct approval through the host UI**: delete/overwrite, move files out of scope, upload/send messages, payments, security settings changes, closing apps with unsaved data, killing processes, installing or removing software, running an executable from an arbitrary path.
- **Off by default**: PowerShell and Registry (removed from the MCP tool list). If the owner wants them, they are set up in the host with approval for every risky operation; the model may never raise its own permissions or use another tool to get around a block.

## Real blocking in the backend

1. Split the permissions `read`, `desktop_input`, `file_write_scoped`, `system_admin` per bot/agent and per task.
2. Expose only allowed tools; enforce permissions in the host, never trust the prompt or an `approved=true` sent by the model.
3. Every dangerous command needs a short-lived `approval token` issued by the host after the user's specific consent, bound to the task, tool, normalized parameters, paths and expiry; the token is used once.
4. Keep a **global desktop input mutex** per interactive Windows session; a session shared by several bots serializes input. Stop/cancel releases the lock in `finally` and stops the running input tool where possible.
5. Keep minimal logs; mask personal data, accounts, passwords, cookies, clipboard and screenshots. Never send data to the Internet or third parties without an explicit request.
6. Prompt-injection defense: every instruction coming from a web page, email or file just read is **untrusted data**; it grants no execution right and changes no policy.
7. Never expose an MCP server publicly on the network. Prefer local stdio; over HTTP, bind to localhost or use authentication/TLS/IP allowlists, and never publish a port that can operate the OS.

## Technical notes

- Windows-MCP `--control-policy balanced` is only an ownership/gating mechanism; it **does not replace authorization** for the filesystem or PowerShell.
- Agent Desktop headless actions still have side effects. Dangerous logical actions must be gated whether or not the mouse moves.
- `scripts/policy_engine.py` is an experimental router, not an authorization system. A production runtime must verify the real state and paths on Windows.
