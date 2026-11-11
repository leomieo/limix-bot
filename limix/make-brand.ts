// Renders the Limix Bot logo and mascot sheet from the fork's generated body and the shared face data.
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
const BRAND = ["#A78BFA", "#6D28D9"]
writeFileSync(`${OUT}/limix-mark.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${V}">${mascot("g", 0, BRAND[0], BRAND[1])}</svg>`)
const exprs = [0, 6, 1, 2, 11, 17]
const colors: [string, string][] = [["#A78BFA", "#6D28D9"], ["#67E8F9", "#0E7490"], ["#86EFAC", "#15803D"], ["#FDBA74", "#C2410C"], ["#F9A8D4", "#BE185D"], ["#CBD5E1", "#475569"]]
const cell = 200
let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="860" viewBox="0 0 1400 860" font-family="Inter, Segoe UI, sans-serif">
<rect width="1400" height="860" fill="#0B0B0C"/>
<g transform="translate(70 70)"><svg width="230" height="230" viewBox="${V}">${mascot("hero", 0, BRAND[0], BRAND[1])}</svg></g>
<text x="340" y="170" fill="#EDEDEE" font-size="92" font-weight="700" letter-spacing="-3">Limix Bot</text>
<text x="344" y="226" fill="#A1A1A8" font-size="28">Đội bot AI của bạn — Leox ৹ Limix AI</text>
<text x="70" y="380" fill="#75757D" font-size="18" letter-spacing="3">LINH VẬT “LIMI” — BIỂU CẢM</text>`
exprs.forEach((e, i) => { sheet += `<g transform="translate(${70 + i * 215} 410)"><rect width="${cell}" height="${cell}" rx="28" fill="#1B1B1D"/><svg x="20" y="20" width="160" height="160" viewBox="${V}">${mascot("e" + i, e, BRAND[0], BRAND[1])}</svg></g>` })
sheet += `<text x="70" y="680" fill="#75757D" font-size="18" letter-spacing="3">MÀU CHO TỪNG BOT</text>`
colors.forEach((c, i) => { sheet += `<g transform="translate(${70 + i * 130} 705)"><svg width="110" height="110" viewBox="${V}">${mascot("c" + i, [0, 6, 11, 0, 17, 1][i], c[0], c[1])}</svg></g>` })
sheet += `<g transform="translate(900 705)"><rect width="110" height="110" rx="26" fill="#FFFFFF"/><svg x="10" y="10" width="90" height="90" viewBox="${V}">${mascot("w", 0, BRAND[0], BRAND[1])}</svg></g>
<g transform="translate(1030 705)"><rect width="110" height="110" rx="26" fill="#6D28D9"/><svg x="10" y="10" width="90" height="90" viewBox="${V}">${mascot("p", 0, "#FFFFFF", "#E9D5FF", "#5B21B6")}</svg></g>
<text x="1160" y="752" fill="#A1A1A8" font-size="16">Biểu tượng ứng dụng</text><text x="1160" y="776" fill="#A1A1A8" font-size="16">trên nền sáng / tím</text></svg>`
writeFileSync(`${OUT}/limix-brand-sheet.svg`, sheet)
