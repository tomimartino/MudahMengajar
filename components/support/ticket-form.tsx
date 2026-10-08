"use client";
import { useId,useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupportTicketAction } from "@/lib/actions/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
export function TicketForm(){const id=useId();const router=useRouter();const [pending,setPending]=useState(false);const [error,setError]=useState("");return <form className="space-y-4" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));setPending(true);setError("");try{const r=await createSupportTicketAction(values);if(!r.ok){setError(r.error??"Tiket belum terkirim.");return;}toast.success("Tiket dibuat.");form.reset();router.refresh();}catch{setError("Tiket belum terkirim.");}finally{setPending(false);}}}><fieldset disabled={pending} className="space-y-4"><div className="space-y-2"><Label htmlFor={`${id}-subject`}>Judul *</Label><Input name="subject" id={`${id}-subject`} minLength={5} maxLength={120} required/></div><div className="space-y-2"><Label htmlFor={`${id}-category`}>Kategori</Label><select name="category" id={`${id}-category`} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="bug">Masalah aplikasi</option><option value="account">Akun</option><option value="suggestion">Saran</option><option value="other">Lainnya</option></select></div><div className="space-y-2"><Label htmlFor={`${id}-message`}>Pesan *</Label><Textarea name="message" id={`${id}-message`} required minLength={10} maxLength={4000} rows={4}/></div></fieldset>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={pending}>{pending?"Mengirim…":"Kirim Tiket"}</Button></form>;}
