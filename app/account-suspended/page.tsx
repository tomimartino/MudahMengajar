import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/settings/logout-button";
import { Button } from "@/components/ui/button";
import type { AccountAccess } from "@/types/admin.types";
export default async function SuspendedPage(){const db=await createClient();const {data}=await db.rpc("get_account_access");const access=data as unknown as AccountAccess|null;
  return <main className="mx-auto my-auto max-w-md space-y-4 p-8"><h1 className="text-2xl font-bold">{access?.status==="suspended"?"Akun Ditangguhkan":"Akses Belum Tersedia"}</h1>{access?.reason&&<p>{access.reason}</p>}<div className="flex gap-2"><Button asChild variant="outline"><Link href="/dashboard">Coba Lagi</Link></Button><LogoutButton/></div></main>;
}
