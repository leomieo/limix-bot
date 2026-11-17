import { MASCOT_BODY_IDS, type MascotBodyId } from "./mascot-bodies.ts";
import type { MausColor } from "./wire.ts";

export const TEMPLATE_MASCOT_COLORS = ["green", "blue", "red", "orange", "purple", "cyan", "pink", "yellow", "teal", "coral"] as const satisfies readonly MausColor[];
export const TEMPLATE_MASCOT_EXPRESSIONS = ["idle", "happy", "curious"] as const;
export type TemplateMascotExpression = typeof TEMPLATE_MASCOT_EXPRESSIONS[number];
export interface TemplateMascotLook {
  color: MausColor;
  mascotBody: MascotBodyId;
  mascotExpression?: TemplateMascotExpression;
}

export const TEMPLATE_MASCOTS = MASCOT_BODY_IDS.flatMap(mascotBody =>
  TEMPLATE_MASCOT_COLORS.flatMap(color => TEMPLATE_MASCOT_EXPRESSIONS.map(mascotExpression => ({
    id: `limix-${mascotBody}-${color}-${mascotExpression}`,
    color, mascotBody, mascotExpression,
  }))),
);

export function templateMascot(id: string): TemplateMascotLook {
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const { color, mascotBody, mascotExpression } = TEMPLATE_MASCOTS[hash % TEMPLATE_MASCOTS.length]!;
  return { color, mascotBody, mascotExpression };
}

export function templateMascotById(id: string): TemplateMascotLook | undefined {
  const entry = TEMPLATE_MASCOTS.find(entry => entry.id === id);
  if (!entry) return undefined;
  const { color, mascotBody, mascotExpression } = entry;
  return { color, mascotBody, mascotExpression };
}
