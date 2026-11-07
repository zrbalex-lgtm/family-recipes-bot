# Family Recipes Bot

Private Telegram bot: [@Recipes_zrb_bot](https://t.me/Recipes_zrb_bot). Supabase project `opufwbpkuofxhfmlqhqq`.

## Status
Phase 1 pre-deployment preparation. **Not deployed; no webhook configured.** The user reports adding `FAMILY_RECIPES_TELEGRAM_TOKEN` to Supabase Secrets, but it has not been independently verified.

## Isolation
Six tables in private schema `family_recipes`. Never change `parent_control` or the existing `telegram-bot` function.

## Applied migrations
These exact remote versions are mirrored under `supabase/migrations`:
- 20261107093258_create_family_recipes_private_schema
- 20261107213548_family_recipes_recoverable_webhook_updates
- 20261107213855_family_recipes_dedicated_login_without_password
- 20261107213858_family_recipes_login_inherit_app_permissions
- 20261107214000_family_recipes_login_explicit_access

Do **not** reapply them to this Supabase project. Do not run `supabase db reset` against the shared database.

## Database role
`family_recipes_login` exists and has verified schema usage and SELECT permission for the bot allowlist. It has **no password** and therefore cannot connect yet. Set a secure password outside chat, and store its transaction pooler URL as `FAMILY_RECIPES_DATABASE_URL` Supabase Secret before deployment.

## Tests
Five pure-module tests passed using Node.js v22 `node --experimental-strip-types --test tests/telegram_test.ts` in a local copy. Full Deno type checking and live database/Telegram integration tests have not been run. See `docs/deployment-checklist.md`.

## Delivery semantics
Only /start and /help are implemented. Confirmed Telegram rejections are retryable; ambiguous send timeouts are not retried automatically to avoid duplicates. Processing crashes require manual review of the `processed_updates` table. No claim of exactly-once delivery.
