import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { AdminShell } from "@/components/admin/admin-shell";
export const metadata: Metadata={title:"Portal Admin",robots:{index:false,follow:false}};
export default async function AdminLayout({children}:{children:React.ReactNode}){
  const {user,access}=await getAdminContext();if(!user)redirect("/login?next=/admin");
  return access.role?<AdminShell role={access.role} email={user.email??""}>{children}</AdminShell>:children;
}
