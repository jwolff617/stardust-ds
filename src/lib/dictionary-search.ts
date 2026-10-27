import type { SupabaseClient } from "@supabase/supabase-js";

export const PUBLIC_PROFILE_ADDRESS = "public-profile";

export type DictionaryInstance = { id: string; name: string; displayKind: string };

export type DictionarySearchResult = {
  id: string;
  address: string;
  name: string;
  description: string | null;
  kind: string;
  scope: string;
  locked: boolean;
  default_opt_in: boolean;
  instance: DictionaryInstance | null;
  optedIn: boolean;
  // The dictionary the label editor writes to: the caller's own instance for
  // a template, the dictionary itself if the caller owns it, else null.
  labelTargetId: string | null;
  // Labels set by whoever made the dictionary (read-only here), and the
  // caller's own labels on labelTargetId (editable).
  labels: string[];
  ownLabels: string[];
  // Another spark's Public Profile, found through search.
  isOtherProfile: boolean;
  displayKind: string;
};

type DictionaryRow = {
  id: string;
  address: string;
  name: string;
  description: string | null;
  kind: string;
  scope: string;
  locked: boolean;
  default_opt_in: boolean;
  owner_user_id: string | null;
  template_id: string | null;
  display_kind: string;
};

const DICTIONARY_COLUMNS =
  "id, address, name, description, kind, scope, locked, default_opt_in, owner_user_id, template_id, display_kind";

// Labels are lowercase words, 1 to 40 characters. Same rule as the
// dictionary_labels check constraint.
export function normalizeLabel(raw: string): string | null {
  const label = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (label.length < 1 || label.length > 40) return null;
  return label;
}

// PostgREST filter strings treat commas, parentheses, and % specially, so
// they are stripped from user text before it goes into an .or() filter.
function sanitize(q: string): string {
  return q.replace(/[,()%*\\]/g, " ").trim();
}

// Finds dictionaries by name, address, description, or label. With no
// query, lists every shared dictionary and template. With a query, also
// finds other sparks' Public Profiles (signed-in callers only; RLS hides
// them from everyone else). The caller's own instances never appear on
// their own: each shows up through its template.
export async function searchDictionaries(
  supabase: SupabaseClient,
  rawQuery: string,
  userId: string | null,
): Promise<DictionarySearchResult[]> {
  const q = sanitize(rawQuery);

  const matchedIds = new Set<string>();
  let query = supabase
    .from("dictionaries")
    .select(DICTIONARY_COLUMNS)
    .order("locked", { ascending: false })
    .order("name");

  if (q) {
    const { data: labelRows } = await supabase
      .from("dictionary_labels")
      .select("dictionary_id")
      .ilike("label", `%${q}%`);
    for (const row of labelRows ?? []) matchedIds.add(row.dictionary_id);

    const filters = [`name.ilike.%${q}%`, `address.ilike.%${q}%`, `description.ilike.%${q}%`];
    if (matchedIds.size > 0) filters.push(`id.in.(${[...matchedIds].join(",")})`);
    query = query.or(filters.join(","));
  } else {
    // Shared dictionaries and templates, plus groups you're in (RLS hides
    // groups you aren't in).
    query = query.or("kind.neq.instance,scope.eq.group");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DictionaryRow[];

  // A label match on the caller's own instance surfaces its template.
  const ownInstanceMatchTemplateIds = new Set(
    rows
      .filter((d) => d.kind === "instance" && d.owner_user_id === userId && d.template_id)
      .map((d) => d.template_id as string),
  );

  let templateRows: DictionaryRow[] = [];
  const missingTemplateIds = [...ownInstanceMatchTemplateIds].filter(
    (id) => !rows.some((d) => d.id === id),
  );
  if (missingTemplateIds.length > 0) {
    const { data: extra } = await supabase
      .from("dictionaries")
      .select(DICTIONARY_COLUMNS)
      .in("id", missingTemplateIds);
    templateRows = (extra ?? []) as DictionaryRow[];
  }

  const { data: publicProfileTemplate } = await supabase
    .from("dictionaries")
    .select("id")
    .eq("address", PUBLIC_PROFILE_ADDRESS)
    .maybeSingle();

  const visible = [...rows, ...templateRows].filter((d) => {
    if (d.kind !== "instance") return true;
    if (d.scope === "group") return true;
    return (
      Boolean(userId) &&
      d.owner_user_id !== userId &&
      d.template_id === publicProfileTemplate?.id
    );
  });

  // The caller's own instances, keyed by template.
  const instanceByTemplate = new Map<string, DictionaryInstance>();
  if (userId) {
    const templateIds = visible.filter((d) => d.kind === "instance_template").map((d) => d.id);
    if (templateIds.length > 0) {
      const { data: instances } = await supabase
        .from("dictionaries")
        .select("id, name, display_kind, template_id")
        .eq("owner_user_id", userId)
        .eq("scope", "personal")
        .in("template_id", templateIds);
      for (const i of instances ?? []) {
        instanceByTemplate.set(i.template_id, {
          id: i.id,
          name: i.name,
          displayKind: i.display_kind,
        });
      }
    }
  }

  let optedInIds = new Set<string>();
  if (userId) {
    const { data: userDictionaries } = await supabase
      .from("user_dictionaries")
      .select("dictionary_id")
      .eq("opted_in", true);
    optedInIds = new Set((userDictionaries ?? []).map((row) => row.dictionary_id));
  }

  // Labels shown per row: the template's own plus the caller's instance's.
  const labelSourceIds = new Set<string>();
  for (const d of visible) {
    labelSourceIds.add(d.id);
    const instance = instanceByTemplate.get(d.id);
    if (instance) labelSourceIds.add(instance.id);
  }
  const labelsById = new Map<string, string[]>();
  if (labelSourceIds.size > 0) {
    const { data: labelRows } = await supabase
      .from("dictionary_labels")
      .select("dictionary_id, label")
      .in("dictionary_id", [...labelSourceIds])
      .order("label");
    for (const row of labelRows ?? []) {
      const list = labelsById.get(row.dictionary_id) ?? [];
      list.push(row.label);
      labelsById.set(row.dictionary_id, list);
    }
  }

  return visible.map((d) => {
    const instance = instanceByTemplate.get(d.id) ?? null;
    const isOtherProfile = d.kind === "instance" && d.scope !== "group";
    const labelTargetId = instance?.id ?? (userId && d.owner_user_id === userId ? d.id : null);
    const ownLabels = labelTargetId ? labelsById.get(labelTargetId) ?? [] : [];
    const labels = labelTargetId === d.id ? [] : labelsById.get(d.id) ?? [];

    let optedIn: boolean;
    if (d.kind === "instance_template") optedIn = instance ? optedInIds.has(instance.id) : false;
    else optedIn = userId ? optedInIds.has(d.id) : d.default_opt_in;

    return {
      id: d.id,
      address: d.address,
      name: d.name,
      description: d.description,
      kind: d.kind,
      scope: d.scope,
      // Locks protect your own always-on dictionaries. Another spark's
      // profile is yours to add or remove.
      locked: isOtherProfile ? false : d.locked,
      default_opt_in: d.default_opt_in,
      instance,
      optedIn,
      labelTargetId,
      labels,
      ownLabels,
      isOtherProfile,
      displayKind: instance?.displayKind ?? d.display_kind,
    };
  });
}
