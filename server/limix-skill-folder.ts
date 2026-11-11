// Limix Bot: skills kept in a folder on this computer (no internet needed). The folder is either one skill (it has a
// SKILL.md) or a folder of skills (each direct subfolder with a SKILL.md). Same limits and checks as a GitHub import:
// the files go through installSkill(), which scans them and leaves the skill switched off until the owner reads it.
import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";

import { planSkillFolder, type FolderEntry } from "./skill-folder.ts";
import type { FetchedSkill } from "./skill-fetch.ts";

const MAX_ENTRIES = 400;
const MAX_DEPTH = 8;

function listEntries(root: string): Array<FolderEntry & { absolute: string }> {
  const out: Array<FolderEntry & { absolute: string }> = [];
  const walk = (dir: string, prefix: string, depth: number) => {
    if (depth > MAX_DEPTH || out.length > MAX_ENTRIES) return;
    for (const name of readdirSync(dir)) {
      if (out.length > MAX_ENTRIES) return;
      const absolute = join(dir, name);
      const path = prefix ? `${prefix}/${name}` : name;
      const info = lstatSync(absolute);
      if (info.isSymbolicLink()) out.push({ path, kind: "link", size: 0, absolute });
      else if (info.isDirectory()) {
        out.push({ path, kind: "folder", size: 0, absolute });
        walk(absolute, path, depth + 1);
      } else if (info.isFile()) {
        out.push({ path, kind: "file", size: info.size, executable: process.platform !== "win32" && (info.mode & 0o111) !== 0, absolute });
      }
    }
  };
  walk(root, "", 1);
  return out;
}

function readOne(dir: string): FetchedSkill {
  const { take, skipped } = planSkillFolder(listEntries(dir));
  if (take[0]?.path !== "SKILL.md") throw new Error(`no SKILL.md in ${basename(dir)}`);
  const files = take
    .filter((entry) => entry.kind === "file")
    .map((entry) => ({ path: entry.path, content: readFileSync((entry as unknown as { absolute: string }).absolute), executable: entry.executable === true }));
  return { source: `local:${basename(dir)}`, files, skipped };
}

export function readLocalSkills(folder: string): { skills: FetchedSkill[] } | { error: string } {
  try {
    if (!isAbsolute(folder) || !statSync(folder).isDirectory()) return { error: "Choose a folder on this computer." };
    const dirs: string[] = [];
    const has = (dir: string) => { try { return statSync(join(dir, "SKILL.md")).isFile(); } catch { return false; } };
    if (has(folder)) dirs.push(folder);
    else for (const name of readdirSync(folder)) { const sub = join(folder, name); try { if (statSync(sub).isDirectory() && has(sub)) dirs.push(sub); } catch { /* skip unreadable */ } }
    if (!dirs.length) return { error: "No SKILL.md found in that folder or in its subfolders." };
    return { skills: dirs.slice(0, 50).map(readOne) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not read that folder." };
  }
}
