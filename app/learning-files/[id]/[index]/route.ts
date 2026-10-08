import { createClient } from "@/lib/supabase/server";
import type { LearningFile } from "@/types/learning.types";
export async function GET(request:Request,{params}:{params:Promise<{id:string;index:string}>}) {
  const {id,index}=await params;const kind=new URL(request.url).searchParams.get("kind");if(!["material","homework"].includes(kind??"")||!/^\d$/.test(index))return new Response("Data tidak valid.",{status:400});
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return new Response("Silakan masuk.",{status:401});
  const {data,error}=await db.from(kind==="material"?"learning_materials":"homework_tasks").select("files").eq("id",id).eq("user_id",user.id).single();
  const file=(data?.files as unknown as LearningFile[]|undefined)?.[Number(index)];if(error||!file||!file.path.startsWith(user.id+"/"))return new Response("Lampiran tidak ditemukan.",{status:404});
  const {data:url,error:signError}=await db.storage.from("teaching-files").createSignedUrl(file.path,60,{download:file.name});if(signError||!url)return new Response("Lampiran belum dapat dibuka.",{status:503});
  return new Response(null,{status:302,headers:{Location:url.signedUrl,"Cache-Control":"private, no-store"}});
}
