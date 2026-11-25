# Telegram webhook setup (operator procedure)

The deployed Edge Function must not call setWebhook on ordinary user requests. Configure Telegram webhook separately during setup/deployment, with an operator holding the bot token and the webhook secret.

Required Telegram webhook parameters:
- URL: https://<supabase-project-ref>.supabase.co/functions/v1/family-recipes-bot
- secret_token: the existing FAMILY_RECIPES_WEBHOOK_SECRET value
- allowed_updates: ["message", "callback_query"]
- drop_pending_updates: false

Before changing settings, inspect getWebhookInfo and preserve any additional intentionally enabled update types. Never print, commit, or send bot tokens or webhook secrets in chat or logs.

Validation:
1. getWebhookInfo shows the expected URL and includes callback_query.
2. A test draft offers inline buttons.
3. Cancel removes the buttons and sets the draft status to cancelled.
4. Repeated/stale callback is harmless and returns an informative response.

Do not modify the unrelated telegram-bot Edge Function or parent_control schema.
