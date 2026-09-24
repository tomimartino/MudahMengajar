"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  Ellipsis,
  FileBarChart,
  LayoutDashboard,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { MOBILE_NAV_ITEMS, NAV_ITEMS } from "@/lib/constants";
import { Logo } from "@/components/shared/logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  BookOpen,
  FileBarChart,
  BadgeCheck,
  Settings,
};

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background md:hidden">
      <div className="grid grid-cols-5">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground">
              <Ellipsis className="size-5" />
              Lainnya
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle asChild>
                <div className="flex items-center justify-between">
                  <Logo />
                  <button onClick={() => setOpen(false)} aria-label="Tutup">
                    <X className="size-5 text-muted-foreground" />
                  </button>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2 py-4">
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
