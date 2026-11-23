import type { NounDef } from "../engine";
import { dictionaryNoun, profileFieldNoun, termNoun } from "./core";
import { noteNoun } from "./night-ds";
import { basicNouns } from "./basics";
import { organizationNoun, profileEntryNoun } from "./profile";
import { wordListNoun } from "./word-list";
import { wordNoun } from "./word";

// Every registered noun. A new dictionary adds its nouns here and Sage AI
// can use them, with no new tools.
export const NOUNS: NounDef[] = [
  dictionaryNoun,
  termNoun,
  profileFieldNoun,
  profileEntryNoun,
  organizationNoun,
  wordListNoun,
  wordNoun,
  noteNoun,
  ...basicNouns,
];
