# Family Recipes Bot

Private family Telegram recipe bot: [@Recipes_zrb_bot](https://t.me/Recipes_zrb_bot). Supabase project: `opufwbpkuofxhfmlqhqq`.

## Phase 1 status
Infrastructure and source code prepared. **Not deployed**; no Telegram webhook configured. Telegram token is user-managed in Supabase Secrets, and its presence/value has not been independently verified.

## Isolation
All six application tables are in private `family_recipes` schema. The existing `parent_control` schema and `telegram-bot` Edge Function must never be changed. The new function is `family-recipes-bot`.

## Database migrations
Two migrations have already been applied remotely and are mirrored here with matching versions:
- `20261107093258_create_family_recipes_private_schema.sql`
- `20261107213548_family_recipes_recoverable_webhook_updates.sql`

**Do not apply them again to the existing project.** Verify remote/local migration history before any future deployment. Do not run `supabase db reset` on this shared project.

## Required secrets
- `FAMILY_RECIPES_TELEGRAM_TOKEN` - user reports it was set in Supabase Secrets
- `FAMILY_RECIPES_WEBHOOK_SECRET` - not configured
- `FAMILY_RECIPES_DATABASE_URL` - not configured

Never commit secret values. `family_recipes_app` is a NOLOGIN role, so a restricted login role, connection setup and privilege verification are pending.

## Tests
`deno test tests/` (Deno required). Tests have **not** been executed in the target runtime. No integration tests have been run.

## Important delivery caveat
Webhook processing now uses a lease and retryable status. A failed send is retryable, but a network timeout after Telegram accepted a message can still cause duplicate replies; a lease expiring during a slow request can also permit a second worker to process the same update. Resolve this before production. Only /start and /help are implemented.
