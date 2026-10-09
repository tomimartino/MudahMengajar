"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BookOpen, CalendarClock, CheckCheck, Inbox } from "lucide-react";
import { toast } from "sonner";
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
  const [count, setCount] = useState(unreadCount);
  const lastSync = useRef(0);
  const pendingSync = useRef<Promise<boolean> | null>(null);
  const readVersion = useRef(0);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const router = useRouter();

  const sync = useCallback((): Promise<boolean> => {
    if (pendingSync.current) return pendingSync.current;
    if (Date.now() - lastSync.current < 60_000) return Promise.resolve(true);
    const version = readVersion.current;
    const request = refreshRemindersAction().then((result) => {
      if (!result.ok) return false;
      lastSync.current = Date.now();
      if (version === readVersion.current) setCount(result.data ?? 0);
      return true;
    }).catch(() => false).finally(() => { pendingSync.current = null; });
    pendingSync.current = request;
    return request;
  }, []);

  useEffect(() => {
    // Update the badge after the page appears. Paused in background tabs.
    const refresh = () => { if (document.visibilityState === "visible") void sync(); };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [sync]);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      if (!await sync()) toast.error("Pengingat belum dapat diperbarui.");
      const supabase = createClient();
      const { data, error } = await supabase.from("notifications")
        .select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      setItems(data ?? []);
    } catch {
      setLoadError(true);
    }
  }, [sync]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  async function handleClick(item: Notification) {
    if (!item.read_at) {
      readVersion.current += 1;
      const result = await markNotificationReadAction(item.id);
      if (!result.ok) { toast.error("Notifikasi belum dapat ditandai dibaca."); return; }
      setCount((value) => Math.max(0, value - 1));
      setItems((prev) => prev?.map((n) => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n) ?? null);
    }
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  async function handleMarkAll() {
    readVersion.current += 1;
    const result = await markAllNotificationsReadAction();
    if (!result.ok) { toast.error("Notifikasi belum dapat ditandai dibaca."); return; }
    setItems((prev) => (prev ?? []).map((n) => ({ ...n, read_at: new Date().toISOString() })));
    setCount(0);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifikasi">
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between px-1">
          <DropdownMenuLabel>Notifikasi</DropdownMenuLabel>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAll}>
              <CheckCheck className="size-3.5" /> Tandai dibaca
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {loadError && <div className="px-3 py-6 text-center">
            <p role="alert" className="text-sm text-destructive">Notifikasi gagal dimuat.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Coba Lagi</Button>
          </div>}
          {!loadError && items === null && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Memuat...</p>
          )}
          {!loadError && items !== null && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Belum ada notifikasi.</p>
            </div>
          )}
          {!loadError && items?.map((item) => (
            <button
              key={item.id}
              onClick={() => void handleClick(item)}
              className={cn(
                "block w-full px-3 py-2.5 text-left transition-colors hover:bg-muted",
                !item.read_at && "bg-primary/5"
              )}
            >
              <p className={cn("text-sm", item.read_at ? "font-normal text-foreground" : "font-semibold text-foreground")}>
                {item.type === "material_review" && <BookOpen aria-hidden="true" className="mr-1.5 inline size-3.5 text-primary" />}
                {(item.type === "schedule_today" || item.type === "schedule_soon") && <CalendarClock aria-hidden="true" className="mr-1.5 inline size-3.5 text-primary" />}
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
