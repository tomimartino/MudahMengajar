import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, getCurrentUser, getCurrentProfile } from "@/lib/supabase/server";
import { listEditablePackagesAction } from "@/lib/actions/package-edit";
import { PageHeader } from "@/components/layout/page-header";
import { EditPackageForm } from "@/components/students/edit-package-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Edit Paket" };

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [student, profile, packages] = await Promise.all([
    supabase.from("students").select("full_name").eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle(),
    getCurrentProfile(user.id),
    listEditablePackagesAction(id),
  ]);
  if (!student.data) notFound();
  return <div>
    <PageHeader title={`Edit Paket — ${student.data.full_name}`}
      action={<Button asChild variant="outline"><Link href={`/students/${id}`}>Kembali</Link></Button>} />
    {packages.ok && packages.data ? <EditPackageForm studentId={id} packages={packages.data} timezone={profile.data?.timezone ?? "Asia/Jakarta"} />
      : <p role="alert" className="text-destructive">{packages.error}</p>}
  </div>;
}
