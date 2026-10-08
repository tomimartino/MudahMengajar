import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext, readAdminData } from "@/lib/admin";
import { ADMIN_TITLES, AdminPageContent } from "@/components/admin/admin-pages";
import { AdminMfaGate } from "@/components/admin/mfa-gate";
import { Button } from "@/components/ui/button";
import type { AdminSection } from "@/types/admin.types";

export default async function AdminPage({params,searchParams}:{params:Promise<{section?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const [{section:parts},query,context]=await Promise.all([params,searchParams,getAdminContext()]);
  if(!context.user) redirect("/login?next=/admin");
  if(!context.access.role) return <div className="mx-auto max-w-lg space-y-4 p-8"><h1 className="text-2xl font-bold">Akses admin diperlukan</h1><Button asChild><Link href="/dashboard">Portal Guru</Link></Button></div>;
  if(!context.access.verified) return <AdminMfaGate/>;
  if(parts?.length&&parts.length>1)notFound();
  const section=(parts?.[0]??"dashboard") as AdminSection;
  if(!Object.prototype.hasOwnProperty.call(ADMIN_TITLES,section))notFound();
  if(context.access.role!=="owner"&&["expenses","settings","audit"].includes(section)) return <h1 className="text-xl font-semibold">Halaman ini khusus pemilik website.</h1>;
  const q=typeof query.q==="string"?query.q.slice(0,120):"";
  const status=typeof query.status==="string"?query.status:"all";
  const page=Math.min(100000,Math.max(1,Number.parseInt(String(query.page??"1"),10)||1));
  const data=await readAdminData(section,{q,status,page});
  return <AdminPageContent section={section} data={data} role={context.access.role} userId={context.user.id} q={q} status={status}/>;
}
