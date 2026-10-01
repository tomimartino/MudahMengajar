# Workflow Preferences

- Plan-first: analyzes the existing codebase before coding; in plan mode does not write or modify code; delivers a complete implementation plan and stops until explicit approval (e.g., "Build"/"Implement Plan"). Confidence: 0.95
- Keeps MVP scope tight and avoids over-engineering; defers payment gateway, paid WhatsApp API, AI, and native apps to the post-MVP roadmap (free web push to the user's own phone is now in scope). Confidence: 0.85
- When a technical decision has multiple options, presents Option A / Option B / Recommendation with reasoning. Confidence: 0.8
- Writes plans detailed enough for another implementation agent to execute without guessing requirements. Confidence: 0.8
- When working in an existing codebase: never deletes existing features or duplicates components, and never swaps working technology without a strong reason. Confidence: 0.8
- When adding a new option/mode to an existing flow (e.g., a "switch jadwal" choice next to "selesaikan"), prefers additive change: the original option's form and behavior stay exactly as before, and the new option gets its own separate form — rather than modifying or refactoring the existing path. Confidence: 0.7
- Prefers consolidated "one-shot" workflows: creating a primary record should auto-create its related records in the same action (e.g., adding a student also creates schedule + invoice) instead of requiring separate manual input; payment recording is deferred to the Payments page. Confidence: 0.85
- Deploys via GitHub → Vercel: pushes to the production branch and expects the site to auto-deploy on push, so when the live site lags behind a push the diagnosis starts from the Git connection/branch and uncommitted local changes (git status/diff) rather than assuming manual redeploy. Confidence: 0.85
- Communicates billing with parents/guardians (wali murid) via WhatsApp wa.me links with pre-filled template messages for invoice reminders and payment receipts, rather than email or in-app-only notifications. Confidence: 0.8
- When requesting a change, expects it applied only to the stated area/scope and not generalized to related views (e.g., a status-label fix in the student tab UI should not touch the detail/attendance page). Confidence: 0.6
- When asked to study/learn the project (e.g., "pelajari projek ini"), expects a thorough repository exploration and a structured summary covering purpose, tech stack, architecture, features, DB schema, and conventions — to build project context before any implementation work. Confidence: 0.8
- For multi-step changes, prefers the work broken into a tracked todo list (short Indonesian step descriptions, each marked in_progress → completed as work advances) so the discrete sub-tasks and their status are visible. Confidence: 0.7
- After implementing a change, runs the project's verification suite (typecheck, lint, and tests) and reports the results before declaring the task complete. Confidence: 0.85
