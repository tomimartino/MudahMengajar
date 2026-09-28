# Tooling & Stack Preferences

- Default greenfield stack: Next.js (latest, App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + Auth + RLS), React Hook Form + Zod, date-fns, Lucide Icons, Recharts, and Vercel for deployment. Confidence: 0.9
- Uses Zod for form validation with errors shown next to the relevant field. Confidence: 0.85
- Deployment is single-user (the tutor themselves) and low-traffic, so hosting is optimized for the free tier (Vercel Hobby + Supabase free) and cost rather than scale. Confidence: 0.85
- Production deployments should have Vercel Deployment Protection (Vercel Authentication) disabled so public flows (shareable profile links, email verification callbacks) aren't intercepted by Vercel's login screen. Confidence: 0.85
- Works on Windows (project paths like C:\MudahMengajar); shell commands should use PowerShell syntax rather than bash. Confidence: 0.8
- Prefers a clean, professional production domain (custom domain or clean Vercel subdomain) over the default `<project>-<user>-projects.vercel.app` URL for production and auth email redirects. Confidence: 0.6
- Tests/uses the web app on iPhone (iOS Safari), so iOS-specific PWA behavior matters: web push only works from an installed PWA in standalone mode, and iOS needs complete install signals (apple-touch-icon, apple-mobile-web-app-capable meta, robust standalone detection with navigator.standalone fallback). Confidence: 0.7
- Wants the app to behave consistently across iOS (Safari/PWA standalone) and Android, including printing: iOS WKWebView in standalone mode does not support `window.print()`, so a print action should fall back to opening the page in a new Safari tab and auto-printing rather than silently doing nothing. Confidence: 0.7
