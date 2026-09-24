# Workflow Preferences

- Plan-first: analyzes the existing codebase before coding; in plan mode does not write or modify code; delivers a complete implementation plan and stops until explicit approval (e.g., "Build"/"Implement Plan"). Confidence: 0.95
- Keeps MVP scope tight and avoids over-engineering; defers payment gateway, paid WhatsApp API, AI, and native apps to the post-MVP roadmap (free web push to the user's own phone is now in scope). Confidence: 0.85
- When a technical decision has multiple options, presents Option A / Option B / Recommendation with reasoning. Confidence: 0.8
- Writes plans detailed enough for another implementation agent to execute without guessing requirements. Confidence: 0.8
- When working in an existing codebase: never deletes existing features or duplicates components, and never swaps working technology without a strong reason. Confidence: 0.8
- Prefers consolidated "one-shot" workflows: creating a primary record should auto-create its related records in the same action (e.g., adding a student also creates schedule + invoice) instead of requiring separate manual input; payment recording is deferred to the Payments page. Confidence: 0.85
- Deploys via GitHub → Vercel: pushes to the production branch and expects the site to auto-deploy on push, so when the live site lags behind a push the diagnosis starts from the Git connection/branch and uncommitted local changes (git status/diff) rather than assuming manual redeploy. Confidence: 0.8
- Communicates billing with parents/guardians (wali murid) via WhatsApp wa.me links with pre-filled template messages for invoice reminders and payment receipts, rather than email or in-app-only notifications. Confidence: 0.8
- When requesting a change, expects it applied only to the stated area/scope and not generalized to related views (e.g., a status-label fix in the student tab UI should not touch the detail/attendance page). Confidence: 0.6
