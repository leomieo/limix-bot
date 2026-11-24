import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import profiles from "../assets/industry-profiles.json" with { type: "json" };

const CHANNELS = ["zalo", "facebook", "messenger", "telegram", "web"];
const MAX_CATALOG_BYTES = 1024 * 1024;
const SKU = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/;
const UTC_DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/;
const AVAILABILITY = ["in_stock", "out_of_stock", "on_request"];
const CASE_REF = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const CARE_TOOLS = [
  {
    name: "care_triage",
    description: "Suggest the next support queue and verification step. No ticket is created or sent.",
    inputSchema: {
      type: "object", properties: {
        text: { type: "string", minLength: 1, maxLength: 2000 },
        channel: { type: "string", enum: CHANNELS },
      }, required: ["text"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "care_lookup",
    description: "Look up one exact SKU in the operator-bound current public catalog. Returns a source and verification time when found.",
    inputSchema: {
      type: "object", properties: { sku: { type: "string", pattern: SKU.source, maxLength: 80 } },
      required: ["sku"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "care_prepare_case",
    description: "Prepare an internal draft with the selected department's required evidence, instructions and handoff criteria.",
    inputSchema: {
      type: "object", properties: {
        industry: { type: "string", enum: profiles.map(profile => profile.slug) },
        role: { type: "string", enum: [...new Set(profiles.flatMap(profile => profile.roles.map(role => role.slug)))] },
        caseRef: { type: "string", pattern: CASE_REF.source, maxLength: 64, description: "Optional opaque case reference, without customer details." },
      }, required: ["industry", "role"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
];

function fields(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new TypeError("Invalid tool arguments.");
  }
}

export function prepareCase(input) {
  fields(input, ["industry", "role", "caseRef"]);
  const profile = profiles.find(profile => profile.slug === input.industry);
  const role = profile?.roles.find(role => role.slug === input.role);
  if (!role || (input.caseRef !== undefined && (typeof input.caseRef !== "string" || !CASE_REF.test(input.caseRef)))) {
    throw new TypeError("Invalid industry, role, or case reference.");
  }
  return {
    status: "draft", industry: profile.slug, role: role.slug, department: role.name,
    inputs: role.inputs, instructions: role.instructions, handoff: role.handoff,
    ...(input.caseRef === undefined ? {} : { caseRef: input.caseRef }),
  };
}

function normalizedText(text) {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const TOPICS = [
  { phrases: /\b(?:khieu nai|nhan vien ho tro|gap nhan vien|noi chuyen voi nguoi|mat an toan|lo thong tin|thong tin bi lo|xoa du lieu|complaint|talk to a human|human agent|privacy|unsafe)\b/, queue: "supervisor", next: "offer_human_handoff" },
  { phrases: /\b(?:hoan tien|hoan phi|chuyen tien|tru tien|hoa don thanh toan|refund|chargeback|billing dispute|duplicate charge)\b/, queue: "finance", next: "handoff_for_authorized_review" },
  { phrases: /\b(?:don hang|don cua toi|huy don|tra don|trang thai don|lich hen cua toi|huy lich|doi lich|doi dia chi|ma van don|kien hang cua toi|order status|my order|cancel my|reschedule|tracking number)\b/, queue: "operations", next: "verify_customer_in_private" },
  { phrases: /\b(?:doi tra|bao hanh|chinh sach|dieu kien doi|ho tro ky thuat|return policy|warranty|support policy)\b/, queue: "support", next: "consult_published_policy" },
  { phrases: /\b(?:gia bao nhieu|bao gia|con hang|con size|bang gia|ton kho|gia ban|price|stock|availability)\b/, queue: "sales", next: "ask_for_sku_or_use_public_lookup" },
];

export function triageTicket(input) {
  fields(input, ["text", "channel"]);
  if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 2000 ||
      (input.channel !== undefined && !CHANNELS.includes(input.channel))) throw new TypeError("Invalid triage arguments.");
  const text = normalizedText(input.text);
  const topic = TOPICS.find((candidate) => candidate.phrases.test(text));
  return { status: "suggested", queue: topic?.queue ?? "support", next: topic?.next ?? "ask_one_clarifying_question" };
}

function utcTime(value) {
  if (typeof value !== "string" || !UTC_DATE.test(value)) return NaN;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return NaN;
  const canonical = value.length === 20 ? value.replace("Z", ".000Z") : value;
  return new Date(t).toISOString() === canonical ? t : NaN;
}

function publicText(value, limit) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit && !/\p{Cc}/u.test(value);
}

export function validBinding({ scope, catalogDir } = {}) {
  return typeof scope === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(scope) &&
    typeof catalogDir === "string" && isAbsolute(catalogDir);
}

async function readCatalog(directory) {
  if (!(await lstat(directory)).isDirectory()) return null;
  const file = join(directory, "public-catalog.json");
  const entry = await lstat(file);
  if (!entry.isFile() || entry.size > MAX_CATALOG_BYTES || entry.size === 0) return null;
  const handle = await open(file, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.dev !== entry.dev || stat.ino !== entry.ino || stat.size !== entry.size) return null;
    const buffer = Buffer.alloc(stat.size + 1);
    let count = 0;
    while (count < buffer.length) {
      const { bytesRead } = await handle.read(buffer, count, buffer.length - count, count);
      if (bytesRead === 0) break;
      count += bytesRead;
    }
    if (count !== stat.size) return null;
    return JSON.parse(buffer.toString("utf8", 0, count));
  } finally {
    await handle.close();
  }
}

export async function lookupPublicCatalog(input, binding = {}, now = Date.now()) {
  fields(input, ["sku"]);
  if (typeof input.sku !== "string" || !SKU.test(input.sku)) throw new TypeError("Invalid SKU.");
  if (!validBinding(binding)) return { status: "not_configured" };
  let catalog;
  try {
    catalog = await readCatalog(binding.catalogDir);
  } catch (error) {
    return { status: error.code === "ENOENT" ? "not_configured" : "unavailable" };
  }
  if (catalog?.schemaVersion !== 1 || catalog.scope !== binding.scope || !Array.isArray(catalog.records)) return { status: "unavailable" };
  const found = catalog.records.filter((r) => r?.visibility === "public" && r.status === "approved" && r.sku === input.sku);
  if (found.length === 0) return { status: "no_current_record" };
  const current = found.filter((r) => utcTime(r.asOf) <= now && now < utcTime(r.validUntil));
  if (current.length === 0) return { status: "no_current_record" };
  if (current.length !== 1) return { status: "unavailable" };
  const row = current[0];
  if (!publicText(row.name, 160) || !publicText(row.source, 200) || !AVAILABILITY.includes(row.availability) ||
      !Number.isSafeInteger(row.priceMinor) || row.priceMinor < 0 || typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency)) {
    return { status: "unavailable" };
  }
  return { status: "found", sku: row.sku, name: row.name, priceMinor: row.priceMinor, currency: row.currency,
    availability: row.availability, source: row.source, asOf: row.asOf, validUntil: row.validUntil };
}
