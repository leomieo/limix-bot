import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newEventId, newId, type ProviderAdapter, type RuntimeEvent, type RuntimeEventListener, type SendTurnInput } from "../contracts.ts";
import { killCliTree, spawnCli } from "../procs.ts";

export function antigravityGuestAdapter(adapter: ProviderAdapter, cli: string, env: NodeJS.ProcessEnv): ProviderAdapter {
  const listeners = new Set<RuntimeEventListener>();
  const pending = new Map<string, AbortController>();
  async function guest(turn: SendTurnInput) {
    if (!turn.model || turn.images?.length) throw new Error("Antigravity customer chat requires a selected model and a text message");
    if (pending.has(turn.threadId)) throw new Error("Conversation is busy");
    const turnId = newId();
    const controller = new AbortController();
    pending.set(turn.threadId, controller);
    const emit = (event: Omit<RuntimeEvent, "provider" | "eventId" | "createdAt" | "threadId">) => {
      const value = { ...event, provider: adapter.provider, turnId, threadId: turn.threadId, eventId: newEventId(), createdAt: new Date().toISOString() } as RuntimeEvent;
      for (const listener of listeners) listener(value);
    };
    async function run() {
      let cwd: string | undefined;
      try {
        await turn.engineAdmission?.("process");
        cwd = await mkdtemp(join(tmpdir(), "limix-guest-"));
        controller.signal.throwIfAborted();
        const args = ["--input-format", "stream-json", "--output-format", "stream-json", "--sandbox", "--disable-slash-commands",
          "--settings", JSON.stringify({ toolPermission: "strict", allowNonWorkspaceAccess: false }), "--model", turn.model!];
        const effort = turn.variant || turn.effort;
        if (effort) args.push("--effort", effort);
        const child = spawnCli(cli, args, { cwd, env: { ...env, HOME: cwd, USERPROFILE: cwd, XDG_CONFIG_HOME: cwd, GEMINI_CLI_HOME: cwd }, stdio: ["pipe", "pipe", "pipe"], botWork: true });
        const stop = () => { void killCliTree(child, 0); };
        controller.signal.addEventListener("abort", stop, { once: true });
        const timer = setTimeout(() => controller.abort(), 120_000);
        try {
          const output = await new Promise<string>((resolve, reject) => {
            let data = "";
            let sent = false;
            child.stdout.setEncoding("utf8");
            child.stdout.on("data", (chunk: string) => {
              if (data.length + chunk.length > 4_000_000) { stop(); reject(new Error("Customer response exceeded output limit")); }
              else data += chunk;
              if (!sent && data.includes("\n")) {
                try {
                  const init = JSON.parse(data.slice(0, data.indexOf("\n")));
                  if (init.event !== "init" || init.init?.permission_mode !== "strict") throw new Error("Antigravity did not confirm strict guest permissions");
                  sent = true;
                  const history = turn.transcript?.length ? JSON.stringify(turn.transcript) : undefined;
                  const prompt = [turn.system, history, turn.text].filter(Boolean).join("\n\n");
                  child.stdin.end(JSON.stringify({ event: "user", message: { content: prompt } }) + "\n");
                } catch (error) { stop(); reject(error); }
              }
            });
            child.stderr.resume();
            child.once("error", reject);
            child.stdin.on("error", () => {});
            child.once("close", code => code === 0 ? resolve(data) : reject(new Error("Antigravity could not complete this customer request")));

          });
          controller.signal.throwIfAborted();
          const result = output.trim().split(/\r?\n/).map(line => JSON.parse(line)).find(item => item.event === "result")?.result;
          if (result?.status !== "SUCCESS" || typeof result.response !== "string" || !result.response.trim()) throw new Error("Antigravity returned no customer reply");
          emit({ type: "item.completed", itemType: "assistant_text", text: result.response } as RuntimeEvent);
          emit({ type: "turn.completed", ok: true, stopReason: "end_turn", cost: null } as RuntimeEvent);
        } finally {
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", stop);
        }
      } catch (error) {
        emit({ type: "runtime.error", message: error instanceof Error ? error.message : String(error) } as RuntimeEvent);
        emit({ type: "turn.completed", ok: false, stopReason: "error", cost: null } as RuntimeEvent);
      } finally {
        pending.delete(turn.threadId);
        if (cwd) await rm(cwd, { recursive: true, force: true, maxRetries: 4 }).catch(() => {});
      }
    }
    emit({ type: "turn.started" });
    void run();
    return { turnId };
  }
  return {
    ...adapter, capabilities: { ...adapter.capabilities, guestTurns: "confined" },
    sendTurn: turn => turn.guestConfined ? guest(turn) : adapter.sendTurn(turn),
    onEvent(listener) { listeners.add(listener); const off = adapter.onEvent(listener); return () => { listeners.delete(listener); off(); }; },
    interruptTurn: async (id, turn) => { pending.get(id)?.abort(); await adapter.interruptTurn(id, turn); },
    hasSession: id => pending.has(id) || adapter.hasSession(id),
    stopAll: async () => { for (const controller of pending.values()) controller.abort(); await adapter.stopAll(); },
  };
}
