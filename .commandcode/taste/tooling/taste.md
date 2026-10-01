# Tooling & Stack Preferences

- Default greenfield stack: Next.js (latest, App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + Auth + RLS), React Hook Form + Zod, date-fns, Lucide Icons, Recharts, and Vercel for deployment. Confidence: 0.9
- Uses Zod for form validation with errors shown next to the relevant field. Confidence: 0.85
- Deployment is single-user (the tutor themselves) and low-traffic, so hosting is optimized for the free tier (Vercel Hobby + Supabase free) and cost rather than scale. Confidence: 0.85
- Production deployments should have Vercel Deployment Protection (Vercel Authentication) disabled so public flows (shareable profile links, email verification callbacks) aren't intercepted by Vercel's login screen. Confidence: 0.85
- Works on Windows (project paths like C:\MudahMengajar); shell commands should use PowerShell syntax rather than bash. Confidence: 0.8
- Prefers a clean, professional production domain (custom domain or clean Vercel subdomain) over the default `<project>-<user>-projects.vercel.app` URL for production and auth email redirects. Confidence: 0.6
- Tests/uses the web app on iPhone (iOS Safari), so iOS-specific PWA behavior matters: web push only works from an installed PWA in standalone mode, and iOS needs complete install signals (apple-touch-icon, apple-mobile-web-app-capable meta, robust standalone detection with navigator.standalone fallback). Confidence: 0.7
- Wants the app to behave consistently across iOS (Safari/PWA standalone) and Android. For document export this means preferring direct PDF download over printing (iOS WKWebView in standalone mode can't `window.print()`), so the invoice "Cetak" action became "Unduh PDF". Confidence: 0.8
- Uses Supabase Edge Functions for server-side/background jobs, scheduled via pg_cron and invoked over HTTP with pg_net, with secrets (function URLs, service-role keys) stored in Supabase Vault rather than hardcoded or env-only. Confidence: 0.6
- Supabase pg_cron runs a recent version where `cron.job_run_details` has no `jobname` column (only `jobid`); cron-status queries must join `cron.job` on `jobid` to get the job name. Confidence: 0.8
- Supabase Vault in this project keys `delete_secret`/`update_secret` by the secret's `id` (uuid), not by name — `vault.delete_secret('name')` raises "function does not exist". To change a secret, use `vault.update_secret((select id from vault.decrypted_secrets where name = ...), ...)` rather than delete-and-recreate. Confidence: 0.7
