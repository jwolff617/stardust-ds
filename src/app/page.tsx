import { Stardust } from "@/components/Stardust";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userName: string | null = null;
  let isModerator = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    // Without a display name, the part of the email before the @.
    userName = profile?.display_name?.trim() || user.email?.split("@")[0] || null;
    const { data: mod } = await supabase.rpc("is_moderator");
    isModerator = Boolean(mod);
  }

  return <Stardust isLoggedIn={Boolean(user)} userName={userName} isModerator={isModerator} />;
}
