// Limix Bot account client: talks to the shared Limix account server (the same accounts as Limix Studio).
// Pure logic with injected fetch/store/clock so it runs under plain Node tests; Electron wiring is limix-account.mjs.
//
// Server routes (tiktok-checker gui_server.py, /api/limixbot/*): login, validate, logout, machines, remove-machine.
// One account may be signed in on at most `max` computers; the next is refused with error "device_limit".

const HOUR = 3_600_000;

/** @typedef {{ token?: string, username?: string, email?: string, lastOk?: number }} SavedAccount */

export function createAccountClient({
  baseUrl, fetch: fetcher = fetch, store, machineId, machineName, now = Date.now, graceMs = HOUR, timeoutMs = 15_000,
}) {
  const url = path => `${String(baseUrl).replace(/\/+$/, "")}/${path}`;
  async function post(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetcher(url(path), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    } catch {
      return { status: 0, data: { error: "offline" } };
    } finally {
      clearTimeout(timer);
    }
  }
  const saved = () => store.read() ?? {};
  const failure = ({ status, data }) => ({
    ok: false,
    error: data.error || (status === 0 ? "offline" : "server_error"),
    detail: data.detail || data.reason || "",
    ...(data.error === "device_limit" ? { max: data.max, machines: data.machines ?? [] } : {}),
  });

  return {
    signedInAs: () => { const s = saved(); return s.token ? (s.username || s.email || "") : null; },

    /** Startup and periodic check. "ok" also covers a short offline spell after a recent successful check. */
    async check() {
      const s = saved();
      if (!s.token) return { status: "login" };
      const out = await post("validate", { token: s.token, machine_id: machineId });
      if (out.status === 200 && out.data.valid) {
        store.write({ ...s, lastOk: now(), username: out.data.username ?? s.username, email: out.data.email ?? s.email });
        return { status: "ok" };
      }
      if (out.status === 401 || (out.status === 200 && out.data.valid === false)) {
        store.write({ username: s.username });
        return { status: "login", reason: out.data.error || "signed_out", detail: out.data.reason || "" };
      }
      // Server unreachable or failing: keep working for a while after the last good check.
      if (s.lastOk && now() - s.lastOk < graceMs) return { status: "ok", offline: true };
      return { status: "login", reason: "offline" };
    },

    async login(username, password) {
      const out = await post("login", { username, password, machine_id: machineId, machine_name: machineName });
      if (out.status === 200 && out.data.token) {
        store.write({ token: out.data.token, username: out.data.username, email: out.data.email, lastOk: now() });
        return { ok: true, username: out.data.username };
      }
      return failure(out);
    },

    async machines(username, password) {
      const out = await post("machines", { username, password });
      return out.status === 200 ? { ok: true, max: out.data.max, machines: out.data.machines } : failure(out);
    },

    async removeMachine(username, password, id) {
      const out = await post("remove-machine", { username, password, id });
      return out.status === 200 ? { ok: true, max: out.data.max, machines: out.data.machines } : failure(out);
    },

    /** Signing out frees this computer's seat on the account. */
    async logout() {
      const s = saved();
      if (s.token) await post("logout", { token: s.token });
      store.write({ username: s.username });
      return { ok: true };
    },
  };
}
