# Tooling & Stack Preferences

- Default greenfield stack: Next.js (latest, App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + Auth + RLS), React Hook Form + Zod, date-fns, Lucide Icons, Recharts, and Vercel for deployment. Confidence: 0.9
- Uses Zod for form validation with errors shown next to the relevant field. Confidence: 0.85
- Deployment is single-user (the tutor themselves) and low-traffic, so hosting is optimized for the free tier (Vercel Hobby + Supabase free) and cost rather than scale. Confidence: 0.85
