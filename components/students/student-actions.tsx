"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, CircleCheck, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteStudentAction, setStudentStatusAction } from "@/lib/actions/students";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
        <Button variant="ghost" size="icon" disabled={pendingId === studentId}>
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
            <Pencil className="size-4" /> Edit
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
        <ConfirmDialog
          title="Hapus siswa?"
          description={`"${studentName}" akan dihapus permanen beserta jadwal di kalender. Siswa yang memiliki riwayat pembayaran tidak bisa dihapus — nonaktifkan saja.`}
          confirmLabel="Hapus"
          onConfirm={() => deleteStudentAction(studentId)}
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
