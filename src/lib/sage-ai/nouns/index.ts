import type { NounDef } from "../engine";
import { dictionaryNoun, profileFieldNoun, termNoun } from "./core";
import { noteNoun } from "./night-ds";
import { activityNoun, lessonNoun, themeNoun } from "./after-school";
import { betStoryNoun, entryNoun, worthyEntryNoun } from "./accounts-worthy";

// Every registered noun. A new dictionary adds its nouns here (and later,
// from the database) and Sage AI can use them, with no new tools.
export const NOUNS: NounDef[] = [
  dictionaryNoun,
  termNoun,
  profileFieldNoun,
  noteNoun,
  lessonNoun,
  themeNoun,
  activityNoun,
  entryNoun,
  worthyEntryNoun,
  betStoryNoun,
];
