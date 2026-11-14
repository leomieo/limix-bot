# Capability scope

Use when the user asks what can be fetched or whether results are complete. These are bundled-release declarations, not proof that every site/account/action has passed a live check.

Distinguish public evidence available through native web tools, additional Reach actions declared by `agent-reach channels`, and specifically verified local operations. Installation, saved sessions and network reachability do not establish functional acceptance. Reuse the dedicated browser's saved session; request personal login only when the chosen path actually needs it.

| Channel | Public evidence to try | Reach actions and boundaries |
|---|---|---|
| GitHub | Public repositories, README, issues/PRs | Repository search/read, issue/PR content and returned comments; evaluate private permissions separately |
| YouTube | Search, title, description; native tools may retrieve comments/subtitle text | search/read/subtitle/transcribe; no unified comments action; track lists are not subtitle content; transcription needs its tools |
| Bilibili | Search/description; some public APIs return comments and parent IDs | search/read/hot/subtitle; no unified comments action; subtitle availability varies |
| Reddit | Search, posts, partial comments/public JSON parent IDs | Browser search/read/subreddit; login depends on path; no guarantee of complete reply trees; no posting comments |
| X/Twitter | Public single posts from search; some official embeds return full text | search/profile/tweets/thread; single-post access does not prove reply-feed access or completeness |
| Xiaohongshu | Public lists/index may return note IDs, authors and titles; never invent empty fields | search/read/comments; descriptions, top-level comments and loaded replies only; no completeness or image/video understanding claim |
| Instagram | Some indexes and shallow profile information; app-shell HTML is not post content | search users/profile/posts descriptions; no unified comments action or implied image/video comprehension |
| Facebook | Some indexes/HTML snippets, possibly truncated | search/profile; no unified full-detail/comments action; snippets are not full content |
| LinkedIn | Public job search and public JDs | jobs/read tries public pages first; use in-site OpenCLI directly only when requested; not every job is readable |
| BOSS | Indexed job summaries | search/read job lists/JDs; never infer salary numbers from encoded values; fallback depends on declared channel capabilities |
| V2EX | Public topics/content/replies | hot/node/read/user; report only returned scope, not hidden/missing replies |
| Xueqiu | Some public quotes/indexes | quote/search/hot_posts/hot_stocks; verify quote and community paths separately |
| Web | Agent's native search/read | Reach web search/read is anonymous fallback; snippets, app shells and verification pages are not complete content |
| Xiaoyuzhou | Episode page title/description | transcribe full episode; user-supplied Groq key via `agent-reach configure groq-key` |

Describe browser features as available to enable/try, never as complete-comment access after login. If the user skips login, deliver the public evidence already obtained.
