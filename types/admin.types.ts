export type AdminRole = "owner" | "support";
export interface AdminAccess { role: AdminRole | null; verified: boolean }
export interface AccountAccess { status: "active" | "suspended"; reason: string; role: AdminRole | null; maintenance: boolean }
export interface SiteConfig { site_name: string; support_email: string; maintenance_mode: boolean }
export interface AdminAccount {
  id: string; full_name: string; email: string; business_name: string | null; onboarding_completed: boolean;
  created_at: string; email_verified: boolean; status: "active" | "suspended"; reason: string;
  last_seen_at: string | null; admin_role: AdminRole | null; admin_active: boolean | null; student_count: number; session_count: number;
}
export interface AdminReview {
  id: string; user_id: string; full_name: string; rating: number; comment: string;
  created_at: string; updated_at: string; status: "new" | "read" | "resolved"; note: string;
}
export interface SupportTicket {
  id: string; subject: string; message: string; category: string; status: "open" | "in_progress" | "resolved";
  reply: string; created_at: string; updated_at: string;
}
export interface AdminTicket extends SupportTicket { user_id: string; full_name: string; priority: "low" | "normal" | "high"; internal_note: string }
export interface Announcement {
  id: string; title: string; body: string; status: "draft" | "scheduled" | "published" | "cancelled";
  target_users: string[] | null; target_emails: string[] | null; publish_at: string; expires_at: string | null; created_at: string;
}
export interface ServiceRun { id: number; service: string; outcome: "ok" | "error"; processed: number; sent: number; failed: number; duration_ms: number; message: string; created_at: string }
export interface PlatformExpense { id: string; expense_date: string; category: string; description: string; amount: number }
export interface AdminAudit { id: number; full_name: string | null; action: string; target_id: string | null; created_at: string }
export interface AdminMember { user_id: string; role: AdminRole; active: boolean; full_name: string; email: string }
export interface AdminPage<T> { items: T[]; total: number; page: number }
export interface AdminDashboard {
  teachers: number; new_accounts: number; active_accounts: number; suspended: number;
  review_average: number; review_new: number; ticket_open: number;
  service_last: Pick<ServiceRun,"service" | "outcome" | "created_at" | "failed">[];
  growth: { day: string; accounts: number }[];
}
export interface AdminReportRow { month: string; accounts: number; reviews: number; rating: number; tickets: number; expense: number }
export interface AdminDataMap {
  dashboard: AdminDashboard; accounts: AdminPage<AdminAccount>; reviews: AdminPage<AdminReview>;
  tickets: AdminPage<AdminTicket>; announcements: AdminPage<Announcement>; services: AdminPage<ServiceRun>;
  expenses: AdminPage<PlatformExpense> & { year_total: number; month_total: number };
  settings: { config: SiteConfig; members: AdminMember[] }; audit: AdminPage<AdminAudit>; reports: { months: AdminReportRow[] };
}
export type AdminSection = keyof AdminDataMap;
