import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, parse, relative, sep } from "node:path";
import { z } from "zod";
import { writeFileAtomic } from "./atomic.ts";

export const VM_PROJECT_FOLDER = "/home/cua/project";

const grantsSchema = z.array(z.object({
  scope: z.string(),
  folder: z.string(),
  bots: z.array(z.string()),
}));
export type VmWorkingFolderGrant = z.infer<typeof grantsSchema>[number];

export function createVmWorkingFolders(dataDir: string) {
  const file = join(dataDir, "vm-working-folders.json");
  let grants: VmWorkingFolderGrant[] = [];
  try {
    grants = grantsSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return {
    scope: (scope: string) => grants.find((grant) => grant.scope === scope),
    forBot: (bot: string) => grants.find((grant) => grant.bots.includes(bot)),
    save(scope: string, grant?: VmWorkingFolderGrant) {
      const next = grants.filter((entry) => entry.scope !== scope);
      if (grant) next.push(grant);
      writeFileAtomic(file, JSON.stringify(next), { mode: 0o600 });
      grants = next;
    },
  };
}

function contains(parent: string, child: string): boolean {
  const remainder = relative(parent, child);
  return !isAbsolute(remainder) && remainder !== ".." && !remainder.startsWith(`..${sep}`);
}

export function validatedVmWorkingFolder(folder: string, dataDir: string): string {
  const real = realpathSync(folder);
  const data = realpathSync(dataDir);
  if (!lstatSync(real).isDirectory() || real === parse(real).root ||
      contains(real, data) || contains(data, real) || /[,\r\n]/u.test(real)) {
    throw new Error("Choose a dedicated project folder outside Limix Bot's data, with no comma or newline in its path.");
  }
  return real;
}
