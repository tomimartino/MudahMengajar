"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
export function PortalRefresh() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      {pending ? "Memuat…" : "Perbarui"}
    </Button>
  );
}
