import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, textClassName }: { className?: string; textClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <GraduationCap className="size-5" />
      </span>
      <span className={cn("text-lg font-bold tracking-tight", textClassName)}>
        Mudah<span className="text-primary">Mengajar</span>
      </span>
    </div>
  );
}
