# Deployment gate (not approved yet)

1. Check remote migration history, and reconcile exact migration versions before running CLI.
2. Set a strong random password for `family_recipes_login` using a secure channel (not GitHub or chat).
3. Store the **transaction pooler** Postgres URL with this role in `FAMILY_RECIPES_DATABASE_URL` Supabase Secret, SSL enabled. Test connectivity and table permissions without logging the URL.
4. Verify `FAMILY_RECIPES_TELEGRAM_TOKEN` exists (user says configured). Do not expose it.
5. Generate a distinct unpredictable `FAMILY_RECIPES_WEBHOOK_SECRET`, store in Supabase Secrets, and configure the same value with Telegram at webhook setup.
6. Populate `family_recipes.bot_users` with approved family Telegram numeric IDs only. Usernames are not authorization.
7. Run Node tests (`node --experimental-strip-types --test tests/telegram_test.ts`) and Deno type checks in an environment with Deno installed.
8. Review security advisors, confirm private schema is not in exposed Data API schemas, confirm existing `telegram-bot` SHA.
9. Obtain explicit permission for Edge Function deployment, then separate explicit permission for setting Telegram webhook.
10. Test authorized /start and /help, denied unauthorized users and group messages, wrong secret, duplicate updates, and failed Telegram sends.

## Delivery guarantees
Telegram's sendMessage does not provide an idempotency key. A confirmed non-2xx response can be retried; an ambiguous network timeout is not retried to avoid duplicate messages and must be reviewed manually. A crash during processing can leave a `processing` row; operators must review it rather than blindly replaying. This is a conscious at-most-once delivery tradeoff.
