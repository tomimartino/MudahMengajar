# Communication & Formatting Preferences

- Communicates in Bahasa Indonesia and expects app UI, labels, and copy to be in Indonesian. Confidence: 0.95
- Uses Indonesian locale formatting: dates as "20 September 2026", currency as "Rp500.000", time as "16.30", default timezone Asia/Jakarta. Confidence: 0.9
- References existing sites only for flow and feature inspiration; never copies design, source code, branding, text, or assets — builds original UI/UX and identity. Confidence: 0.9
- Shares screenshots of the actual UI, SQL query results, or tool output when reporting a bug or a result (e.g., an unwanted warning toast, where to add env vars in Vercel, or pg_cron/pg_net query results) rather than describing/transcribing them in text — expects the assistant to read the image. Confidence: 0.75
- When confused by a technical explanation, asks for a more detailed, plain-language walkthrough starting from the basics; responds well to step-by-step instructions with concrete analogies. Confidence: 0.85
- When asking how a feature works ("alur kerja X gimana?"), wants an end-to-end data-flow walkthrough (data source → builder → trigger → delivery → user action) with the specific files/functions involved, rather than a terse one-liner; a numbered step-by-step flow lands well. Confidence: 0.5
- When hitting an error or when a change doesn't show up as expected ("kenapa ini?", "kenapa yang muncul masih X?"), wants to understand the root cause rather than just being handed the fix; explain the why first, then give the corrected command. Confidence: 0.65
- Before running a command, asks what it does and why ("... untuk apa?") — wants the purpose and effect explained before executing it, rather than blindly copy-pasting. Confidence: 0.5
- Writes code comments in Bahasa Indonesia (technical identifiers, library/function names, and error strings stay in English). Confidence: 0.6
- When reporting a backend/CLI bug, pastes the exact command run and the exact raw output/error (e.g., the full curl call and its JSON response) rather than summarizing the failure. Confidence: 0.6
