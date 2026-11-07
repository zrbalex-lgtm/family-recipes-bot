import { createDatabase } from '../_shared/database.ts';
import { validWebhookSecret } from '../_shared/auth.ts';
import { parseUpdate, sendMessage } from '../_shared/telegram.ts';

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
  try { update = parseUpdate(await request.json()); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (!update) return new Response('Invalid update', { status: 400 });
  const message = update.message;
  if (!message || message.chat.type !== 'private' || !message.from || message.chat.id !== message.from.id) return ok();
  try {
    const users = await db`select 1 from family_recipes.bot_users where telegram_user_id=${message.from.id} and is_active=true limit 1`;
    if (!users.length) return ok();
    const inserted = await db`insert into family_recipes.processed_updates(update_id) values (${update.update_id}) on conflict do nothing returning update_id`;
    if (!inserted.length) return ok();
    const command = message.text?.split(/\s+/)[0]?.split('@')[0]?.toLowerCase();
    if (command === '/start') await sendMessage(token, message.chat.id, 'Добро пожаловать в семейную книгу рецептов! Используйте /help для справки.');
    else if (command === '/help') await sendMessage(token, message.chat.id, 'Сейчас доступны /start и /help. Добавление и поиск рецептов появятся в следующих этапах.');
    return ok();
  } catch (error) {
    console.error('Webhook processing failed', { type: error instanceof Error ? error.name : 'unknown' });
    return new Response('Temporary error', { status: 503 });
  }
});
