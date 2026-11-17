// Splitting behaviour adapted from Hermes Agent `gateway/platforms/base.py` truncate_message
// (NousResearch/hermes-agent @ b50d007e, MIT License, Copyright (c) 2025 Nous Research).
// Splits on newline, then space; a split inside a ``` fence closes it and reopens it in the next chunk;
// several chunks get " (i/n)" markers.

const INDICATOR_RESERVE = 12;
const FENCE_CLOSE = "\n```";

function fenceStateAfter(text, inCode, lang) {
  let open = inCode;
  let current = lang;
  for (const line of text.split("\n")) {
    const m = /^\s*```(\S*)/.exec(line);
    if (!m) continue;
    if (open) {
      open = false;
      current = "";
    } else {
      open = true;
      current = m[1] ?? "";
    }
  }
  return [open, current];
}

export function splitMessage(content, maxLength) {
  const text = String(content ?? "");
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let remaining = text;
  let carryLang = null;
  while (remaining) {
    const prefix = carryLang !== null ? "```" + carryLang + "\n" : "";
    let headroom = maxLength - INDICATOR_RESERVE - prefix.length - FENCE_CLOSE.length;
    if (headroom < 1) headroom = Math.max(1, Math.floor(maxLength / 2));
    if (prefix.length + remaining.length <= maxLength - INDICATOR_RESERVE) {
      let last = prefix + remaining;
      if (carryLang !== null && fenceStateAfter(remaining, true, carryLang)[0]) last += FENCE_CLOSE;
      chunks.push(last);
      break;
    }
    const region = remaining.slice(0, headroom);
    let splitAt = region.lastIndexOf("\n");
    if (splitAt < Math.floor(headroom / 2)) splitAt = region.lastIndexOf(" ");
    if (splitAt < 1) splitAt = Math.max(1, headroom);
    const body = remaining.slice(0, splitAt);
    remaining = remaining.slice(splitAt).trimStart();
    const [inCode, lang] = fenceStateAfter(body, carryLang !== null, carryLang ?? "");
    carryLang = inCode ? lang : null;
    chunks.push(prefix + body + (inCode ? FENCE_CLOSE : ""));
  }
  return chunks.length > 1 ? chunks.map((c, i) => `${c} (${i + 1}/${chunks.length})`) : chunks;
}
