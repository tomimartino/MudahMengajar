import { getPortalAccess } from "@/lib/portal";
import type { LearningFile } from "@/types/learning.types";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;index:string}>}) {
  const {id,index}=await params;if(!/^\d$/.test(index))return new Response("Data tidak valid.",{status:400});const access=await getPortalAccess();if(!access)return new Response("Akses portal tidak tersedia.",{status:403});
  const {data,error}=await access.db.from("homework_tasks").select("files").eq("id",id).eq("student_id",access.student.id).eq("user_id",access.student.user_id).single();
  const file=(data?.files as unknown as LearningFile[]|undefined)?.[Number(index)];if(error||!file||!file.path.startsWith(access.student.user_id+"/"))return new Response("Lampiran tidak ditemukan.",{status:404});
  const {data:url,error:signError}=await access.db.storage.from("teaching-files").createSignedUrl(file.path,60,{download:file.name});if(signError||!url)return new Response("Lampiran belum dapat dibuka.",{status:503});
  return new Response(null,{status:302,headers:{Location:url.signedUrl,"Cache-Control":"private, no-store"}});
}
