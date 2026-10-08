"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  Library,
  ClipboardList,
  Ellipsis,
  FileBarChart,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { MOBILE_NAV_ITEMS, NAV_ITEMS } from "@/lib/constants";
import { Logo } from "@/components/shared/logo";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  BookOpen,
  Library,
  ClipboardList,
  FileBarChart,
  Wallet,
  ReceiptText,
  BadgeCheck,
  Settings,
};

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav data-ui="mobile-nav" aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-border/70 bg-card/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-soft backdrop-blur md:hidden print:hidden">
      <div className="grid grid-cols-6 gap-0.5">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center gap-1.5 rounded-xl py-2 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                active ? "bg-mint font-semibold text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex min-h-12 flex-col items-center gap-1.5 rounded-xl py-2 text-[10px] font-medium text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
              <Ellipsis className="size-5" />
              Lainnya
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" showCloseButton={false} className="max-h-[80vh] overflow-y-auto rounded-t-3xl">
            <SheetHeader>
              <SheetTitle asChild>
                <div className="flex items-center justify-between">
                  <Logo />
                  <button onClick={() => setOpen(false)} aria-label="Tutup" className="flex size-10 items-center justify-center rounded-xl hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                    <X className="size-5 text-muted-foreground" />
                  </button>
                </div>
              </SheetTitle>
              <SheetDescription className="sr-only">Pilih halaman yang ingin dibuka.</SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
              {NAV_ITEMS.map((item) => {
                const Icon = ICONS[item.icon];
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <Icon className="size-6" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
