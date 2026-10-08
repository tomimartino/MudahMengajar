"use client";
import { useId,useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { saveLearningAction,deleteLearningAction,setHomeworkStatusAction } from "@/lib/actions/learning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog,DialogContent,DialogTitle,DialogHeader } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { LearningFile } from "@/types/learning.types";

const MIME:Record<string,string>={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",txt:"text/plain",doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",ppt:"application/vnd.ms-powerpoint",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation"};
export function ResourceEditor({kind,students=[],initial={},label}:{kind:"material"|"homework";students?:{id:string;full_name:string}[];initial?:Record<string,unknown>;label?:string}) {
  const router=useRouter();const formId=useId();const [open,setOpen]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState("");
  const [values,setValues]=useState(initial);const [files,setFiles]=useState<LearningFile[]>((initial.files??[]) as LearningFile[]);const [uploads,setUploads]=useState<File[]>([]);
  const update=(name:string,value:string)=>setValues(v=>({...v,[name]:value}));
  async function save(e:React.FormEvent){e.preventDefault();setPending(true);setError("");const added:LearningFile[]=[];const db=createClient();
    try {
      if(files.length+uploads.length>5)throw new Error("Maksimal 5 lampiran.");
      const {data:{user}}=await db.auth.getUser();if(!user)throw new Error("Silakan masuk kembali.");
      for(const file of uploads){const ext=file.name.split(".").pop()?.toLowerCase()??"";if(!MIME[ext])throw new Error("Jenis file tidak didukung.");if(file.size===0||file.size>10485760)throw new Error("Ukuran file maksimal 10 MB.");
        const path=`${user.id}/${crypto.randomUUID()}.${ext}`;const {error}=await db.storage.from("teaching-files").upload(path,file,{contentType:MIME[ext],upsert:false});if(error)throw new Error("Lampiran belum dapat diunggah.");added.push({path,name:file.name,size:file.size});}
      const result=await saveLearningAction(kind,{...values,files:[...files,...added],due_date:values.due_date??null,status:values.status??"assigned"});if(!result.ok)throw new Error(result.error);
      const old=(initial.files??[]) as LearningFile[];const removed=old.filter(f=>!files.some(kept=>kept.path===f.path)).map(f=>f.path);if(removed.length)await db.storage.from("teaching-files").remove(removed);
      toast.success(kind==="material"?"Materi disimpan.":"Tugas disimpan.");setOpen(false);setUploads([]);router.refresh();
    }catch(e){if(added.length)await db.storage.from("teaching-files").remove(added.map(f=>f.path));setError(e instanceof Error?e.message:"Data belum tersimpan.");}finally{setPending(false);}
  }
  return <><Button variant={initial.id?"outline":"default"} size={initial.id?"sm":"default"} onClick={()=>{setValues(initial);setFiles((initial.files??[]) as LearningFile[]);setUploads([]);setError("");setOpen(true);}}>{label??(initial.id?"Edit":kind==="material"?"Tambah Materi":"Tambah Tugas/PR")}</Button><Dialog open={open} onOpenChange={v=>{if(!pending)setOpen(v);}}><DialogContent className="max-h-[90svh] overflow-y-auto" aria-describedby={undefined}><DialogHeader><DialogTitle>{initial.id?"Edit": "Tambah"} {kind==="material"?"Materi":"Tugas/PR"}</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
      {kind==="homework"&&<div className="space-y-2"><Label htmlFor={`${formId}-student`}>Murid *</Label><select required id={`${formId}-student`} value={String(values.student_id??"")} onChange={e=>update("student_id",e.target.value)} disabled={Boolean(initial.session_id)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Pilih murid</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></div>}
      <div className="space-y-2"><Label htmlFor={`${formId}-title`}>Judul *</Label><Input id={`${formId}-title`} maxLength={200} required value={String(values.title??"")} onChange={e=>update("title",e.target.value)}/></div>
      <div className="space-y-2"><Label htmlFor={`${formId}-content`}>{kind==="material"?"Isi materi":"Tugas/PR"}</Label><Textarea id={`${formId}-content`} rows={5} maxLength={10000} value={String(values[kind==="material"?"content":"description"]??"")} onChange={e=>update(kind==="material"?"content":"description",e.target.value)}/></div>
      {kind==="homework"&&<div className="space-y-2"><Label htmlFor={`${formId}-due`}>Tenggat PR</Label><Input id={`${formId}-due`} type="date" value={String(values.due_date??"")} onChange={e=>update("due_date",e.target.value)}/></div>}
      <div className="space-y-2"><Label htmlFor={`${formId}-files`}>Lampiran (maks. 5 file, 10 MB/file)</Label><Input id={`${formId}-files`} type="file" multiple accept={Object.keys(MIME).map(e=>"."+e).join(",")} onChange={e=>setUploads(Array.from(e.target.files??[]))}/>{files.map(f=><div key={f.path} className="flex items-center justify-between gap-2 text-sm"><span className="break-all">{f.name}</span><Button type="button" variant="ghost" size="sm" onClick={()=>setFiles(v=>v.filter(x=>x.path!==f.path))} aria-label={`Hapus lampiran ${f.name}`}>Hapus</Button></div>)}</div>
      </fieldset>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={()=>setOpen(false)}>Batal</Button><Button disabled={pending}>{pending?"Menyimpan…":"Simpan"}</Button></div></form></DialogContent></Dialog></>;
}
export function ResourceDelete({kind,id,title}:{kind:"material"|"homework";id:string;title:string}){const router=useRouter();return <ConfirmDialog title="Hapus data?" description={`Hapus “${title}” beserta lampirannya?${kind==="homework"?" PR dari pertemuan terkait juga akan dikosongkan.":""}`} trigger={<Button variant="ghost" size="sm">Hapus</Button>} onConfirm={async()=>{const r=await deleteLearningAction(kind,id);if(r.ok)router.refresh();return r;}}/>;}
export function HomeworkStatusButton({id,status}:{id:string;status:"assigned"|"completed"}){const router=useRouter();const [pending,setPending]=useState(false);return <Button size="sm" disabled={pending} onClick={async()=>{setPending(true);const r=await setHomeworkStatusAction(id,status==="assigned"?"completed":"assigned");setPending(false);if(r.ok){toast.success("Status tugas diperbarui.");router.refresh();}else toast.error(r.error);}}>{status==="assigned"?"Tandai Selesai":"Tugaskan Kembali"}</Button>;}
