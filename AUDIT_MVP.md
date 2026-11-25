# MVP technical audit (2026-11-08)

Source: deployed Supabase Edge Function family-recipes-bot v22, snapshotted in this branch. This is a review, not a production change.

## Confirmed
- GitHub main is behind the deployed Edge Function. Snapshot of all five deployed source files is in this branch.
- Dedicated family_recipes schema and login role exist; anon/authenticated/service_role lack schema USAGE. RLS is enabled on six family_recipes tables. RLS policies and role table grants require separate review.
- Telegram update IDs are recorded in processed_updates; 36 records had status done at audit time.
- Basic text create, edit, search, inline-button cancellation, photo parsing, JSON export were manually exercised, but no comprehensive automated tests have been established.

## High priority findings
1. processed_updates claim permits retry only for status retryable, not expired processing leases. A worker interrupted after claim may leave an update permanently unprocessed. Reconcile retry semantics and Telegram send idempotency before deploying.
2. The webhook handler invokes ensureCallbackUpdates() from a request path. Webhook configuration should be a deployment/setup step, not a recurring runtime side effect.
3. The generic catch converts some operation errors into a Telegram success reply and marks the update done. Distinguish transient AI/DB/Telegram failures from invalid recipe input.
4. GitHub main lacks deployed functionality. Avoid deploying main until code has been reviewed and merged.
5. /export selects at most 2000 recipes without indicating truncation. Add explicit count/pagination and size safeguards.
6. 'Покажи все рецепты' returned a single recipe in manual testing; prioritize explicit intent before contextual 'show recipe' logic.
7. Image parsing can lose numerical quantities and text parsing can invent units. Add fixture tests and validation before acceptance.
8. Callback handlers should verify draft ID, draft type, actor, and current status, and handle repeated/stale presses explicitly.

## Next release gate
- Static checks + unit tests for intent routing, normalization, callbacks and draft state transitions.
- Database integration tests with rollback or isolated fixtures.
- Telegram webhook replay / duplicate / timeout simulations.
- Security review of grants, RLS policies, secrets exposure and logging.
- Only then merge and deploy with rollback instructions.

Do not touch parent_control or unrelated Edge Functions.

## Audit progress
- GitHub Actions Deno unit tests and type checking passed on commit 78ee331459e9815259d6eb60e690593fad09f7c5 (run 42479877667). Further commits require fresh CI.
- Reviewed pg_policies: six tables have permissive ALL policies for backend roles family_recipes_app and family_recipes_login. Those policies are acceptable only because the Edge Function authenticates/authorizes the Telegram user and credentials are secret. They do not enforce per-user authorization inside the DB. Review the role membership and secret exposure before wider access.
- Removed webhook reconfiguration from request handling in the audit branch; setup is now documented in docs/telegram-webhook.md.
- No production deploy or database mutation performed during this audit.
