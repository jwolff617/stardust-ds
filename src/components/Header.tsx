import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
      <span className="text-lg font-semibold">Stardust DS</span>

      {user ? (
        <form action={signOut} className="flex items-center gap-3">
          <span className="text-sm text-neutral-600">{user.email}</span>
          <button type="submit" className="text-sm underline">
            Log out
          </button>
        </form>
      ) : (
        <Link href="/login" className="text-sm underline">
          Log in
        </Link>
      )}
    </header>
  );
}
