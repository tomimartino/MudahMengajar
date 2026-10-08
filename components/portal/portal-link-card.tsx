"use client";
import { useState, useTransition } from "react";
import { Copy, Link2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  rotatePortalAction,
  revokePortalAction,
} from "@/lib/actions/portal-links";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PortalLinkCard({
  studentId,
  active,
  expiresAt,
  timezone,
  studentActive,
}: {
  studentId: string;
  active: boolean;
  expiresAt: string | null;
  timezone: string;
  studentActive: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  async function rotate() {
    const result = await rotatePortalAction(studentId);
    if (result.ok && result.data) {
      setUrl(result.data.url);
      setError("");
      toast.success("Tautan portal dibuat.");
    } else setError(result.error ?? "Tautan gagal dibuat.");
    return result;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-5 text-primary" />
          Portal Orang Tua
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {!studentActive
            ? "Murid tidak aktif"
            : active
              ? `Aktif hingga ${new Date(expiresAt!).toLocaleDateString("id-ID", { timeZone: timezone })}`
              : "Akses belum aktif"}
        </p>
        {url && (
          <div className="flex gap-2">
            <Input readOnly value={url} aria-label="Tautan portal pribadi" />
            <Button
              size="icon"
              variant="outline"
              aria-label="Salin tautan portal"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Tautan disalin.");
                } catch {
                  setError("Pilih dan salin tautan di atas.");
                }
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {active ? (
            <ConfirmDialog
              title="Ganti tautan portal?"
              description="Tautan lama akan dinonaktifkan."
              confirmLabel="Buat tautan baru"
              destructive={false}
              onConfirm={rotate}
              trigger={
                <Button size="sm" variant="outline" disabled={!studentActive}>
                  <Link2 className="size-4" />
                  Ganti tautan
                </Button>
              }
            />
          ) : (
            <Button
              size="sm"
              disabled={pending || !studentActive}
              onClick={() =>
                start(async () => {
                  await rotate();
                })
              }
            >
              <Link2 className="size-4" />
              {pending ? "Membuat…" : "Buat tautan portal"}
            </Button>
          )}
          {active && (
            <ConfirmDialog
              title="Nonaktifkan portal?"
              description="Orang tua tidak dapat mengakses data melalui tautan ini lagi."
              confirmLabel="Nonaktifkan"
              onConfirm={async () => {
                const result = await revokePortalAction(studentId);
                if (result.ok) {
                  setUrl("");
                  toast.success("Portal dinonaktifkan.");
                }
                return result;
              }}
              trigger={
                <Button size="sm" variant="outline">
                  Nonaktifkan
                </Button>
              }
            />
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
