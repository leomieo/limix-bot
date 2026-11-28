import type { ServerResponse } from "node:http";

import { appendDecision } from "../decision-log.ts";
import { json } from "../harness/http.ts";
import type { OutboundRequestService, PendingOutboundSends, SavedOutboundSend } from "../outbound-requests.ts";
import type { Store } from "../store.ts";

/** A proposal a person answers on a card, settled by its own service. */
interface Remembered {
  resolve(threadId: string, requestId: string, behavior: string): { ok: true; outcome: string; alreadySettled?: true } | null;
}

export interface TrustAnswerDeps {
  store: Pick<Store, "messagesFor" | "bot" | "botByThread" | "patchMessage">;
  dataDir: string;
  teamMemoryRequests: Remembered;
  outsideWrites: Remembered;
  outboundRequests: OutboundRequestService;
  pendingSends: PendingOutboundSends;
  sendRecovered: (requestId: string, send: SavedOutboundSend) => Promise<void>;
}

/** The person's answer to a team-memory, outside-write or "Send on your behalf?" card. */
export function createTrustAnswers(deps: TrustAnswerDeps) {
  const { store, teamMemoryRequests, outsideWrites, outboundRequests } = deps;
  const DATA_DIR = deps.dataDir;

  async function resolveAndSendTrust(res: ServerResponse, threadId: string, requestId: string, behavior: "allow" | "deny" | "answer", mayRecover: boolean): Promise<boolean> {
    const remembered = teamMemoryRequests.resolve(threadId, requestId, behavior) ?? outsideWrites.resolve(threadId, requestId, behavior);
    if (remembered) {
      json(res, 200, remembered);
      return true;
    }
    const outboundCard = store.messagesFor(threadId).find(
      (message) => message.card?.requestId === requestId && message.card.outboundRequest,
    );
    if (outboundCard?.card?.outboundRequest) {
      const outboundBot = outboundCard.from?.botId ? store.bot(outboundCard.from.botId) : store.botByThread(threadId);
      const result = outboundRequests.resolve({ threadId, requestId, behavior });
      if (!result.claimed) {
        const saved = deps.pendingSends.get(requestId, threadId);
        if (saved && !mayRecover && behavior === "allow") {
          json(res, 403, { error: "Only a workspace admin may approve this recovered send." });
          return true;
        }
        if (saved && (!outboundCard.card.answered || outboundCard.card.answered === "allow")) {
          if (behavior !== "allow") {
            deps.pendingSends.discard(requestId);
            store.patchMessage(threadId, outboundCard.id, { card: { ...outboundCard.card, answered: "deny" } });
            json(res, 200, { ok: true, outcome: "rejected" });
            return true;
          }
          try {
            await deps.sendRecovered(requestId, saved);
          } catch {
            json(res, 409, { error: "Limix Bot could not confirm this send. Check the sent folder before starting a new request." });
            return true;
          }
          store.patchMessage(threadId, outboundCard.id, { card: { ...outboundCard.card, answered: "allow" } });
          deps.pendingSends.complete(requestId);
          appendDecision(DATA_DIR, { threadId, requestId, botId: saved.botId, tool: outboundCard.card.tool, decision: "user-approved", source: "user" });
          json(res, 200, { ok: true, outcome: "allowed-once" });
          return true;
        }
        if (deps.pendingSends.dispatching(requestId)) {
          json(res, 409, { error: "This send is in progress or its result is unknown. Check the sent folder before starting a new request." });
          return true;
        }
        if (outboundCard.card.answered === "allow" || outboundCard.card.answered === "deny") {
          json(res, 200, { ok: true, outcome: outboundCard.card.answered === "allow" ? "allowed-once" : "rejected", alreadySettled: true });
          return true;
        }
        if (!outboundCard.card.answered) {
          store.patchMessage(threadId, outboundCard.id, { card: { ...outboundCard.card, answered: "unavailable", dismissed: true } });
        }
        json(res, 200, { ok: true, outcome: "unavailable" });
        return true;
      }
      if (result.state === "already_settled") {
        json(res, 200, { ok: true, outcome: result.behavior === "allow" ? "allowed-once" : "rejected", alreadySettled: true });
        return true;
      }
      store.patchMessage(threadId, outboundCard.id, {
        card: { ...outboundCard.card, answered: result.state === "allowed" ? "allow" : "deny" },
      });
      appendDecision(DATA_DIR, {
        threadId, requestId, botId: outboundBot?.id, botName: outboundBot?.name,
        tool: outboundCard.card.tool, summary: outboundCard.card.subtitle,
        decision: result.state === "allowed" ? "user-approved" : "user-denied", source: "user",
      });
      json(res, 200, { ok: true, outcome: result.state === "allowed" ? "allowed-once" : "rejected" });
      return true;
    }
    return false;
  }

  return { resolveAndSendTrust };
}
