# Release v24 - 2026-11-08

Supabase Edge Function family-recipes-bot version 24 is ACTIVE.
Source: audit/supabase-v22-snapshot, commit 58a907fad53eebc37c172a821e57a7dd6707b86e.
GitHub Actions run 42500085200: unit tests and Deno type check passed.

Changes relative to v23:
- For explicit recipe names with no exact or substring match, suggest up to three close titles using normalized Unicode Levenshtein distance.
- Never automatically open a recipe solely from a fuzzy match.
- Added regression tests for typo suggestions.

No schema changes, no parent_control changes, no unrelated Edge Functions touched.

Live Telegram test pending: 'Покажи рецепт пани валемская' should suggest 'Пани Валевская'. Then the exact spelling should open the recipe.

Outstanding reliability issue: processed_updates has a 30-second lease, but its SQL claim only permits status retryable; expired processing rows cannot currently be reclaimed. Do not enable unconditional reclaim until draft creation and Telegram message send are idempotent. Ambiguous send failures are currently marked done; document/monitor rather than blindly replaying them.
