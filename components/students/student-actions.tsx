"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, CircleCheck, Eye, MoreHorizontal, Package, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setStudentStatusAction } from "@/lib/actions/students";
import { DeleteStudentDialog } from "@/components/students/delete-student-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function StudentActions({
  studentId,
  studentName,
  status,
}: {
  studentId: string;
  studentName: string;
  status: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggleStatus() {
    setPendingId(studentId);
    const next = status === "active" ? "inactive" : "active";
    const result = await setStudentStatusAction(studentId, next);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(status === "active" ? "Siswa dinonaktifkan." : "Siswa diaktifkan kembali.");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pendingId === studentId} aria-label={`Menu ${studentName}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/students/${studentId}`}>
            <Eye className="size-4" /> Lihat
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/students/${studentId}/edit`}>
            <Pencil className="size-4" /> Edit Identitas
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/students/${studentId}/edit-package`}>
            <Package className="size-4" /> Edit Paket
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void toggleStatus()}>
          {status === "active" ? (
            <>
              <Ban className="size-4" /> Nonaktifkan
            </>
          ) : (
            <>
              <CircleCheck className="size-4" /> Aktifkan
            </>
          )}
        </DropdownMenuItem>
        <DeleteStudentDialog
          studentId={studentId}
          studentName={studentName}
          trigger={
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <Trash2 className="size-4" /> Hapus
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
