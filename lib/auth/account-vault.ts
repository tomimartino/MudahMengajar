import "server-only";
import { cookies } from "next/headers";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { ACCOUNT_COOKIE, ACCOUNT_COOKIE_AGE, decodeAccounts, encodeAccounts, upsertAccount, type SavedAccount } from "@/lib/auth/account-vault-codec";

export async function readSavedAccounts() {
  return decodeAccounts((await cookies()).get(ACCOUNT_COOKIE)?.value);
}

export async function writeSavedAccounts(accounts: SavedAccount[]) {
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, accounts.length ? encodeAccounts(accounts) : "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: accounts.length ? ACCOUNT_COOKIE_AGE : 0,
  });
}

export function accountFromSession(session: Session): SavedAccount {
  return { id: session.user.id, email: session.user.email!, refreshToken: session.refresh_token };
}

export async function rememberActiveAccount(db: SupabaseClient<Database>) {
  const accounts = await readSavedAccounts();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user?.email) return accounts;
  // getSession is used only to copy tokens after getUser has authenticated the user.
  const { data: { session } } = await db.auth.getSession();
  if (!session || session.user.id !== user.id) return accounts;
  const next = upsertAccount(accounts, accountFromSession(session));
  await writeSavedAccounts(next);
  return next;
}
