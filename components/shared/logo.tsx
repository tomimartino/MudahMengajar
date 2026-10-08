"use client";
import { GraduationCap } from "lucide-react";
import { useSiteConfig } from "@/components/site-config-provider";
import { cn } from "@/lib/utils";

export function Logo({ className, textClassName }: { className?: string; textClassName?: string }) {
  const {site_name}=useSiteConfig();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint text-primary">
        <GraduationCap className="size-5" />
      </span>
      <span className={cn("text-base font-bold tracking-tight text-foreground", textClassName)}>
        {site_name==="MudahMengajar"?<>Mudah<span className="text-primary">Mengajar</span></>:site_name}
      </span>
    </div>
  );
}
