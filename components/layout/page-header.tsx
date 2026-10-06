import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-ui="page-header" className={cn("mb-7 flex flex-wrap items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
