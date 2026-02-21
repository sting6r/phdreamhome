import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { safeUrl, anon } from "./supabase";

export async function createServerSideClient() {
  const cookieStore = await cookies();

  return createServerClient(safeUrl, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
    cookieOptions: {
      name: 'sb-phdreamhome-auth-token',
    },
  });
}
