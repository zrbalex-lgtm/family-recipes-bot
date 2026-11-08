# Release v23 - 2026-11-08

Deployment: Supabase Home projects / Edge Function family-recipes-bot, version 23, ACTIVE.
Source: GitHub audit/supabase-v22-snapshot (commit e5e90935ea8011b95c38cbd477694bd30a2dc14e).
Pre-deploy: version 22; CI run 42499535061 passed unit tests and Deno type check.
No schema migration. No unrelated functions or parent_control changes.

Changes:
- Explicit recipe-title lookup bypasses stale last search context.
- List-all command returns numbered recipes.
- Viewing a recipe preserves previous search result list.
- Duplicate callback updates are acknowledged without repeating the action.
- Strict callback data parsing, no webhook reconfiguration in normal requests.
- Export rejects overflow rather than silently truncating.

Verification:
- Supabase reports v23 ACTIVE.
- Read-only database query reports 5 active and 1 soft-deleted recipes after deploy.
- Live Telegram acceptance test for v23 is still pending.

Outstanding risks:
- Expired processing leases and ambiguous Telegram delivery require idempotent recovery design; no automatic reclaim deployed.
- Recipe title collisions and list pagination beyond 10 results need UX improvements.
- Gemini may omit quantities or infer units.
- Integration tests for stale callbacks and transient errors still needed.

Rollback: redeploy the original five files from Supabase v22 snapshot recorded in the audit branch, with verify_jwt=false, after confirming webhook settings.
