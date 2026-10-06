import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
  mint: "bg-mint text-mint-foreground",
  sky: "bg-sky text-sky-foreground",
  peach: "bg-peach text-peach-foreground",
  lilac: "bg-lilac text-lilac-foreground",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  className,
  tone = "mint",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  className?: string;
  tone?: keyof typeof TONES;
}) {
  const content = (
    <Card className={cn("h-full [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(5)] transition-shadow", href && "cursor-pointer hover:shadow-md", className)}>
      <CardContent>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", TONES[tone])}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <p className="min-h-8 text-xs font-medium leading-relaxed text-muted-foreground sm:min-h-0 sm:text-sm">{label}</p>
        </div>
        <p className="mt-3 break-words text-lg font-bold tracking-tight sm:mt-4 sm:text-2xl">{value}</p>
        {hint && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
      {content}
    </Link>
  ) : (
    content
  );
}
