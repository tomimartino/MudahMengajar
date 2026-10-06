import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, textClassName }: { className?: string; textClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint text-primary">
        <GraduationCap className="size-5" />
      </span>
      <span className={cn("text-base font-bold tracking-tight text-foreground", textClassName)}>
        Mudah<span className="text-primary">Mengajar</span>
      </span>
    </div>
  );
}
