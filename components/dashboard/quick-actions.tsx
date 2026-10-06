import Link from "next/link";
import { ChevronRight, ReceiptText, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = [
  {
    label: "Tambah Siswa",
    href: "/students/new",
    icon: UserPlus,
    color: "bg-mint text-mint-foreground",
  },
  {
    label: "Catat Pembayaran",
    href: "/payments",
    icon: ReceiptText,
    color: "bg-peach text-peach-foreground",
  },
];

export function QuickActions() {
  return (
    <section data-ui="quick-actions" aria-label="Aksi cepat" className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight">Aksi cepat</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ACTIONS.map((a) => (
            <Link
              data-ui="quick-action"
              key={a.label}
              href={a.href}
              className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", a.color)}>
                <a.icon className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-relaxed">{a.label}</span>
              </span>
              <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
    </section>
  );
}
