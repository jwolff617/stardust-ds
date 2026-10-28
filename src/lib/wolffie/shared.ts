// Wolffie Games types and limits, safe to load in the browser.

export type Activity = { title: string; need: string[]; steps: string[]; tip: string };

export const CUTOUTS = ["helicopter", "bracelet", "badge"] as const;
export const COLORING = ["mandala", "octopus", "bee"] as const;

export type PacketContent = {
  title: string;
  craft: Activity;
  joke: { q: string; a: string };
  riddle: { q: string; a: string };
  game: Activity & { where: string };
  cutout: Activity & { template: (typeof CUTOUTS)[number]; badgeLabel: string };
  coloring: { template: (typeof COLORING)[number]; title: string; how: string };
  wordsearch: { title: string; words: string[] };
  fact: string;
  seed: number;
};

export type Packet = {
  id: string;
  themes: string[];
  kids: number;
  age: number;
  content: PacketContent;
  createdAt: string;
};

export const AGES = { min: 3, max: 14 };

// Age to the grade numbers printables.js sizes pages by: 5 is K (0), 4 is PreK (-1).
export const gradeOf = (age: number) => Math.max(-1, Math.min(8, age - 5));
