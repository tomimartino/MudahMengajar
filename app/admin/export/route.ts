import { getAdminContext, readAdminData } from "@/lib/admin";
import { toCSV, csvResponse } from "@/lib/utils/csv";
export async function GET() {
  const {access}=await getAdminContext();
  if(!access.role||!access.verified) return new Response("Akses admin diperlukan.",{status:403});
  const {months}=await readAdminData("reports");
  const rows=months.map(r=>({Bulan:r.month,"Akun Baru":r.accounts,Review:r.reviews,Rating:r.rating,Tiket:r.tickets,...(access.role==="owner"?{"Biaya Website":r.expense}:{})}));
  return csvResponse(toCSV(rows),"laporan-website.csv");
}
