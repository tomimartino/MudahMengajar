export const DEFAULT_MESSAGE_TEMPLATES = {
  invoice:
    "Halo Bapak/Ibu {{nama_wali}},\n\nKami mengingatkan pembayaran bimbel {{nama_siswa}} untuk periode {{periode}}.\n\nTotal: {{nominal}}\nJatuh tempo: {{jatuh_tempo}}\n\nTerima kasih.",
  report:
    "Halo Bapak/Ibu {{nama_wali}},\n\nLaporan belajar {{nama_siswa}} — {{tanggal}}.\n\nMateri: {{materi}}\nNilai: {{nilai}}\n\nCatatan: {{catatan}}\nPR: {{pr}}",
} as const;

export const INVOICE_TEMPLATE_PLACEHOLDERS = [
  "nama_wali",
  "nama_siswa",
  "periode",
  "nominal",
  "jatuh_tempo",
] as const;

export const REPORT_TEMPLATE_PLACEHOLDERS = [
  "nama_wali",
  "nama_siswa",
  "tanggal",
  "materi",
  "nilai",
  "catatan",
  "pr",
] as const;

export const APP_NAME = "MudahMengajar";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Murid", href: "/students", icon: "Users" },
  { label: "Pertemuan", href: "/sessions", icon: "BookOpen" },
  { label: "Laporan", href: "/reports", icon: "FileBarChart" },
  { label: "Profil", href: "/profile", icon: "BadgeCheck" },
  { label: "Pengaturan", href: "/settings", icon: "Settings" },
] as const;

export const MOBILE_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Murid", href: "/students", icon: "Users" },
  { label: "Pertemuan", href: "/sessions", icon: "BookOpen" },
  { label: "Profil", href: "/profile", icon: "BadgeCheck" },
] as const;

export const SCHOOL_LEVELS = ["SD", "SMP", "SMA", "Umum"] as const;
export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];

export const GRADE_OPTIONS: Record<SchoolLevel, string[]> = {
  SD: ["1", "2", "3", "4", "5", "6"],
  SMP: ["7", "8", "9"],
  SMA: ["10", "11", "12"],
  Umum: ["Umum"],
};

export const LEARNING_MODES = {
  offline: "Offline",
  online: "Online",
  hybrid: "Hybrid",
} as const;
export type LearningMode = keyof typeof LEARNING_MODES;

export const BILLING_TYPES = {
  package: "Paket Pertemuan",
  monthly: "Bulanan",
} as const;
export type BillingType = keyof typeof BILLING_TYPES;

export const GENDERS = { L: "Laki-laki", P: "Perempuan" } as const;

export const ATTENDANCE_STATUS = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alpha: "Alpha",
  dibatalkan_guru: "Dibatalkan Guru",
  dibatalkan_siswa: "Dibatalkan Siswa",
} as const;
export type AttendanceStatus = keyof typeof ATTENDANCE_STATUS;

export const PAYMENT_METHODS = {
  cash: "Cash",
  bank_transfer: "Transfer Bank",
  ewallet: "E-Wallet",
  other: "Lainnya",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const PAYMENT_TYPES = {
  package: "Paket",
  monthly: "Bulanan",
  per_session: "Per Pertemuan",
  other: "Lainnya",
} as const;
export type PaymentType = keyof typeof PAYMENT_TYPES;

export const EXPENSE_CATEGORIES = {
  stationery: "Alat Tulis",
  internet: "Internet",
  transport: "Transportasi",
  printing: "Print Materi",
  rent: "Sewa Tempat",
  books: "Buku",
  other: "Lainnya",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const DEDUCT_POLICIES = {
  hadir_only: "Hanya jika hadir",
  include_izin_sakit: "Hadir, izin, dan sakit",
  all_except_cancelled: "Semua kecuali dibatalkan",
} as const;
export type DeductPolicy = keyof typeof DEDUCT_POLICIES;

export const DEFAULT_SUBJECTS = [
  "Matematika",
  "IPA",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "Fisika",
  "Kimia",
  "Biologi",
  "IPS",
  "Bahasa Arab",
  "Komputer",
];

export const TIMEZONES = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura" },
] as const;

export const RECURRENCE_LABELS = {
  none: "Tidak Berulang",
  weekly: "Setiap Minggu",
  biweekly: "Setiap 2 Minggu",
  custom: "Custom",
} as const;

export const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export const PAGE_SIZE = 20;

// Kelas Tailwind untuk badge status
export const BADGE_STYLES = {
  green: "bg-emerald-100 text-emerald-800 border-emerald-200",
  yellow: "bg-amber-100 text-amber-800 border-amber-200",
  red: "bg-red-100 text-red-800 border-red-200",
  gray: "bg-gray-100 text-gray-600 border-gray-200",
  blue: "bg-sky-100 text-sky-800 border-sky-200",
} as const;
