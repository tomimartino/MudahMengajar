"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { adminMutationAction } from "@/lib/actions/admin";
import type { AdminMutation } from "@/lib/validations/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export interface AdminField { name: string; label: string; type?: "text"|"email"|"number"|"date"|"datetime-local"|"textarea"|"checkbox"; options?: [string,string][]; required?: boolean }
export function AdminForm({ action, fields, initial = {}, label = "Simpan", confirmation }: { action: AdminMutation; fields: AdminField[]; initial?: Record<string,unknown>; label?: string; confirmation?: string }) {
  const id = useId(); const router = useRouter();
  const [values,setValues] = useState<Record<string,unknown>>(initial); const [pending,setPending] = useState(false);
  const [error,setError] = useState("");
  async function save() {
    setPending(true); setError("");
    try {
      const input = {...values};
      if(action === "announcement_save") {
        input.target_emails = values.audience === "selected" ? [...new Set(String(values.emails ?? "").split(/[,;\s]+/).filter(Boolean).map(s=>s.toLowerCase()))] : null;
        for(const name of ["publish_at","expires_at"]) input[name] = values[name] ? fromZonedTime(String(values[name]),"Asia/Jakarta").toISOString() : null;
      }
      const result = await adminMutationAction(action,input);
      if(!result.ok) {setError(result.error??"Perubahan belum tersimpan."); return result;}
      toast.success("Perubahan disimpan."); router.refresh();
      if(action === "expense" || (action === "announcement_save" && !initial.id)) setValues(initial);
      return {ok:true};
    } catch {const message="Perubahan belum tersimpan. Silakan coba lagi.";setError(message);return {ok:false,error:message};}
    finally {setPending(false);}
  }
  return <form onSubmit={e=>{e.preventDefault();if(!confirmation)void save();}} className="space-y-3">
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      {fields.map(field=><div key={field.name} className={field.type==="textarea"?"sm:col-span-2":""}>
        <Label htmlFor={`${id}-${field.name}`} className="mb-2 block">{field.label}</Label>
        {field.options ? <select id={`${id}-${field.name}`} value={String(values[field.name]??field.options[0]?.[0]??"")} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{field.options.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select>
          : field.type==="textarea" ? <Textarea id={`${id}-${field.name}`} required={field.required} rows={3} maxLength={4000} value={String(values[field.name]??"")} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))}/>
          : field.type==="checkbox" ? <input id={`${id}-${field.name}`} type="checkbox" className="size-5 accent-primary" checked={Boolean(values[field.name])} onChange={e=>setValues(v=>({...v,[field.name]:e.target.checked}))}/>
          : <Input id={`${id}-${field.name}`} required={field.required} type={field.type??"text"} value={String(values[field.name]??"")} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))}/>}
      </div>)}
    </fieldset>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {confirmation ? <ConfirmDialog trigger={<Button type="button" disabled={pending}>{label}</Button>} title={label} description={confirmation} confirmLabel="Simpan" destructive={false} onConfirm={save}/>:<Button type="submit" disabled={pending}>{pending?"Menyimpan…":label}</Button>}
  </form>;
}
export function AdminMutationButton({action,id,label,description}:{action:AdminMutation;id:string;label:string;description:string}) {
  const router=useRouter();
  return <ConfirmDialog title={label} description={description} confirmLabel={label} destructive={action!=="announcement_publish"} trigger={<Button variant="outline" size="sm">{label}</Button>} onConfirm={async()=>{const r=await adminMutationAction(action,{id});if(r.ok){toast.success("Perubahan disimpan.");router.refresh();}return r;}}/>;
}
