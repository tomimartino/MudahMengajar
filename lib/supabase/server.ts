import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "@/types/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
            // Dipanggil dari Server Component — session di-refresh oleh proxy.
          }
        },
      },
    }
  );
}

// React cache is scoped to one server render; credentials never cross requests.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  return supabase.from("profiles").select("*").eq("id", userId).single();
});

export const getCurrentSettings = cache(async (userId: string) => {
  const supabase = await createClient();
  return supabase.from("settings").select("*").eq("user_id", userId).single();
});

export const getAccountAccess = cache(async () => {
  const supabase = await createClient();
  return supabase.rpc("get_account_access");
});
