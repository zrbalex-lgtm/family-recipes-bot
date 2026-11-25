# Pre-release acceptance checklist

Run against a dedicated test chat/account and disposable test recipes. Do not use family production recipes for deletion tests.

## Automated
- [x] Deno routing unit tests pass in GitHub Actions (latest successful run must match PR HEAD)
- [x] Deno entrypoint type check passes in GitHub Actions
- [ ] Database transaction tests for create/edit/delete with stale draft, wrong user, duplicate callback
- [ ] Telegram update replay tests (duplicate, expired lease, 429, network timeout)
- [ ] Gemini fixtures for English photo, missing units, missing quantities, no recipe

## Manual after staging or approved deploy
- [ ] Show all recipes returns numbered list, not previous recipe
- [ ] Show recipe by number and by context
- [ ] Create short text recipe; cancel and save via inline buttons
- [ ] Edit test recipe; confirm; verify database and no duplicate ingredients
- [ ] Delete test recipe; cancel once, then confirm on new draft
- [ ] Tap stale/repeated inline button; ensure no unintended mutation
- [ ] Upload image of recipe, inspect all quantities and units; cancel
- [ ] Export JSON, compare record count and sample recipe with DB
- [ ] Invalid/no recipe, timeout, and long messages produce safe responses

## Deployment gate
- Review permissions and role grants.
- Confirm webhook settings independently (message and callback_query).
- Confirm Supabase deployed version has not changed since snapshot.
- Approve merge and deployment separately; record version and rollback source.
