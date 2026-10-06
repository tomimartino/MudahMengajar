"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteStudentAction } from "@/lib/actions/students";
import { DELETE_STUDENT_CONFIRMATION } from "@/lib/constants";

export function DeleteStudentDialog({
  studentId,
  studentName,
  trigger,
}: {
  studentId: string;
  studentName: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed === DELETE_STUDENT_CONFIRMATION;

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const result = await deleteStudentAction(studentId, typed);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Terjadi kesalahan.");
      return;
    }
    setOpen(false);
    setTyped("");
    toast.success("Siswa dihapus.");
    router.refresh();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setTyped("");
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus siswa?</AlertDialogTitle>
          <AlertDialogDescription>
            {`"${studentName}" beserta jadwal, pertemuan, presensi, pembayaran, dan tagihan akan dihapus permanen dan tidak bisa dikembalikan.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-student-confirmation">
            Ketik {DELETE_STUDENT_CONFIRMATION} untuk mengonfirmasi
          </Label>
          <Input
            id="delete-student-confirmation"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={DELETE_STUDENT_CONFIRMATION}
          />
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || !matches}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? "Menghapus..." : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
