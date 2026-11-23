import type { NounDef } from "../engine";
import { dictionaryNoun, profileFieldNoun, termNoun } from "./core";
import { noteNoun } from "./night-ds";
import { activityNoun, lessonNoun, themeNoun } from "./after-school";
import { basicNouns } from "./basics";
import { builtDictionaryNoun, builtEntryNoun } from "./custom";
import { organizationNoun, profileEntryNoun } from "./profile";

// Every registered noun. A new dictionary adds its nouns here and Sage AI
// can use them, with no new tools.
export const NOUNS: NounDef[] = [
  dictionaryNoun,
  termNoun,
  profileFieldNoun,
  profileEntryNoun,
  organizationNoun,
  noteNoun,
  lessonNoun,
  themeNoun,
  activityNoun,
  ...basicNouns,
  builtDictionaryNoun,
  builtEntryNoun,
];
