import { createClient } from "@supabase/supabase-js";

// Supabase's free plan pauses a project after ~7 days with no activity.
// Vercel Cron hits this once a day (see vercel.json) to keep it awake.
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { error } = await supabase.from("dictionaries").select("id").limit(1);
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
