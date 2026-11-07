# Family Recipes Bot

Private family recipe Telegram bot, hosted in the existing Supabase project `opufwbpkuofxhfmlqhqq`.

## Status
Phase 1 development only. **Not deployed.** No Telegram webhook configured. No production secrets committed.

## Isolation
All application tables live in private schema `family_recipes`. Existing `parent_control` schema and `telegram-bot` function must not be modified. Edge Function: `family-recipes-bot`.

## Configuration
Set `FAMILY_RECIPES_TELEGRAM_TOKEN`, `FAMILY_RECIPES_WEBHOOK_SECRET`, and `FAMILY_RECIPES_DATABASE_URL` as secrets only after the separate Telegram bot and least-privilege login role are ready. Never commit secret values.

## Tests
Run `deno test tests/` (Deno must be installed). Tests have not yet been executed in the target runtime.

## Database
The private schema migration `create_family_recipes_private_schema` was applied via Supabase migration integration. Before adding new migrations, reconcile remote migration history with the local project. Do not run `db reset` or blindly push migrations.

## Known limitations
Current webhook update deduplication is at-most-once: if Telegram sending fails after the update ID is inserted, retry will be skipped. Resolve with a recoverable processing state before production. Database role `family_recipes_app` is NOLOGIN; a scoped login credential and secure pooler connection are still required.
