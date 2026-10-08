"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Building2, HeartHandshake, LayoutDashboard, Menu, MessageSquare, Settings, ShieldCheck, Users, Wallet } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";
import type { AdminRole } from "@/types/admin.types";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/accounts", label: "Akun Guru", icon: Users },
  { href: "/admin/reviews", label: "Review", icon: MessageSquare },
  { href: "/admin/tickets", label: "Dukungan", icon: HeartHandshake },
  { href: "/admin/services", label: "Layanan", icon: ShieldCheck },
  { href: "/admin/announcements", label: "Pengumuman", icon: Bell },
  { href: "/admin/reports", label: "Laporan", icon: BarChart3 },
  { href: "/admin/expenses", label: "Keuangan Website", icon: Wallet, owner: true },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings, owner: true },
] as const;

export function AdminShell({ children, role, email }: { children: React.ReactNode; role: AdminRole; email: string }) {
  const pathname = usePathname();
  const [open,setOpen]=useState(false);
  const links = <nav aria-label="Navigasi admin" className="space-y-1">{ITEMS.filter(i => !("owner" in i) || role === "owner").map(({ href,label,icon: Icon }) => (
    <Link key={href} href={href} onClick={()=>setOpen(false)} aria-current={pathname===href?"page":undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",pathname===href?"bg-primary/10 text-primary":"text-muted-foreground hover:bg-accent")}><Icon className="size-4" />{label}</Link>
  ))}</nav>;
  return <div className="min-h-svh bg-background">
    <aside data-ui="sidebar" className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card p-5 lg:flex">
      <Link href="/admin"><Logo /></Link><div className="my-6 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Building2 className="size-4" />Portal Admin</div>
      {links}<Button asChild variant="outline" className="mt-auto"><Link href="/dashboard">Portal Guru</Link></Button>
    </aside>
    <div className="lg:pl-60">
      <header data-ui="topbar" className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3"><Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="outline" size="icon" className="lg:hidden" aria-label="Buka menu admin"><Menu className="size-4" /></Button></SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto px-5" aria-describedby={undefined}><SheetHeader><SheetTitle>Portal Admin</SheetTitle></SheetHeader>{links}<Button asChild variant="outline" className="mt-6 w-full"><Link href="/dashboard">Portal Guru</Link></Button></SheetContent></Sheet>
          <span className="text-sm font-semibold">{role==="owner"?"Pemilik Website":"Dukungan Pengguna"}</span>
        </div><UserMenu name="Admin" email={email} isAdmin />
      </header>
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
