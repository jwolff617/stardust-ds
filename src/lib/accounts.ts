// Accounts DS: nine Stardust words as accounts, in three groups, from the
// Matrix up to Imagination. Safe to import from client and server.

export const ACCOUNT_GROUPS = [
  { group: "Matrix", accounts: ["Savings", "Home", "Avatar"] },
  { group: "Life", accounts: ["Friends", "Community", "Hobbies"] },
  { group: "Imagination", accounts: ["Ideas", "Reflections", "Memories"] },
] as const;

export type AccountName = (typeof ACCOUNT_GROUPS)[number]["accounts"][number];

export const ACCOUNTS: readonly AccountName[] = ACCOUNT_GROUPS.flatMap((g) => g.accounts);

export function isAccountName(value: unknown): value is AccountName {
  return typeof value === "string" && (ACCOUNTS as readonly string[]).includes(value);
}
