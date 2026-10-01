# Architecture Preferences

- Security: RLS for per-user data isolation, validates server-side (not just in the frontend), never exposes secrets to the browser, and uses environment variables. Confidence: 0.9
- Performance: prefers server components where appropriate, avoids unnecessary client components, paginates large data, avoids N+1 queries, and adds database indexes. Confidence: 0.85
- Database design: UUID primary keys, `user_id` on every table, proper foreign keys, and indexes on frequently queried fields. Confidence: 0.85
- Prefers computing derived values (e.g., remaining = total − used) instead of storing them. Confidence: 0.8
- Deletion policy: prefers hard delete (with cascade of related rows); records with payment/financial history can now also be hard-deleted, but only behind an explicit type-to-confirm guard (e.g., typing "HAPUS MURID") rather than being blocked or forced into deactivation. Confidence: 0.8
- Delete guards should only treat active references as "still in use": soft-deleted rows (`deleted_at` set) and cancelled schedules must not block deletion; stale cancelled/soft-deleted references are cleaned up before the delete. Confidence: 0.8
- Schema should stay future-ready for SaaS/multi-tenant growth (without implementing multi-tenant now). Confidence: 0.8
- Product targets individual tutors (guru bimbel perorangan / early-career teachers), not institutions or companies — institution-level features like finance/expense tracking are out of scope (reconfirmed: monthly revenue page tracks income only, no expenses). Confidence: 0.9
- SQL migrations should be idempotent (safe to re-run): `create table if not exists`, `add column if not exists`, and `drop policy/trigger if exists` before `create`. Confidence: 0.8
- When a feature requires a new database field/column, expects the SQL migration to be written as part of the same change, and the response to state explicitly when no migration is needed. Confidence: 0.7
- Prefers public-facing links (profile share, auth email redirects) to resolve from the runtime request origin rather than a hardcoded localhost fallback. Confidence: 0.7
- Public-facing pages (e.g., the shareable teacher profile at /guru/[id]) must be viewable without any login so parents/guardians (wali murid) can open share links directly; only dashboard/account areas require authentication. Confidence: 0.85
- Prefers non-destructive updates: when an edit changes unrelated fields, leave related records untouched — only delete-and-regenerate related rows (e.g., a student's upcoming schedule) when their pattern actually changed, not on every save. Confidence: 0.7
- Prefers financial/income reporting over attendance reporting: the Reports feature's attendance report was replaced by a finance report (monthly income summary), consistent with income-only finance tracking and the simplified Hadir/Dibatalkan attendance model. Confidence: 0.7
- Prefers the finance page to measure expected income rather than realized activity: the headline card is "Estimasi Pendapatan" (total of every student's invoice amount, paid or unpaid), replacing transaction count and distinct paying-student count, with the monthly grid showing the estimate as the main figure and realized (paid) income as subtext. Confidence: 0.7
- Prefers cancellation of a parent record (e.g., a package) to cascade only to its upcoming items: mark the parent cancelled and delete/remove future scheduled children (calendar events) while keeping completed/historical records intact and recorded. Confidence: 0.85
