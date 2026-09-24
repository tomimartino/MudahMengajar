export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          whatsapp: string | null;
          business_name: string | null;
          address: string | null;
          avatar_url: string | null;
          teaching_levels: string[];
          learning_mode: string;
          slug: string | null;
          timezone: string;
          onboarding_completed: boolean;
          headline: string | null;
          bio: string | null;
          rate: string | null;
          career_start_year: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          whatsapp?: string | null;
          business_name?: string | null;
          address?: string | null;
          avatar_url?: string | null;
          teaching_levels?: string[];
          learning_mode?: string;
          slug?: string | null;
          timezone?: string;
          onboarding_completed?: boolean;
          headline?: string | null;
          bio?: string | null;
          rate?: string | null;
          career_start_year?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          full_name: string;
          whatsapp: string | null;
          business_name: string | null;
          address: string | null;
          avatar_url: string | null;
          teaching_levels: string[];
          learning_mode: string;
          slug: string | null;
          timezone: string;
          onboarding_completed: boolean;
          headline: string | null;
          bio: string | null;
          rate: string | null;
          career_start_year: number | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      teaching_experiences: {
        Row: {
          id: string;
          user_id: string;
          institution: string;
          role: string | null;
          start_year: number;
          end_year: number | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          institution: string;
          role?: string | null;
          start_year: number;
          end_year?: number | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          institution: string;
          role: string | null;
          start_year: number;
          end_year: number | null;
          description: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      achievements: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          year: number | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          year?: number | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          title: string;
          year: number | null;
          description: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      subjects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{ name: string; updated_at: string }>;
        Relationships: [];
      };
      parents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          whatsapp: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          whatsapp: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{ name: string; whatsapp: string; updated_at: string }>;
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          user_id: string;
          parent_id: string | null;
          full_name: string;
          gender: string | null;
          birth_date: string | null;
          school_name: string | null;
          school_level: string;
          grade_level: string;
          phone: string | null;
          address: string | null;
          notes: string | null;
          learning_mode: string;
          billing_type: string;
          per_session_rate: string | null;
          monthly_fee: string | null;
          monthly_due_day: number | null;
          status: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_id?: string | null;
          full_name: string;
          gender?: string | null;
          birth_date?: string | null;
          school_name?: string | null;
          school_level: string;
          grade_level: string;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          learning_mode?: string;
          billing_type?: string;
          per_session_rate?: string | null;
          monthly_fee?: string | null;
          monthly_due_day?: number | null;
          status?: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          parent_id: string | null;
          full_name: string;
          gender: string | null;
          birth_date: string | null;
          school_name: string | null;
          school_level: string;
          grade_level: string;
          phone: string | null;
          address: string | null;
          notes: string | null;
          learning_mode: string;
          billing_type: string;
          per_session_rate: string | null;
          monthly_fee: string | null;
          monthly_due_day: number | null;
          status: string;
          deleted_at: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      student_subjects: {
        Row: {
          id: string;
          user_id: string;
          student_id: string;
          subject_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          student_id: string;
          subject_id: string;
          created_at?: string;
        };
        Update: Partial<{ student_id: string; subject_id: string }>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          student_id: string;
          invoice_number: string;
          type: string;
          period_label: string | null;
          amount: string;
          due_date: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          student_id: string;
          invoice_number: string;
          type: string;
          period_label?: string | null;
          amount: string;
          due_date?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          period_label: string | null;
          amount: string;
          due_date: string | null;
          status: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      student_packages: {
        Row: {
          id: string;
          user_id: string;
          student_id: string;
          invoice_id: string | null;
          total_sessions: number;
          sessions_used: number;
          price: string;
          start_date: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          student_id: string;
          invoice_id?: string | null;
          total_sessions: number;
          sessions_used?: number;
          price: string;
          start_date: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          invoice_id: string | null;
          total_sessions: number;
          sessions_used: number;
          price: string;
          start_date: string;
          status: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      schedules: {
        Row: {
          id: string;
          user_id: string;
          student_id: string;
          subject_id: string;
          start_at: string;
          end_at: string;
          learning_mode: string | null;
          location: string | null;
          notes: string | null;
          status: string;
          recurrence_id: string | null;
          recurrence_rule: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          student_id: string;
          subject_id: string;
          start_at: string;
          end_at: string;
          learning_mode?: string | null;
          location?: string | null;
          notes?: string | null;
          status?: string;
          recurrence_id?: string | null;
          recurrence_rule?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          student_id: string;
          subject_id: string;
          start_at: string;
          end_at: string;
          learning_mode: string | null;
          location: string | null;
          notes: string | null;
          status: string;
          recurrence_id: string | null;
          recurrence_rule: Json | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          student_id: string;
          schedule_id: string | null;
          subject_id: string | null;
          session_date: string;
          started_at: string | null;
          ended_at: string | null;
          duration_minutes: number | null;
          material: string | null;
          sub_material: string | null;
          learning_notes: string | null;
          homework: string | null;
          score: string | null;
          progress_notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          student_id: string;
          schedule_id?: string | null;
          subject_id?: string | null;
          session_date: string;
          started_at?: string | null;
          ended_at?: string | null;
          duration_minutes?: number | null;
          material?: string | null;
          sub_material?: string | null;
          learning_notes?: string | null;
          homework?: string | null;
          score?: string | null;
          progress_notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          duration_minutes: number | null;
          material: string | null;
          sub_material: string | null;
          learning_notes: string | null;
          homework: string | null;
          score: string | null;
          progress_notes: string | null;
          status: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          student_id: string;
          status: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          student_id: string;
          status: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{ status: string; note: string | null; updated_at: string }>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          student_id: string;
          invoice_id: string | null;
          type: string;
          amount: string;
          payment_date: string;
          method: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          student_id: string;
          invoice_id?: string | null;
          type: string;
          amount: string;
          payment_date: string;
          method: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          type: string;
          amount: string;
          payment_date: string;
          method: string;
          notes: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          expense_date: string;
          category: string;
          description: string;
          amount: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          expense_date: string;
          category: string;
          description: string;
          amount: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          expense_date: string;
          category: string;
          description: string;
          amount: string;
          notes: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          ref_key: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          ref_key: string;
          title: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{ read_at: string | null; title: string; body: string | null }>;
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          user_id: string;
          default_duration_minutes: number;
          default_learning_mode: string;
          deduct_package_policy: string;
          payment_reminder_days: number;
          package_low_threshold: number;
          notify_schedule: boolean;
          notify_payment: boolean;
          notify_package: boolean;
          message_template_invoice: string;
          message_template_report: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          default_duration_minutes?: number;
          default_learning_mode?: string;
          deduct_package_policy?: string;
          payment_reminder_days?: number;
          package_low_threshold?: number;
          notify_schedule?: boolean;
          notify_payment?: boolean;
          notify_package?: boolean;
          message_template_invoice?: string;
          message_template_report?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          default_duration_minutes: number;
          default_learning_mode: string;
          deduct_package_policy: string;
          payment_reminder_days: number;
          package_low_threshold: number;
          notify_schedule: boolean;
          notify_payment: boolean;
          notify_package: boolean;
          message_template_invoice: string;
          message_template_report: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      complete_session: {
        Args: {
          p_schedule_id: string;
          p_attendance: string;
          p_duration_minutes: number;
          p_material?: string | null;
          p_sub_material?: string | null;
          p_learning_notes?: string | null;
          p_homework?: string | null;
          p_score?: number | null;
          p_progress_notes?: string | null;
        };
        Returns: string;
      };
      record_payment: {
        Args: {
          p_student_id: string;
          p_invoice_id?: string | null;
          p_type: string;
          p_amount: number;
          p_payment_date: string;
          p_method: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      create_package: {
        Args: {
          p_student_id: string;
          p_total_sessions: number;
          p_price: number;
          p_start_date: string;
        };
        Returns: Json;
      };
      create_invoice: {
        Args: {
          p_student_id: string;
          p_type: string;
          p_period_label?: string | null;
          p_amount: number;
          p_due_date?: string | null;
        };
        Returns: Json;
      };
      generate_monthly_invoices: {
        Args: { p_year: number; p_month: number; p_period_label: string };
        Returns: number;
      };
      generate_schedule_occurrences: {
        Args: { p_master_id: string; p_until: string };
        Returns: number;
      };
      get_dashboard_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      refresh_reminders: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_public_profile: {
        Args: { p_ident: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Profile = Tables<"profiles">;
export type Student = Tables<"students">;
export type Schedule = Tables<"schedules">;
export type Session = Tables<"sessions">;
export type Attendance = Tables<"attendance">;
export type Invoice = Tables<"invoices">;
export type Payment = Tables<"payments">;
export type Expense = Tables<"expenses">;
export type Subject = Tables<"subjects">;
export type Parent = Tables<"parents">;
export type StudentPackage = Tables<"student_packages">;
export type Notification = Tables<"notifications">;
export type Settings = Tables<"settings">;
