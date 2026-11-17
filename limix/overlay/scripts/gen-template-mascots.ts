import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { TEMPLATE_MASCOTS } from "../shared/template-mascot.ts";
import { MASCOT_BODIES } from "../shared/mascot-bodies.ts";
import { EXPRESSIONS, FACE_CENTRE, VISOR } from "../src/components/cursor-face-data.ts";

const output = fileURLToPath(new URL("../public/template-mascots/", import.meta.url));
const check = process.argv.includes("--check");
const colors = { green: "#009957", blue: "#377FE6", red: "#D94B52", orange: "#E78531", purple: "#8057C8", cyan: "#0EA5C6", pink: "#D84F8B", yellow: "#D8A729", teal: "#01A492", coral: "#E5634E" };
const expressions = { idle: 6, happy: 19, curious: 21 };
function mix(hex: string, target: number, amount: number) {
  const rgb = parseInt(hex.slice(1), 16);
  return "#" + [16, 8, 0].map(shift => Math.round(((rgb >> shift) & 255) * (1 - amount) + target * amount).toString(16).padStart(2, "0")).join("");
}
function save(name: string, value: string) {
  const path = join(output, name);
  if (check) {
    if (readFileSync(path, "utf8").replaceAll("\r\n", "\n") !== value) throw new Error(`Regenerate mascot asset: ${name}`);
  } else writeFileSync(path, value, "utf8");
}
if (!check) mkdirSync(output, { recursive: true });
for (const icon of TEMPLATE_MASCOTS) {
  const body = MASCOT_BODIES[icon.mascotBody];
  const fill = colors[icon.color];
  const eyes = EXPRESSIONS[expressions[icon.mascotExpression]]!.map(ring => `<polygon points="${ring.map(point => point.join(",")).join(" ")}"/>`).join("");
  save(`${icon.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -15 258.541 258.541" width="256" height="256" role="img" aria-labelledby="title"><title id="title">${icon.id}</title><defs><radialGradient id="body" cx=".36" cy=".3" r=".82" fx=".32" fy=".22"><stop stop-color="${mix(fill, 255, .55)}"/><stop offset=".45" stop-color="${fill}"/><stop offset="1" stop-color="${mix(fill, 0, .42)}"/></radialGradient><linearGradient id="visor" x2="0" y2="1"><stop stop-color="#24333F"/><stop offset="1" stop-color="#05090D"/></linearGradient><clipPath id="shape" transform="${body.fit}">${body.clip}</clipPath><clipPath id="face"><rect x="${VISOR.x}" y="${VISOR.y}" width="${VISOR.w}" height="${VISOR.h}" rx="${VISOR.r}"/></clipPath></defs><g transform="${body.fit}">${body.body.replaceAll("{{GRADIENT}}", "url(#body)")}</g><g clip-path="url(#shape)"><g transform="translate(${body.anchor.x} ${body.anchor.y}) scale(${body.anchor.scale}) translate(${-FACE_CENTRE[0]} ${-FACE_CENTRE[1]})"><rect x="${VISOR.x}" y="${VISOR.y}" width="${VISOR.w}" height="${VISOR.h}" rx="${VISOR.r}" fill="url(#visor)" stroke="#fff" stroke-opacity=".12" stroke-width="2"/><g clip-path="url(#face)" fill="${mix(fill,255,.62)}"><g transform="translate(120 122.5) scale(1.12) translate(-120 -122.5)">${eyes}</g></g></g></g></svg>\n`);
}
const catalog = { version: 1, count: TEMPLATE_MASCOTS.length, icons: TEMPLATE_MASCOTS.map(icon => ({ ...icon, file: `${icon.id}.svg` })) };
save("catalog.json", JSON.stringify(catalog, null, 2) + "\n");
save("index.html", `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Limix · 300 mascot icons</title><style>*{box-sizing:border-box}body{margin:0;background:#111114;color:#eee;font:16px system-ui;padding:32px}header{max-width:1000px;margin:auto auto 28px}h1{font-size:32px}p{color:#aaa;line-height:1.6}input,button{padding:12px 16px;background:#25252b;color:inherit;border:1px solid #555;border-radius:12px}input{width:min(100%,440px)}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}a{display:flex;align-items:center;flex-direction:column;background:#202025;padding:16px 8px;border:1px solid #35353b;border-radius:18px;text-decoration:none;color:inherit;font-size:12px;text-align:center;overflow-wrap:anywhere}a:hover{border-color:#b69cff}img{width:96px;height:96px;margin:8px}body.light{background:#fafafa;color:#222}.light a,.light input,.light button{background:#fff}small{display:block;color:#999;margin-top:4px}</style><header><h1>Kho linh vật Limix · 300 icons</h1><p>10 hình dáng × 10 màu × 3 biểu cảm. Bấm biểu tượng để tải SVG nền trong suốt.<br>10 shapes × 10 colors × 3 expressions. Select an icon to download its transparent SVG.</p><input id="search" aria-label="Tìm icon / Search icons" placeholder="Tìm màu, hình dáng, biểu cảm / Search…"> <button id="theme">Sáng / Tối · Light / Dark</button><p id="count"></p></header><main id="grid"></main><script>const icons=${JSON.stringify(catalog.icons)};const grid=document.getElementById('grid');function show(){const query=document.getElementById('search').value.toLowerCase();const selected=icons.filter(i=>i.id.includes(query));grid.replaceChildren(...selected.map(i=>{const a=document.createElement('a');a.href=i.file;a.download=i.file;const img=document.createElement('img');img.src=i.file;img.alt=i.id;const label=document.createElement('span');label.textContent=i.id;a.append(img,label);return a}));document.getElementById('count').textContent=selected.length+' / 300'}document.getElementById('search').oninput=show;document.getElementById('theme').onclick=()=>document.body.classList.toggle('light');show();</script></html>\n`);
if (readdirSync(output).filter(name => name.endsWith(".svg")).length !== 300) throw new Error("Expected exactly 300 SVG icons");
console.log(`${check ? "Verified" : "Generated"} 300 mascot SVGs, catalog and preview`);
