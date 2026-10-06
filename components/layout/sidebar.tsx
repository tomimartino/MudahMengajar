"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  BookOpen,
  FileBarChart,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { Logo } from "@/components/shared/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  BookOpen,
  FileBarChart,
  Wallet,
  ReceiptText,
  BadgeCheck,
  Settings,
};

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      data-ui="sidebar"
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border/60 bg-sidebar transition-all duration-200 print:hidden md:flex",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className={cn("flex h-20 items-center px-5", collapsed && "justify-center px-2")}>
        {collapsed ? (
          <Link href="/dashboard" aria-label="MudahMengajar" className="flex size-10 items-center justify-center rounded-xl bg-mint text-primary">
            <span className="text-sm font-bold">M</span>
          </Link>
        ) : (
          <Link href="/dashboard">
            <Logo />
          </Link>
        )}
      </div>

      <nav aria-label="Navigasi utama" className="flex-1 space-y-2 overflow-y-auto px-3 py-5">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                active
                  ? "bg-sidebar-accent font-semibold text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <button
        onClick={onToggle}
        className="m-3 flex min-h-11 items-center justify-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
        {!collapsed && <span>Ciutkan</span>}
      </button>
    </aside>
  );
}
