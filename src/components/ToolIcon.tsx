// One simple symbol per tool, drawn in the WACK style: a few strokes, things
// people already know. Each tool always works the same, so it always looks
// the same.

const PATHS: Record<string, string> = {
  // a single leaf: notes live a day to a life, then let go
  note: "M50 86 C26 74 22 44 50 16 C78 44 74 74 50 86 Z M50 86 V40",
  notes: "M50 86 C26 74 22 44 50 16 C78 44 74 74 50 86 Z M50 86 V40",
  // an open book
  journal: "M50 28 C38 20 22 20 12 24 V80 C22 76 38 76 50 84 C62 76 78 76 88 80 V24 C78 20 62 20 50 28 Z M50 28 V84",
  // a sun rising: an idea coming up
  idea: "M18 72 H82 M30 72 A20 20 0 0 1 70 72 M50 26 V38 M24 42 L32 50 M76 42 L68 50",
  // three trees: people rooted together
  org: "M20 84 V58 M20 66 L10 52 M20 62 L30 48 M50 84 V40 M50 52 L36 32 M50 48 L64 28 M80 84 V58 M80 66 L70 52 M80 62 L90 48 M8 84 H92",
  // a body in its aura
  profile: "M50 76 V50 M50 58 L36 38 M50 54 L64 34 M50 28 a3 3 0 1 0 0.1 0 M50 10 A40 40 0 1 1 49.9 10",
  // a bowl: something to share
  resource: "M14 46 H86 C86 70 70 84 50 84 C30 84 14 70 14 46 Z M36 46 C36 36 44 30 50 30 C56 30 64 36 64 46",
  // two bodies side by side
  group: "M32 84 V54 M32 62 L20 44 M32 58 L44 40 M68 84 V54 M68 62 L56 44 M68 58 L80 40 M20 84 H80",
  // a bird carries word
  inbox: "M12 52 C28 36 40 40 50 54 C60 40 72 36 88 52 M50 54 V62",
  // a spiral: turning things to fit
  settings: "M50 50 m0 -6 a6 6 0 1 1 -6 6 a12 12 0 1 1 12 12 a20 20 0 1 1 -20 -20 a30 30 0 1 1 30 30",
  // a star: your favorites
  "my nouns": "M50 14 L59 40 L86 40 L64 56 L72 84 L50 67 L28 84 L36 56 L14 40 L41 40 Z",
  // a crescent over a horizon: a gathering at a set time
  event: "M14 74 H86 M50 74 V54 M38 62 L50 54 L62 62 M66 18 A16 16 0 1 0 66 50 A12 12 0 1 1 66 18 Z",
  // two flames leaning in: a match
  match: "M30 84 C18 80 18 62 28 50 C30 60 36 58 36 50 C38 42 34 36 40 28 C46 44 44 70 30 84 Z M70 84 C82 80 82 62 72 50 C70 60 64 58 64 50 C62 42 66 36 60 28 C54 44 56 70 70 84 Z",
  // a magnifier over lines: zoom into a word
  project: "M14 22 H50 M14 38 H40 M14 54 H34 M62 62 m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0 M75 75 L90 90",
  // a pebble: a plain noun of your own
  noun: "M22 60 C18 40 36 26 54 28 C74 30 86 46 80 62 C74 78 30 80 22 60 Z",
  mine: "M22 60 C18 40 36 26 54 28 C74 30 86 46 80 62 C74 78 30 80 22 60 Z",
};

export function ToolIcon({ tool, size = 16, className = "" }: { tool: string; size?: number; className?: string }) {
  const d = PATHS[tool];
  if (!d) return null;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
