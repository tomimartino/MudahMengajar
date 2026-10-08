// Real Auth, MFA, REST and private Storage checks using disposable accounts.
import { readFileSync } from "node:fs";
import { createHmac,createHash,randomUUID,randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
const env=Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>/^[\w]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,"")];}));
const url=env.NEXT_PUBLIC_SUPABASE_URL;const anon=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service=createClient(url,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=()=>createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const dbQuery=sql=>{const cli=process.env.QA_SUPABASE_CLI;return execFileSync(cli?.endsWith(".js")?process.execPath:cli??"supabase",[...(cli?.endsWith(".js")?[cli]:[]),"db","query","--linked",sql],{stdio:"pipe",windowsHide:true});};
function totp(secret){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";for(const c of secret.replace(/=/g,""))bits+=alphabet.indexOf(c).toString(2).padStart(5,"0");const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const digest=createHmac("sha1",Buffer.from(bytes)).update(counter).digest();const offset=digest[19]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");}
const users=[];const paths=[];
async function must(result){const r=await result;if(r.error)throw new Error(`API check failed (${r.error.code??r.error.status??"unknown"})`);return r.data;}
async function cookiesFor(db){const cookies=new Map();const server=createServerClient(url,anon,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>{for(const v of values)cookies.set(v.name,v.value);}}});const {session}=await must(db.auth.getSession());await must(server.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token}));return [...cookies].map(([k,v])=>`${k}=${v}`).join("; ");}
try{
 const credentials=[];
 for(let i=0;i<2;i++){const email=`qa-erp-${randomUUID()}@example.invalid`,password=randomBytes(28).toString("base64url");const data=await must(service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:"Akun QA Sementara"}}));users.push(data.user.id);credentials.push({email,password});}
 const owner=client(),teacher=client(),outsider=client();await must(owner.auth.signInWithPassword(credentials[0]));await must(teacher.auth.signInWithPassword(credentials[1]));
 dbQuery(`insert into private.admin_members(user_id,role) values('${users[0]}','owner')`);
 const aal1=await owner.rpc("admin_read",{p_section:"accounts"});assert(aal1.error,"AAL1 bypassed MFA");
 const factor=await must(owner.auth.mfa.enroll({factorType:"totp",friendlyName:"Disposable QA"}));
 await must(owner.auth.mfa.challengeAndVerify({factorId:factor.id,code:totp(factor.totp.secret)}));
 const access=await must(owner.rpc("get_admin_access"));assert.equal(access.verified,true);assert.equal(access.role,"owner");
 for(const p_section of ["dashboard","accounts","reviews","tickets","services","announcements","reports","expenses","settings","audit"])await must(owner.rpc("admin_read",{p_section}));
 if(process.env.QA_LOCAL_URL){const cookie=await cookiesFor(owner);for(const [section,title] of [["","Dashboard Admin"],["accounts","Akun Guru"],["reviews","Review Website"],["tickets","Dukungan Pengguna"],["services","Pemantauan Layanan"],["announcements","Pengumuman Baru"],["reports","Laporan 12 Bulan"],["expenses","Catat Biaya Website"],["settings","Identitas dan Layanan"],["audit","Perubahan oleh Admin"]]){const response=await fetch(`${process.env.QA_LOCAL_URL}/admin${section?"/"+section:""}`,{headers:{Cookie:cookie},redirect:"manual"});assert.equal(response.status,200,`Admin route failed: ${section}`);assert((await response.text()).includes(title),`Admin page content missing: ${section}`);}const csv=await fetch(`${process.env.QA_LOCAL_URL}/admin/export`,{headers:{Cookie:cookie}});assert.equal(csv.status,200);assert((await csv.text()).includes("Biaya Website"));}
 assert((await teacher.rpc("admin_read",{p_section:"accounts"})).error,"Teacher got admin data");
 assert((await outsider.rpc("admin_read",{p_section:"accounts"})).error,"Anonymous got admin data");
 const student=await must(teacher.from("students").insert({user_id:users[1],full_name:"Murid QA Sementara",school_level:"SD",grade_level:"3"}).select("id").single());
 const path=`${users[1]}/${randomUUID()}.txt`;paths.push(path);const content="Lampiran pengujian tugas pribadi";
 await must(teacher.storage.from("teaching-files").upload(path,Buffer.from(content),{contentType:"text/plain",upsert:false}));
 assert((await owner.storage.from("teaching-files").createSignedUrl(path,60)).error,"Other teacher got file");
 assert((await outsider.storage.from("teaching-files").download(path)).error,"Anonymous got file");
 const files=[{path,name:"lampiran-qa.txt",size:Buffer.byteLength(content)}];
 const task=await must(teacher.from("homework_tasks").insert({user_id:users[1],student_id:student.id,title:"Tugas QA",description:"Latihan QA",due_date:"2026-10-12",files}).select("id").single());
 await must(teacher.from("homework_tasks").update({status:"completed"}).eq("id",task.id).select("status").single());
 const signed=await must(teacher.storage.from("teaching-files").createSignedUrl(path,60,{download:"lampiran-qa.txt"}));const fileResponse=await fetch(signed.signedUrl);assert.equal(fileResponse.status,200);assert.equal(await fileResponse.text(),content);
 const material=await must(teacher.from("learning_materials").insert({user_id:users[1],title:"Materi QA",content:"Catatan",files}).select("id").single());
 assert.equal((await must(owner.from("learning_materials").select("id").eq("id",material.id))).length,0,"Admin obtained private notes via teacher API");
 if(process.env.QA_LOCAL_URL){await must(service.from("profiles").update({onboarding_completed:true}).eq("id",users[1]));const cookie=await cookiesFor(teacher);for(const [route,title] of [["materials","Materi QA"],["homework?tab=completed","Tugas QA"],["support","Buat Tiket"]]){const response=await fetch(`${process.env.QA_LOCAL_URL}/${route}`,{headers:{Cookie:cookie},redirect:"manual"});assert.equal(response.status,200,`Teacher route failed: ${route}`);assert((await response.text()).includes(title),`Teacher content missing: ${route}`);}const portalToken=randomBytes(32).toString("base64url");await must(teacher.rpc("rotate_portal_link",{p_student_id:student.id,p_hash:createHash("sha256").update(portalToken).digest("hex")}));const enter=await fetch(`${process.env.QA_LOCAL_URL}/portal/access/${portalToken}`,{redirect:"manual"});assert.equal(enter.status,303);const portalCookie=enter.headers.get("set-cookie")?.split(";")[0];assert(portalCookie);const page=await fetch(`${process.env.QA_LOCAL_URL}/portal?tab=homework`,{headers:{Cookie:portalCookie}});const html=await page.text();assert.equal(page.status,200);assert(html.includes("Tugas QA")&&html.includes("lampiran-qa.txt")&&html.includes("Tenggat"),"Parent homework missing");const download=await fetch(`${process.env.QA_LOCAL_URL}/portal/files/${task.id}/0?kind=homework`,{headers:{Cookie:portalCookie},redirect:"manual"});assert.equal(download.status,302);const parentFile=await fetch(download.headers.get("location"));assert.equal(await parentFile.text(),content);const blockedFile=await fetch(`${process.env.QA_LOCAL_URL}/portal/files/${task.id}/0`,{redirect:"manual"});assert.equal(blockedFile.status,403);console.log("PASS: authenticated admin pages, CSV, teacher pages, parent homework and attachment download.");}
 const ticket=await must(teacher.rpc("teacher_support",{p_action:"create",p_data:{subject:"Permintaan QA",message:"Pesan pengujian dukungan",category:"bug"}}));
 await must(owner.rpc("admin_mutate",{p_action:"ticket",p_data:{id:ticket.id,status:"resolved",priority:"normal",reply:"Balasan QA",internal_note:"Internal QA"}}));
 const tickets=await must(teacher.rpc("teacher_support",{p_action:"tickets"}));assert.equal(tickets[0].reply,"Balasan QA");assert.equal(tickets[0].internal_note,undefined);
 await must(owner.rpc("admin_mutate",{p_action:"account",p_data:{id:users[1],status:"suspended",reason:"Penangguhan QA"}}));
 assert.equal((await must(teacher.from("homework_tasks").select("id"))).length,0);
 assert((await teacher.storage.from("teaching-files").createSignedUrl(path,60)).error,"Suspended teacher obtained file");
 await must(owner.rpc("admin_mutate",{p_action:"account",p_data:{id:users[1],status:"active",reason:""}}));
 assert.equal((await must(teacher.from("homework_tasks").select("id"))).length,1);
 dbQuery(`update private.admin_members set active=false where user_id='${users[0]}'`);
 assert((await owner.rpc("admin_read",{p_section:"accounts"})).error,"Stale JWT retained admin access");
 console.log("PASS: real MFA, all admin modules, role revocation, account suspension, tickets, private files, materials and tasks.");
}catch(e){console.error(e instanceof Error?e.message:"Integration check failed");process.exitCode=1;}
finally{
 if(paths.length){const r=await service.storage.from("teaching-files").remove(paths);if(r.error){console.error("QA file cleanup failed");process.exitCode=1;}}
 if(users.length){try{dbQuery(`delete from private.admin_audit where actor_id in (${users.map(id=>`'${id}'`).join(",")})`);}catch{console.error("QA audit cleanup failed");process.exitCode=1;}}
 for(const id of [...users].reverse()){const r=await service.auth.admin.deleteUser(id);if(r.error){console.error("QA account cleanup failed");process.exitCode=1;}}
 console.log("Disposable fixtures cleaned up.");
}
