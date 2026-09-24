"use client";

import { toast } from "sonner";
import { Link2, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ShareProfileButton({ url }: { url: string }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link profil disalin.");
    } catch {
      toast.error("Gagal menyalin link. Salin manual dari address bar.");
    }
  }

  const waLink = `https://wa.me/?text=${encodeURIComponent(
    `Lihat profil guru saya di MudahMengajar:\n${url}`
  )}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Share2 className="size-4" /> Bagikan Profil
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Bagikan profil ke orang tua/wali</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void copyLink()}>
          <Link2 className="size-4" /> Salin Link
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4 text-emerald-600" /> Bagikan via WhatsApp
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
