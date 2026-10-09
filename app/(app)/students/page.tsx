import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { createClient, getCurrentUser, getCurrentProfile } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { StudentFilters } from "@/components/students/student-filters";
import { StudentTable, type EnrichedStudent } from "@/components/students/student-table";
import { StudentCard } from "@/components/students/student-card";
import { AddPackageButton } from "@/components/students/add-package-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/constants";
import { todayInTz, toDateInput } from "@/lib/utils/date";

export const metadata: Metadata = { title: "Murid" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const level = typeof sp.level === "string" ? sp.level : "";
  const subject = typeof sp.subject === "string" ? sp.subject : "";
  const payment = typeof sp.payment === "string" ? sp.payment : "";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);

  const supabase = await createClient();
  const user = await getCurrentUser();

  const [{ data: profile }, { data: subjects }] = await Promise.all([
    getCurrentProfile(user!.id),
    supabase.from("subjects").select("id, name").eq("user_id", user!.id).order("name"),
  ]);
  const tz = profile?.timezone ?? "Asia/Jakarta";

  const studentActions = (
    <div className="flex w-full gap-2 sm:w-auto">
      <AddPackageButton />
      <Button asChild className="flex-1 sm:flex-none">
        <Link href="/students/new"><UserPlus className="size-4" /> Tambah Murid</Link>
      </Button>
    </div>
  );

  let query = supabase
    .from("students")
    .select("*, parents(name, whatsapp)", { count: "exact" })
    .eq("user_id", user!.id)
    .is("deleted_at", null);

  if (status) query = query.eq("status", status);
  if (level) query = query.eq("school_level", level);

  // Filter mapel
  if (subject) {
    const { data: links } = await supabase
      .from("student_subjects")
      .select("student_id")
      .eq("subject_id", subject);
    const ids = (links ?? []).map((l) => l.student_id);
    if (ids.length === 0) {
      return renderEmpty(subjects ?? [], q, true);
    }
    query = query.in("id", ids);
  }

  // Filter status pembayaran
  if (payment === "open" || payment === "overdue") {
    let invQuery = supabase
      .from("invoices")
      .select("student_id")
      .eq("user_id", user!.id)
      .in("status", ["unpaid", "partial"]);
    if (payment === "overdue") {
      invQuery = invQuery.lt("due_date", toDateInput(todayInTz(tz), tz));
    }
    const { data: openInvoices } = await invQuery;
    const ids = Array.from(new Set((openInvoices ?? []).map((i) => i.student_id)));
    if (ids.length === 0) {
      return renderEmpty(subjects ?? [], q, true);
    }
    query = query.in("id", ids);
  }

  // Cari nama siswa / sekolah / kelas / nama wali (sanitasi karakter khusus PostgREST)
  const safeQ = q.replace(/[%_,()*.]/g, "");
  if (safeQ) {
    const { data: matchedParents } = await supabase
      .from("parents")
      .select("id")
      .eq("user_id", user!.id)
      .ilike("name", `%${safeQ}%`)
      .limit(100);
    const parentIds = (matchedParents ?? []).map((p) => p.id);
    const orParts = [
      `full_name.ilike.%${safeQ}%`,
      `school_name.ilike.%${safeQ}%`,
      `grade_level.ilike.%${safeQ}%`,
      ...(parentIds.length > 0 ? [`parent_id.in.(${parentIds.join(",")})`] : []),
    ];
    query = query.or(orParts.join(","));
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: students, count } = await query.range(from, to).order("full_name");

  if (!students || students.length === 0) {
    return renderEmpty(subjects ?? [], q, Boolean(status || level || subject || payment));
  }

  // Agregat per siswa (batch, tanpa N+1)
  const ids = students.map((s) => s.id);

  const [{ data: links }, { data: packages }, { data: invoices }, { data: upcoming }, { data: paidInvoices }] =
    await Promise.all([
      supabase.from("student_subjects").select("student_id, subject_id").in("student_id", ids),
      supabase
        .from("student_packages")
        .select("student_id, total_sessions, sessions_used")
        .eq("status", "active")
        .in("student_id", ids),
      supabase
        .from("invoices")
        .select("student_id, status, due_date")
        .in("student_id", ids)
        .neq("status", "paid"),
      supabase
        .from("schedules")
        .select("student_id, start_at")
        .eq("status", "scheduled")
        .gt("start_at", new Date().toISOString())
        .in("student_id", ids)
        .order("start_at", { ascending: true })
        .limit(1000),
      supabase
        .from("invoices")
        .select("student_id")
        .eq("status", "paid")
        .in("student_id", ids)
        .limit(1000),
    ]);

  const subjectNames = new Map<string, string[]>();
  for (const l of links ?? []) {
    const name = subjects?.find((s) => s.id === l.subject_id)?.name ?? "?";
    const arr = subjectNames.get(l.student_id) ?? [];
    arr.push(name);
    subjectNames.set(l.student_id, arr);
  }

  const packageMap = new Map<string, { remaining: number; total: number }>();
  for (const p of packages ?? []) {
    packageMap.set(p.student_id, {
      remaining: p.total_sessions - p.sessions_used,
      total: p.total_sessions,
    });
  }

  const today = toDateInput(todayInTz(tz), tz);
  const openMap = new Map<string, { partial: boolean; overdue: boolean }>();
  for (const i of invoices ?? []) {
    const cur = openMap.get(i.student_id) ?? { partial: false, overdue: false };
    if (i.status === "partial") cur.partial = true;
    if (i.due_date && i.due_date < today) cur.overdue = true;
    openMap.set(i.student_id, cur);
  }

  const upcomingMap = new Map<string, { count: number; next: string | null }>();
  for (const s of upcoming ?? []) {
    const cur = upcomingMap.get(s.student_id) ?? { count: 0, next: null };
    cur.count += 1;
    if (!cur.next || s.start_at < cur.next) cur.next = s.start_at;
    upcomingMap.set(s.student_id, cur);
  }

  const paidIds = new Set((paidInvoices ?? []).map((i) => i.student_id));

  const enriched: EnrichedStudent[] = students.map((s) => {
    const pkg = packageMap.get(s.id);
    const open = openMap.get(s.id);
    const up = upcomingMap.get(s.id);
    let paymentState: EnrichedStudent["payment_state"] = "none";
    if (open) {
      paymentState = open.overdue ? "overdue" : open.partial ? "partial" : "unpaid";
    } else if (paidIds.has(s.id)) {
      paymentState = "paid";
    }
    const parent = s.parents as unknown as { name: string; whatsapp: string } | null;
    return {
      id: s.id,
      full_name: s.full_name,
      teaching_type: s.teaching_type,
      group_size: s.group_size,
      school_level: s.school_level,
      grade_level: s.grade_level,
      school_name: s.school_name,
      status: s.status,
      billing_type: s.billing_type,
      parent_name: parent?.name ?? null,
      parent_whatsapp: parent?.whatsapp ?? null,
      subject_names: subjectNames.get(s.id) ?? [],
      package_remaining: pkg ? pkg.remaining : null,
      package_total: pkg ? pkg.total : null,
      payment_state: paymentState,
      upcoming_count: up?.count ?? 0,
      next_start_at: up?.next ?? null,
    };
  });

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Murid"
        description={`${count ?? 0} murid${q || status || level || subject || payment ? " ditemukan" : " terdaftar"}`}
        action={studentActions}
      />
      <div className="mb-4 mt-4">
        <StudentFilters subjects={subjects ?? []} />
      </div>
      <div className="hidden md:block">
        <StudentTable students={enriched} timezone={tz} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:hidden">
        {enriched.map((s) => (
          <StudentCard key={s.id} student={s} timezone={tz} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button
            asChild
            variant="outline"
            disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          >
            <Link href={`/students?${buildPageUrl(sp, page - 1)}`}>Sebelumnya</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages}
          </span>
          <Button
            asChild
            variant="outline"
            disabled={page >= totalPages}
            className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
          >
            <Link href={`/students?${buildPageUrl(sp, page + 1)}`}>Berikutnya</Link>
          </Button>
        </div>
      )}
    </div>
  );

  function renderEmpty(
    subjectList: { id: string; name: string }[],
    searchText: string,
    hasActiveFilter: boolean
  ) {
    return (
      <div>
        <PageHeader
          title="Murid"
          action={studentActions}
        />
        <div className="mb-4 mt-4">
          <StudentFilters subjects={subjectList} />
        </div>
        <EmptyState
          icon={Users}
          title={searchText || hasActiveFilter ? "Tidak ada murid yang cocok." : "Belum ada murid."}
          action={
            !searchText && !hasActiveFilter ? (
              <Button asChild>
                <Link href="/students/new">
                  <UserPlus className="size-4" /> Tambah Murid Pertama
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }
}

function buildPageUrl(sp: Record<string, string | string[] | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key !== "page" && typeof value === "string") params.set(key, value);
  }
  params.set("page", String(page));
  return params.toString();
}
