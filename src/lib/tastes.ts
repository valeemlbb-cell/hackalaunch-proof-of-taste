/**
 * The four tastes.
 *
 * The taste is not decoration around the transaction — it IS the thing minted.
 * Picking one re-themes the whole page and changes the token that lands in the
 * wallet: name, symbol, and an on-chain `taste` metadata field.
 */

export interface Taste {
  id: string;
  name: string;
  symbol: string;
  tagline: string;
  /** Rendered into the badge's on-chain metadata URI (a data URI, no server). */
  blurb: string;
}

export const TASTES: Taste[] = [
  {
    id: 'swiss',
    name: 'Swiss',
    symbol: 'TASTE',
    tagline: 'Grid, weight, silence.',
    blurb: 'Order as a moral position. Nothing decorative survives the grid.',
  },
  {
    id: 'brutal',
    name: 'Brutal',
    symbol: 'TASTE',
    tagline: 'Hard edges, no apology.',
    blurb: 'Structure left exposed on purpose. The seams are the ornament.',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    symbol: 'TASTE',
    tagline: 'Serif, column, air.',
    blurb: 'Reading as the primary interaction. Type does the arguing.',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    symbol: 'TASTE',
    tagline: 'Monospace and phosphor.',
    blurb: 'Every byte accounted for. The machine speaks in its own voice.',
  },
];

/**
 * Display name for a taste id read back off the chain. Never throws: a memo
 * written by somebody else can contain anything, and the receipt still has to
 * render.
 */
export function tasteLabel(id: string): string {
  return TASTES.find((t) => t.id === id)?.name ?? id;
}

export function tasteById(id: string): Taste {
  const found = TASTES.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown taste: ${id}`);
  return found;
}
