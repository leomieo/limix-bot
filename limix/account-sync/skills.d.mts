export interface PortableSkill { owner: string; name: string; files: Array<{ path: string; text: string }> }
export function captureSkill(input: { owner: string; name: string; directory: string }, redact: (text: string) => string): PortableSkill;
export function stageSkills(snapshot: { format: string; version: number; team: unknown; skills: PortableSkill[] }, root: string): string;
