"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  refreshRemindersAction,
} from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Notification } from "@/types/database.types";
import { cn } from "@/lib/utils";

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    await refreshRemindersAction();
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  async function handleClick(item: Notification) {
    if (!item.read_at) {
      await markNotificationReadAction(item.id);
    }
    setOpen(false);
    if (item.link) router.push(item.link);
    router.refresh();
  }

  async function handleMarkAll() {
    await markAllNotificationsReadAction();
    setItems((prev) => (prev ?? []).map((n) => ({ ...n, read_at: new Date().toISOString() })));
    router.refresh();
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifikasi">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1">
          <DropdownMenuLabel>Notifikasi</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAll}>
              <CheckCheck className="size-3.5" /> Tandai dibaca
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {items === null && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Memuat...</p>
          )}
          {items !== null && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Belum ada notifikasi.</p>
            </div>
          )}
          {items?.map((item) => (
            <button
              key={item.id}
              onClick={() => void handleClick(item)}
              className={cn(
                "block w-full px-3 py-2.5 text-left transition-colors hover:bg-muted",
                !item.read_at && "bg-primary/5"
              )}
            >
              <p className={cn("text-sm", item.read_at ? "font-normal text-foreground" : "font-semibold text-foreground")}>
                {item.title}
              </p>
              {item.body && (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: id })}
              </p>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
