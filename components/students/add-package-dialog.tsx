"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LoaderCircle, PackagePlus, Search, UserRound } from "lucide-react";
import {
  getPackageFormSetupAction,
  listPackageStudentsAction,
  type PackageFormSetup,
  type PackageStudent,
} from "@/lib/actions/package-setup";
import { StudentForm } from "@/components/students/student-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function AddPackageButton() {
  const router = useRouter();
  const requestId = useRef(0);
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<PackageStudent[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PackageStudent | null>(null);
  const [setup, setSetup] = useState<PackageFormSetup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadStudents() {
    const request = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await listPackageStudentsAction();
      if (request !== requestId.current) return;
      if (result.ok && result.data) setStudents(result.data);
      else setError(result.error ?? "Daftar murid belum dapat dimuat.");
    } catch {
      if (request === requestId.current) setError("Daftar murid belum dapat dimuat. Silakan coba lagi.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  function changeOpen(value: boolean) {
    ++requestId.current;
    setOpen(value);
    setSelected(null);
    setSetup(null);
    setStudents(null);
    setSearch("");
    setError("");
    setLoading(false);
    if (value) void loadStudents();
  }

  async function selectStudent(student: PackageStudent) {
    const request = ++requestId.current;
    setSelected(student);
    setSetup(null);
    setError("");
    setLoading(true);
    try {
      const result = await getPackageFormSetupAction(student.id);
      if (request !== requestId.current) return;
      if (result.ok && result.data) setSetup(result.data);
      else setError(result.error ?? "Form paket belum dapat dimuat.");
    } catch {
      if (request === requestId.current) setError("Form paket belum dapat dimuat. Silakan coba lagi.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  function changeStudent() {
    ++requestId.current;
    setSelected(null);
    setSetup(null);
    setError("");
    setLoading(false);
  }

  const normalizedSearch = search.trim().toLocaleLowerCase("id");
  const matches = (students ?? []).filter((student) => student.full_name.toLocaleLowerCase("id").includes(normalizedSearch));

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex-1 sm:flex-none">
          <PackagePlus className="size-4" /> Tambah Paket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{selected ? "Tambah Paket Pertemuan" : "Pilih Murid"}</DialogTitle>
        </DialogHeader>
        {selected ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <UserRound className="size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{selected.full_name}</p>
                <p className="text-xs text-muted-foreground">{studentClass(selected)}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={changeStudent}>Ganti Murid</Button>
          </div>
        ) : students && students.length > 0 ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Cari nama murid" placeholder="Cari nama murid..." value={search}
              onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
        ) : null}

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" /> {selected ? "Memuat form paket..." : "Memuat murid..."}
          </div>
        ) : error ? (
          <div className="space-y-3 rounded-xl border p-4">
            <p role="alert" className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => selected ? void selectStudent(selected) : void loadStudents()}>Coba Lagi</Button>
          </div>
        ) : setup && selected ? (
          <StudentForm key={selected.id} mode="package" subjects={setup.subjects} initial={setup.initial}
            defaultDurationMinutes={setup.defaultDurationMinutes}
            onSuccess={() => { changeOpen(false); router.refresh(); }}
            onCancel={() => changeOpen(false)} />
        ) : students?.length === 0 ? (
          <div className="space-y-4 py-6 text-center">
            <p className="text-muted-foreground">Belum ada murid.</p>
            <Button asChild><Link href="/students/new" onClick={() => changeOpen(false)}>Tambah Murid</Link></Button>
          </div>
        ) : students ? (
          <div className="max-h-80 space-y-2 overflow-y-auto" aria-label="Daftar pilihan murid">
            {matches.length > 0 ? matches.map((student) => (
              <button key={student.id} type="button" onClick={() => void selectStudent(student)}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary" aria-hidden="true">
                  {student.full_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{student.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {studentClass(student)}{student.school_name ? ` · ${student.school_name}` : ""}{student.status === "inactive" ? " · Nonaktif" : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            )) : <p role="status" className="py-6 text-center text-muted-foreground">Nama murid tidak ditemukan.</p>}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function studentClass(student: PackageStudent) {
  return student.school_level === "Umum" ? "Umum" : `Kelas ${student.grade_level} ${student.school_level}`;
}
