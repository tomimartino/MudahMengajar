"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminMfaGate() {
  const router=useRouter();
  const [factorId,setFactorId]=useState(""); const [qr,setQr]=useState(""); const [secret,setSecret]=useState("");
  const [code,setCode]=useState(""); const [loading,setLoading]=useState(true); const [pending,setPending]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{ let alive=true; const db=createClient(); void db.auth.mfa.listFactors().then(({data,error})=>{
    if(!alive)return; if(error)setError("Verifikasi belum dapat dimuat."); else setFactorId(data?.totp.find(f=>f.status==="verified")?.id??""); setLoading(false);
  }); return ()=>{alive=false;}; },[]);
  async function enroll(){ setPending(true);setError(""); try {
    const db=createClient(); const {data:factors,error:listError}=await db.auth.mfa.listFactors(); if(listError)throw listError;
    for(const factor of factors.all.filter(f=>f.status==="unverified"&&f.friendly_name==="MudahMengajar Admin")){
      const {error}=await db.auth.mfa.unenroll({factorId:factor.id}); if(error)throw error;
    }
    const {data,error}=await db.auth.mfa.enroll({factorType:"totp",friendlyName:"MudahMengajar Admin",issuer:"MudahMengajar"});
    if(error)throw error; setFactorId(data.id);setQr(data.totp.qr_code);setSecret(data.totp.secret);
  }catch{setError("Verifikasi belum dapat disiapkan. Silakan coba lagi.");}finally{setPending(false);} }
  async function verify(event:React.FormEvent){event.preventDefault();if(!/^\d{6}$/.test(code)){setError("Masukkan 6 digit kode verifikasi.");return;}
    setPending(true);setError("");try { const {error}=await createClient().auth.mfa.challengeAndVerify({factorId,code});
      if(error){setError("Kode tidak valid atau sudah kedaluwarsa.");return;}setQr("");setSecret("");router.replace("/admin");router.refresh();
    }catch{setError("Verifikasi gagal. Silakan coba lagi.");}finally{setPending(false);} }
  return <Card className="mx-auto max-w-md"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary"/>Verifikasi Dua Langkah</CardTitle></CardHeader>
    <CardContent className="space-y-4">{loading?<p role="status">Memuat...</p>:factorId?<form onSubmit={verify} className="space-y-4">
      {qr&&<div className="space-y-3"><p className="text-sm font-medium">Pindai dengan aplikasi Authenticator</p>
        {/* QR dari Supabase berisi faktor milik akun yang sedang masuk. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR verifikasi admin" width={200} height={200} className="mx-auto rounded-xl bg-white p-3"/>
        <Label htmlFor="mfa-secret">Kunci pengaturan manual</Label><Input id="mfa-secret" type="password" readOnly value={secret} autoComplete="off"/>
      </div>}
      <div className="space-y-2"><Label htmlFor="mfa-code">Kode Authenticator</Label><Input id="mfa-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} required disabled={pending}/></div>
      <Button className="w-full" disabled={pending}>{pending?"Memverifikasi...":"Masuk Portal Admin"}</Button>
    </form>:<Button onClick={()=>void enroll()} disabled={pending} className="w-full">{pending?"Menyiapkan...":"Siapkan Verifikasi"}</Button>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</CardContent></Card>;
}
