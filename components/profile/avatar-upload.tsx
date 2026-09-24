"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { uploadAvatarAction } from "@/lib/actions/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AvatarUpload({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null;
  initials: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setPending(true);
    const result = await uploadAvatarAction(formData);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Foto profil diperbarui.");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={pending}
      aria-label="Ganti foto profil"
      className="group relative block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
    >
      <Avatar className="size-20">
        {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
        <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
          {initials || "G"}
        </AvatarFallback>
      </Avatar>
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <Camera className="size-6" />
        <span className="text-[10px] font-medium">{avatarUrl ? "Ganti foto" : "Tambah foto"}</span>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
    </button>
  );
}
