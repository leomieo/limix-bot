// The Vietnamese bullets are also shown by desktop builds released before locale-aware highlights.
import { readFileSync } from "node:fs";

const version = process.argv[2];
const notes = readFileSync(new URL("../limix/docs/RELEASE_NOTES.md", import.meta.url), "utf8");
const sections = notes.replace(/\r\n/g, "\n").split(/(?=^Limix Bot \d+\.\d+\.\d+$)/m);
const section = sections.find(body => body.split("\n", 1)[0] === `Limix Bot ${version}`);
if (!section) throw new Error(`Missing release notes for Limix Bot ${version}`);
const english = section.indexOf("\n## English\n");
if (english < 0) throw new Error(`Missing English release notes for Limix Bot ${version}`);
const localized = section.slice(english).replace(/^-( .+)$/gm, ">$1\n");
process.stdout.write(section.slice(0, english) + localized.trimEnd() + "\n");
