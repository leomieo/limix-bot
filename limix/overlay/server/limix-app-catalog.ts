// Limix Bot: apps the catalog never offers, because Limix Bot reaches that service its own way (the Telegram bot
// connection), so a second Telegram entry would only confuse which one a bot uses.
const HIDDEN = new Set(["telegram"]);

export const limixAppHidden = (slug: unknown): boolean => typeof slug === "string" && HIDDEN.has(slug.toLowerCase());

export function withoutLimixHiddenApps<Catalog extends { cards: ReadonlyArray<{ slug: string }> }>(catalog: Catalog): Catalog {
  return { ...catalog, cards: catalog.cards.filter((card) => !limixAppHidden(card.slug)) };
}
