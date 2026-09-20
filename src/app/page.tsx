import { Header } from "@/components/Header";
import { StardustApp } from "@/components/StardustApp";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <StardustApp isLoggedIn={Boolean(user)} />
    </div>
  );
}
