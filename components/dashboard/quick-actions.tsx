import Link from "next/link";
import { CalendarPlus, ReceiptText, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const ACTIONS = [
  {
    label: "Tambah Siswa",
    href: "/students/new",
    icon: UserPlus,
    description: "Daftarkan siswa baru",
  },
  {
    label: "Buat Jadwal",
    href: "/schedule/new",
    icon: CalendarPlus,
    description: "Atur jadwal les",
  },
  {
    label: "Catat Pembayaran",
    href: "/students?tab=payments",
    icon: ReceiptText,
    description: "Lihat tagihan & catat pembayaran",
  },
];

export function QuickActions() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ACTIONS.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="group flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <a.icon className="size-5 text-primary transition-colors group-hover:text-primary-foreground" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{a.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {a.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
