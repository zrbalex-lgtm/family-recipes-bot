import { createDatabase } from '../_shared/database.ts';
import { validWebhookSecret } from '../_shared/auth.ts';
import { parseUpdate, replyFor, sendMessage, TelegramRejected } from '../_shared/telegram.ts';

const token = Deno.env.get('FAMILY_RECIPES_TELEGRAM_TOKEN') ?? '';
const secret = Deno.env.get('FAMILY_RECIPES_WEBHOOK_SECRET') ?? '';
const databaseUrl = Deno.env.get('FAMILY_RECIPES_DATABASE_URL') ?? '';
const db = databaseUrl ? createDatabase(databaseUrl) : null;
const ok = () => new Response('OK', { status: 200 });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!validWebhookSecret(request.headers.get('X-Telegram-Bot-Api-Secret-Token'), secret)) return new Response('Unauthorized', { status: 401 });
  if (!token || !db) return new Response('Service unavailable', { status: 503 });
  if (Number(request.headers.get('content-length') ?? 0) > 65536) return new Response('Too large', { status: 413 });
  let update;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 65536) return new Response('Too large', { status: 413 });
    update = parseUpdate(JSON.parse(body));
  } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (!update) return new Response('Invalid update', { status: 400 });
  const reply = replyFor(update);
  if (!reply) return ok();

  try {
    const users = await db`select 1 from family_recipes.bot_users where telegram_user_id=${reply.userId} and is_active=true limit 1`;
    if (!users.length) return ok();
    const claimed = await db`
      insert into family_recipes.processed_updates (update_id,status,lease_until)
      values (${update.update_id},'processing',now()+interval '30 seconds')
      on conflict (update_id) do update
        set status='processing', attempts=family_recipes.processed_updates.attempts+1,
            lease_until=now()+interval '30 seconds'
        where family_recipes.processed_updates.status='retryable'
      returning update_id
    `;
    if (!claimed.length) return ok();
    try {
      await sendMessage(token, reply.chatId, reply.text);
      await db`update family_recipes.processed_updates set status='done', lease_until=null, completed_at=now() where update_id=${update.update_id}`;
    } catch (error) {
      // A network failure after send is ambiguous: never automatically re-send.
      const confirmedRejected = error instanceof TelegramRejected;
      await db`update family_recipes.processed_updates
        set status=${confirmedRejected ? 'retryable' : 'done'}, lease_until=null,
            completed_at=case when ${confirmedRejected} then null else now() end
        where update_id=${update.update_id} and status='processing'`;
      if (confirmedRejected) throw error;
      console.error('Ambiguous Telegram send: manual review required', { updateId: update.update_id });
    }
    return ok();
  } catch (error) {
    console.error('Webhook processing failed', { type: error instanceof Error ? error.name : 'unknown' });
    return new Response('Temporary error', { status: 503 });
  }
});
