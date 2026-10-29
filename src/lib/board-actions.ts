import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoardConfig } from "./boards";

// Actions one board adds on top of the shared Posts ones (votes and
// comments on Idea Index, decisions on Idea House). Returns null when the
// action isn't one of this board's.
export async function boardAction(
  supabase: SupabaseClient,
  userId: string,
  config: BoardConfig,
  dictionaryId: string,
  body: Record<string, unknown>,
): Promise<Response | null> {
  void supabase;
  void userId;
  void config;
  void dictionaryId;
  void body;
  return null;
}
