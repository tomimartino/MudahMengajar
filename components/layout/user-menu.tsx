"use client";

import Link from "next/link";
import { BadgeCheck, ChevronDown, LogOut, Settings } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Menu akun" className="flex items-center gap-3 rounded-2xl p-1.5 text-left outline-none ring-primary transition-colors hover:bg-card focus-visible:ring-2">
          <Avatar className="size-10">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback className="bg-mint text-xs font-bold text-mint-foreground">
              {initials || "G"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm font-semibold lg:block">{name || "Guru"}</span>
          <ChevronDown className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold">{name || "Guru"}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <BadgeCheck className="size-4" /> Profil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" /> Pengaturan
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void logoutAction();
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" /> Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
