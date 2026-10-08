"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LoaderCircle, Package } from "lucide-react";
import { getEditPackageSetupAction, type EditablePackage } from "@/lib/actions/package-edit";
import type { PackageFormSetup } from "@/lib/actions/package-setup";
import { StudentForm } from "@/components/students/student-form";
import { Button } from "@/components/ui/button";
import { AmountText } from "@/components/shared/amount-text";
import { DateText } from "@/components/shared/date-text";

export function EditPackageForm({ studentId, packages, timezone }: {
  studentId: string; packages: EditablePackage[]; timezone: string;
}) {
  const router = useRouter();
  const requestId = useRef(0);
  const [selected, setSelected] = useState<EditablePackage | null>(null);
  const [setup, setSetup] = useState<PackageFormSetup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function selectPackage(pkg: EditablePackage) {
    const request = ++requestId.current;
    setSelected(pkg); setSetup(null); setLoading(true); setError("");
    try {
      const result = await getEditPackageSetupAction(studentId, pkg.id);
      if (request !== requestId.current) return;
      if (result.ok && result.data) setSetup(result.data);
      else setError(result.error ?? "Form paket belum dapat dimuat.");
    } catch { if (request === requestId.current) setError("Form paket belum dapat dimuat. Silakan coba lagi."); }
    finally { if (request === requestId.current) setLoading(false); }
  }

  function changePackage() {
    ++requestId.current;
    setSelected(null); setSetup(null); setLoading(false); setError("");
  }

  return (
    <div className="max-w-3xl space-y-5">
      <h2 className="font-semibold">{selected ? "Paket yang diedit" : "Pilih Paket"}</h2>
      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <PackageSummary pkg={selected} timezone={timezone} />
          <Button variant="outline" size="sm" onClick={changePackage}>Ganti Paket</Button>
        </div>
      ) : packages.length ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-label="Daftar pilihan paket">
          {packages.map((pkg) => <button key={pkg.id} type="button" onClick={() => void selectPackage(pkg)}
            className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <PackageSummary pkg={pkg} timezone={timezone} />
            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          </button>)}
        </div>
      ) : <p className="rounded-xl border p-6 text-muted-foreground">Belum ada paket yang dapat diedit.</p>}
      {loading && <div role="status" className="flex items-center gap-2 py-6 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Memuat form paket...</div>}
      {error && <div role="alert" className="space-y-3 rounded-xl border p-4"><p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => selected && void selectPackage(selected)}>Coba Lagi</Button></div>}
      {selected && setup && <StudentForm key={selected.id} mode="package-edit" packageId={selected.id}
        initial={setup.initial} subjects={setup.subjects} timezone={setup.timezone}
        packageSchedule={setup.packageSchedule}
        defaultDurationMinutes={setup.defaultDurationMinutes} onCancel={changePackage}
        onSuccess={() => { router.push(`/students/${studentId}`); router.refresh(); }} />}
    </div>
  );
}

function PackageSummary({ pkg, timezone }: { pkg: EditablePackage; timezone: string }) {
  return <div className="flex items-start gap-3">
    <Package className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
    <div>
      <p className="font-semibold">{pkg.total_sessions}x Pertemuan · <AmountText value={pkg.price} /></p>
      <p className="mt-1 text-sm text-muted-foreground">Jatuh tempo <DateText value={pkg.start_date} tz={timezone} variant="shortDate" /></p>
      <p className="mt-1 text-xs text-muted-foreground">{pkg.status === "completed" ? "Selesai" : "Aktif"}</p>
    </div>
  </div>;
}
