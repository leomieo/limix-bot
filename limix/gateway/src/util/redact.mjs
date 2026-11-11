// Security invariant: no bot token, API key or link code may reach a log line, an activity row or the browser.
const PATTERNS = [
  /\b\d{5,}:[A-Za-z0-9_-]{20,}\b/g,
  /\bbak_[A-Za-z0-9_-]{20,}\b/g,
  /(Bearer\s+)[A-Za-z0-9._-]{8,}/gi,
  /(\/bot)\d+:[^/\s]+/g,
];

const known = new Set();

export function registerSecret(value) {
  if (typeof value === "string" && value.length >= 6) known.add(value);
}

export function redact(text) {
  let out = String(text ?? "");
  for (const secret of known) out = out.split(secret).join("***");
  out = out.replace(PATTERNS[0], "***").replace(PATTERNS[1], "bak_***");
  out = out.replace(PATTERNS[2], "$1***").replace(PATTERNS[3], "$1***");
  return out;
}

export function maskToken(token) {
  if (!token) return "";
  const s = String(token);
  return s.length <= 8 ? "***" : `${s.slice(0, 4)}…${s.slice(-3)}`;
}
