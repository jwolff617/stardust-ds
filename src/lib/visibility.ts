// Every thing has one visibility, always the same, so nobody has to think
// about it: public things anyone can read, group things only members,
// private things only you.
export const VISIBILITY_OF: Record<string, "public" | "members" | "private"> = {
  idea: "public",
  "idea-entry": "public",
  org: "public",
  organization: "public",
  resource: "public",
  profile: "public",
  person: "public",
  job: "public",
  noun: "public",
  verb: "public",
  word: "public",
  group: "members",
  journal: "private",
  notes: "private",
  note: "private",
  mine: "private",
  inbox: "private",
  settings: "private",
};

export function visibilityOf(kind: string): string {
  return VISIBILITY_OF[kind] ?? "";
}
