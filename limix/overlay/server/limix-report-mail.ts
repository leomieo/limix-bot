// Limix Bot: @devs bug reports go to the Limix owner's inbox through FormSubmit (https://formsubmit.co/documentation),
// addressed by the random alias FormSubmit hands out once the owner confirms their address, so neither the source nor
// the app carries the address itself. There is no status service behind an inbox, so nothing asks what became of a report.
import { randomBytes } from "node:crypto";

import type { DevsReportPayload } from "./devs-report.ts";
import type { ReportStatusAnswer, ReportStatusQuestion, SendOutcome } from "./devs-report-send.ts";
import { LIMIX_REPORT_ALIAS } from "./limix-report-config.ts";

const ALIAS = /^[A-Za-z0-9]{8,128}$/;
const SEND_TIMEOUT_MS = 20_000;
/** Kept well under what an email body comfortably carries; the full diagnostics stay in the app's own log. */
const MAX_FIELD_CHARS = 20_000;

export function limixReportAlias(env: NodeJS.ProcessEnv = process.env): string | null {
  const alias = (env.LIMIX_REPORT_ALIAS ?? LIMIX_REPORT_ALIAS).trim();
  return ALIAS.test(alias) ? alias : null;
}

const clipped = (text: string): string => (text.length > MAX_FIELD_CHARS ? `${text.slice(0, MAX_FIELD_CHARS)}\n…` : text);

export function limixReportSender(alias: string | null, fetcher: typeof fetch = fetch) {
  return async (payload: DevsReportPayload): Promise<SendOutcome> => {
    if (!alias) return { ok: false, retry: false, why: "refused", detail: "bug reports are not set up in this Limix Bot build" };
    const id = `LX-${randomBytes(4).toString("hex").toUpperCase()}`;
    const fields: Record<string, string> = {
      _subject: `Limix Bot bug report ${id} (${payload.appVersion}, ${payload.platform})`,
      _template: "box",
      _captcha: "false",
      report: id,
      version: payload.appVersion,
      platform: payload.platform,
      install: payload.installId,
      message: clipped(payload.description),
      diagnostics: clipped(payload.diagnostics),
    };
    if (payload.contactEmail) {
      fields.email = payload.contactEmail;
      fields._replyto = payload.contactEmail;
    }
    if (payload.contact) fields.contact = payload.contact;
    let response: Response;
    try {
      response = await fetcher(`https://formsubmit.co/ajax/${alias}`, {
        method: "POST", redirect: "error", cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(fields), signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch {
      return { ok: false, retry: true, why: "offline" };
    }
    const answer = (await response.json().catch(() => ({}))) as { success?: unknown; message?: unknown };
    if (response.ok && String(answer.success) === "true") return { ok: true, id };
    if (response.status === 429) return { ok: false, retry: true, why: "limited" };
    if (response.ok || response.status >= 500) return { ok: false, retry: true, why: "server" };
    const detail = typeof answer.message === "string" ? answer.message.replace(/\p{Cc}+/gu, " ").trim().slice(0, 200) : "";
    return { ok: false, retry: false, why: "refused", detail: detail || `status ${response.status}` };
  };
}

export const limixStatusAsker = () => async (_question: ReportStatusQuestion): Promise<ReportStatusAnswer | null> => null;
