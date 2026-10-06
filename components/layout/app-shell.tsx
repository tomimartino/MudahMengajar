"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({
  userName,
  userEmail,
  userAvatarUrl,
  timezone,
  unreadCount,
  children,
}: {
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  timezone: string;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div data-ui="app-shell" className="flex min-h-svh bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userName={userName}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
          timezone={timezone}
          unreadCount={unreadCount}
        />
        <main data-ui="content" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:px-8 md:pb-10 md:pt-8 lg:px-10">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
