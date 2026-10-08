import { describe,it,expect,vi,beforeEach } from "vitest";
import { adminSchemas } from "@/lib/validations/admin";
import { materialSchema,homeworkSchema } from "@/lib/validations/learning";
import { completeSessionSchema } from "@/lib/validations/session";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { adminMutationAction } from "@/lib/actions/admin";
const id="2c70e719-d4f4-4638-8dd7-75a553a0b38c";
describe("admin boundary",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id}}});});
 it("requires live verified access before a mutation",async()=>{mocks.rpc.mockResolvedValue({data:{role:"owner",verified:false},error:null});const r=await adminMutationAction("settings",{site_name:"Test website",support_email:"",maintenance_mode:false});expect(r.ok).toBe(false);expect(mocks.rpc.mock.calls.map(c=>c[0])).toEqual(["get_admin_access"]);});
 it("keeps support from granting access",async()=>{mocks.rpc.mockResolvedValue({data:{role:"support",verified:true},error:null});expect((await adminMutationAction("member",{email:"a@example.com",role:"owner",active:true})).ok).toBe(false);expect(mocks.rpc).toHaveBeenCalledTimes(1);});
 it("permits support review follow-up without changing original review",async()=>{mocks.rpc.mockResolvedValueOnce({data:{role:"support",verified:true},error:null}).mockResolvedValueOnce({data:{id},error:null});const r=await adminMutationAction("review",{id,status:"read",note:"Tindak lanjut",rating:1,comment:"Changed"});expect(r.ok).toBe(true);expect(mocks.rpc).toHaveBeenLastCalledWith("admin_mutate",{p_action:"review",p_data:{id,status:"read",note:"Tindak lanjut"}});});
 it("rejects unknown actions and invalid targeting",async()=>{expect((await adminMutationAction("forged" as never,{})).ok).toBe(false);expect(adminSchemas.announcement_save.safeParse({title:"Judul baru",body:"Isi pengumuman",target_emails:[],publish_at:null,expires_at:null}).success).toBe(false);expect(mocks.getUser).not.toHaveBeenCalled();});
});
describe("learning inputs",()=>{
 it("accepts collection notes and limits attachments",()=>{expect(materialSchema.safeParse({title:"Pecahan",content:"Catatan"}).success).toBe(true);expect(materialSchema.safeParse({title:"Pecahan",files:[{name:"a.pdf",path:`${id}/a.pdf`,size:10485761}]}).success).toBe(false);});
 it("requires a student and a real deadline date",()=>{expect(homeworkSchema.safeParse({title:"Tugas",student_id:id,due_date:"2026-02-30"}).success).toBe(false);expect(homeworkSchema.safeParse({title:"Tugas",student_id:"",due_date:null}).success).toBe(false);expect(homeworkSchema.parse({title:"Tugas",student_id:id,due_date:"",status:"completed"}).due_date).toBeNull();});
 it("retains the calendar deadline and accepts no deadline",()=>{expect(completeSessionSchema.parse({duration_minutes:60,homework:"Latihan",homework_due_date:"2026-10-12",score:null}).homework_due_date).toBe("2026-10-12");expect(completeSessionSchema.parse({duration_minutes:60,homework:"Latihan",score:null}).homework_due_date).toBeNull();});
});
