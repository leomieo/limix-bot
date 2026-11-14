# Sessions and dedicated browser

Read for login/logout, account changes or `NEED_LOGIN`.

## Browser lifecycle
- Browser channels share one dedicated profile, separate from the user's everyday Chrome. Never close or modify the everyday browser.
- Prefer CloakBrowser. If download/install fails, reuse installed Chrome and remember the fallback instead of downloading repeatedly. Retry explicitly with `agent-reach browser setup --retry-cloak` after connectivity is fixed.
- `agent-reach add <channel>` prepares Node, OpenCLI, browser and extension at versions tested by the bundled release. Chrome fallback on Windows may require one user-confirmed Add to Chrome action.
- Queries are headless by default. Only `agent-reach login <channel>` opens a visible login window. While open, queries use that window without closing it. Wait for the user to finish login. Later queries return to headless after it closes.
- Managed browser idle timeout is ten minutes. Calls and real page operations reset it; the next call reopens the browser. Sessions save periodically during login, so closing the window is unnecessary.
- Limits: two simultaneous queries per platform, four total; excess calls queue for up to two minutes then return `BUSY`. Space searches on the same platform by at least ten seconds. Login, logout and browser reinstall wait for running queries.
- Inspect/manage using `agent-reach browser status`, `browser setup`, `browser stop`.

## Reuse existing sessions
1. On first use, if Chrome is connected to the OpenCLI extension, copy only that site's cookies once into the dedicated browser. Do not copy the whole browser directory, other sites or passwords; do not modify the source.
2. Reuse the saved session thereafter without periodic recopying. Cookie presence does not establish valid login; verify the requested operation.
3. If the extension is disconnected, do not promise automatic reuse or conclude the user is logged out. Use Reach's saved session.
4. List multiple sources using `agent-reach browser profiles`; select explicitly with `agent-reach browser use <ID>` rather than switching randomly.
5. `agent-reach login <channel> --import-existing` explicitly recopies that site's session without a window. If no session or OpenCLI Bridge is available, return `NEED_SETUP` and preserve the saved session.
6. After manual login, logout or remove, do not import automatically again; a logged-out account must not silently reappear.

## Interactive login
Request login only when an actual operation returns `NEED_LOGIN` and the remaining task needs that path. A login button on a page is not evidence that login is required.
Run `agent-reach login <channel>` and let the user sign in personally. Never request passwords or output cookies. Follow any returned `next` instructions; native channels such as Xueqiu may need `agent-reach login <channel> --sync`. Repeat the original operation to verify success.

## Platform differences and removal
- BOSS site search uses OpenCLI and the shared dedicated browser. Do not repeat login for an upstream false-positive job-detail requirement.
- Bilibili passes saved login to its official CLI only for subtitles; ordinary search does not prepare a browser.
- Xueqiu community operations require login; sessions may expire within hours.
- `agent-reach logout <channel>` removes that site's login/channel state only.
- `agent-reach remove <channel>` removes that channel and its site state only. On cleanup failure retain the channel record and return an error for explicit retry.
- Neither logout nor remove may trigger automatic reimport of the site's login.
