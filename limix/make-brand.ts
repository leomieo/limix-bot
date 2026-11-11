// Renders the Limix Bot mark (black/white "giao thoa anh sang": two overlapping rounded blocks, owner's choice
// 2026-11-11) and the Limi mascot sheet from the fork's generated body (body.json) and the shared face data.
import { writeFileSync } from "node:fs"
import { EXPRESSIONS, MOUTHS, FACE_CENTRE, MOUTH_STROKE, mouthFrame } from "/home/claude/src/OpenMausBot/src/components/cursor-face-data.ts"
import { readFileSync } from "node:fs"
const MASCOT_BODIES = { cursor: JSON.parse(readFileSync(new URL("./body.json", import.meta.url), "utf8")) }

const OUT = process.argv[2]
const body = MASCOT_BODIES.cursor
const ring = (r: [number, number][]) => "M" + r.map(p => p.join(" ")).join(" L") + " Z"
function mouth(rings: any, spec: number[]) {
  const f = mouthFrame(rings, spec)
  const ca = Math.cos(f.angle), sa = Math.sin(f.angle)
  const at = (lx: number, ly: number) => [f.x + lx * ca - ly * sa, f.y + lx * sa + ly * ca].map(n => n.toFixed(2)).join(" ")
  return `M${at(-spec[0], 0)} Q${at(0, spec[1] * 2)} ${at(spec[0], 0)}`
}
const anchor = (a: any) => `translate(${a.x} ${a.y}) scale(${a.scale}) translate(${-FACE_CENTRE[0]} ${-FACE_CENTRE[1]})`
export function mascot(id: string, expr: number, c1: string, c2: string, eye = "#FFFFFF") {
  const rings = EXPRESSIONS[expr]
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <g transform="${body.fit}">${body.body.replace(/\{\{GRADIENT\}\}/g, `url(#${id})`)}</g>
  <g transform="${anchor(body.anchor)}"><path d="${ring(rings[0])}" fill="${eye}"/><path d="${ring(rings[1])}" fill="${eye}"/>
  <path d="${mouth(rings, MOUTHS[expr])}" fill="none" stroke="${eye}" stroke-width="${MOUTH_STROKE}" stroke-linecap="round"/></g>`
}
const V = "-15 -15 258.541 258.541"
// The mark: where the two blocks overlap, the colour inverts (even-odd fill) - the blend that makes the light.
export const MARK_D = "M269 344H533C593 344 641 392 641 452V672C641 732 593 780 533 780H269C209 780 161 732 161 672V452C161 392 209 344 269 344ZM491 244H755C815 244 863 292 863 352V572C863 632 815 680 755 680H491C431 680 383 632 383 572V352C383 292 431 244 491 244Z"
const mark = (bg: string, ink: string, rx = 224) =>
  `<rect width="1024" height="1024" rx="${rx}" fill="${bg}"/><path fill="${ink}" fill-rule="evenodd" d="${MARK_D}"/>`
writeFileSync(`${OUT}/limix-mark.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${mark("#000000", "#FFFFFF")}</svg>`)
writeFileSync(`${OUT}/limix-mark-light.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${mark("#FFFFFF", "#000000")}</svg>`)
const exprs = [0, 6, 1, 2, 11, 17]
const colors: [string, string, string][] = [["#FFFFFF", "#D4D4D8", "#000000"], ["#3F3F46", "#000000", "#FFFFFF"], ["#F4F4F5", "#71717A", "#000000"],
  ["#67E8F9", "#0E7490", "#FFFFFF"], ["#86EFAC", "#15803D", "#FFFFFF"], ["#F9A8D4", "#BE185D", "#FFFFFF"]]
const cell = 200
let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="860" viewBox="0 0 1400 860" font-family="Inter, Segoe UI, sans-serif">
<rect width="1400" height="860" fill="#0A0A0A"/>
<g transform="translate(70 70) scale(0.2246)">${mark("#FFFFFF", "#000000")}</g>
<text x="340" y="170" fill="#FAFAFA" font-size="92" font-weight="700" letter-spacing="-3">Limix Bot</text>
<text x="344" y="226" fill="#A1A1AA" font-size="28">Ánh sáng · Vô hạn · Pha trộn — Leox ৹ Limix AI</text>
<text x="70" y="380" fill="#71717A" font-size="18" letter-spacing="3">LINH VẬT “LIMI” — BIỂU CẢM</text>`
exprs.forEach((e, i) => { sheet += `<g transform="translate(${70 + i * 215} 410)"><rect width="${cell}" height="${cell}" rx="28" fill="#18181B"/><svg x="20" y="20" width="160" height="160" viewBox="${V}">${mascot("e" + i, e, "#FFFFFF", "#D4D4D8", "#000000")}</svg></g>` })
sheet += `<text x="70" y="680" fill="#71717A" font-size="18" letter-spacing="3">MÀU CHO TỪNG BOT</text>`
colors.forEach((c, i) => { sheet += `<g transform="translate(${70 + i * 130} 705)"><svg width="110" height="110" viewBox="${V}">${mascot("c" + i, [0, 6, 11, 0, 17, 1][i], c[0], c[1], c[2])}</svg></g>` })
sheet += `<g transform="translate(900 705) scale(0.1074)">${mark("#FFFFFF", "#000000")}</g>
<g transform="translate(1030 705) scale(0.1074)"><rect width="1024" height="1024" rx="224" fill="#27272A"/><path fill="#FFFFFF" fill-rule="evenodd" d="${MARK_D}"/></g>
<text x="1160" y="752" fill="#A1A1AA" font-size="16">Biểu tượng ứng dụng</text><text x="1160" y="776" fill="#A1A1AA" font-size="16">trên nền sáng / tối</text></svg>`
writeFileSync(`${OUT}/limix-brand-sheet.svg`, sheet)
