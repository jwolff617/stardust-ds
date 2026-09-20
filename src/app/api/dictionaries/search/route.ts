import { createClient } from "@/lib/supabase/server";
import { findPersonalInstance } from "@/lib/personal-instance";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const supabase = await createClient();

  let query = supabase
    .from("dictionaries")
    .select("id, address, name, description, kind, scope, locked, default_opt_in")
    .neq("kind", "instance")
    .order("locked", { ascending: false })
    .order("name");

  if (q) query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`);

  const { data: dictionaries, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let optedInIds = new Set<string>();
  if (user) {
    const { data: userDictionaries } = await supabase
      .from("user_dictionaries")
      .select("dictionary_id")
      .eq("opted_in", true);
    optedInIds = new Set((userDictionaries ?? []).map((row) => row.dictionary_id));
  }

  const results = await Promise.all(
    (dictionaries ?? []).map(async (d) => {
      // A template dictionary (e.g. Night DS) has no opt-in state of its own --
      // it resolves to the caller's own personal instance, if any.
      if (d.kind === "instance_template") {
        const instance = user ? await findPersonalInstance(supabase, user.id, d.id) : null;
        return {
          ...d,
          instance,
          optedIn: instance ? optedInIds.has(instance.id) : false,
        };
      }
      return {
        ...d,
        instance: null,
        optedIn: user ? optedInIds.has(d.id) : d.default_opt_in,
      };
    }),
  );

  return Response.json({ dictionaries: results });
}
