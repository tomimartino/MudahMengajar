import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { DateText } from "@/components/shared/date-text";
import { CalendarDays } from "lucide-react";

export function Topbar({
  userName,
  userEmail,
  userAvatarUrl,
  timezone,
  unreadCount,
}: {
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  timezone: string;
  unreadCount: number;
}) {
  return (
    <header data-ui="topbar" className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 backdrop-blur sm:px-6 md:px-8 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-soft sm:flex" aria-hidden="true">
          <CalendarDays className="size-4" />
        </span>
        <DateText
          value={new Date()}
          tz={timezone}
          variant="dayDate"
          className="text-xs font-medium text-muted-foreground sm:text-sm"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <NotificationBell unreadCount={unreadCount} />
        <UserMenu name={userName} email={userEmail} avatarUrl={userAvatarUrl} />
      </div>
    </header>
  );
}
