import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { DateText } from "@/components/shared/date-text";

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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur md:px-8">
      <DateText
        value={new Date()}
        tz={timezone}
        variant="dayDate"
        className="text-sm font-medium text-muted-foreground"
      />
      <div className="flex items-center gap-1">
        <NotificationBell unreadCount={unreadCount} />
        <UserMenu name={userName} email={userEmail} avatarUrl={userAvatarUrl} />
      </div>
    </header>
  );
}
