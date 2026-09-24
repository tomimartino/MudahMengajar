# Architecture Preferences

- Security: RLS for per-user data isolation, validates server-side (not just in the frontend), never exposes secrets to the browser, and uses environment variables. Confidence: 0.9
- Performance: prefers server components where appropriate, avoids unnecessary client components, paginates large data, avoids N+1 queries, and adds database indexes. Confidence: 0.85
- Database design: UUID primary keys, `user_id` on every table, proper foreign keys, and indexes on frequently queried fields. Confidence: 0.85
- Prefers computing derived values (e.g., remaining = total − used) instead of storing them. Confidence: 0.8
- Deletion policy: prefers hard delete (with cascade of related rows) when a record has no history, but never hard-deletes records with payment/financial history — those are deactivated instead (status=inactive) and their future schedules cleared. Confidence: 0.85
- Delete guards should only treat active references as "still in use": soft-deleted rows (`deleted_at` set) and cancelled schedules must not block deletion; stale cancelled/soft-deleted references are cleaned up before the delete. Confidence: 0.8
- Schema should stay future-ready for SaaS/multi-tenant growth (without implementing multi-tenant now). Confidence: 0.8
- Product targets individual tutors (guru bimbel perorangan / early-career teachers), not institutions or companies — institution-level features like finance/expense tracking are out of scope (reconfirmed: monthly revenue page tracks income only, no expenses). Confidence: 0.9
- SQL migrations should be idempotent (safe to re-run): `create table if not exists`, `add column if not exists`, and `drop policy/trigger if exists` before `create`. Confidence: 0.8
- Prefers public-facing links (profile share, auth email redirects) to resolve from the runtime request origin rather than a hardcoded localhost fallback. Confidence: 0.7
- Public-facing pages (e.g., the shareable teacher profile at /guru/[id]) must be viewable without any login so parents/guardians (wali murid) can open share links directly; only dashboard/account areas require authentication. Confidence: 0.85
