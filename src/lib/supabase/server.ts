import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server Components can't write cookies -- setAll there throws, which we
// swallow. Route Handlers and Server Actions can write, and that's the only
// place a session actually needs refreshing.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component -- no-op.
          }
        },
      },
    },
  );
}
