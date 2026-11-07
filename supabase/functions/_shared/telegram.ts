export type TelegramUpdate = {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { id: number }; text?: string };
};
export function parseUpdate(value: unknown): TelegramUpdate | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!Number.isSafeInteger(v.update_id) || (v.update_id as number) < 0) return null;
  const m = v.message;
  if (m !== undefined) {
    if (!m || typeof m !== 'object') return null;
    const msg = m as Record<string, unknown>;
    const chat = msg.chat as Record<string, unknown> | undefined;
    if (!chat || !Number.isSafeInteger(chat.id) || typeof chat.type !== 'string') return null;
    if (msg.from !== undefined && (!msg.from || typeof msg.from !== 'object' || !Number.isSafeInteger((msg.from as Record<string, unknown>).id))) return null;
    if (msg.text !== undefined && typeof msg.text !== 'string') return null;
  }
  return v as TelegramUpdate;
}
export function replyFor(update: TelegramUpdate): { userId: number; chatId: number; text: string } | null {
  const m = update.message;
  if (!m || m.chat.type !== 'private' || !m.from || m.chat.id !== m.from.id) return null;
  const command = m.text?.trim().split(/\s+/)[0]?.split('@')[0]?.toLowerCase();
  if (command === '/start') return { userId: m.from.id, chatId: m.chat.id, text: 'Добро пожаловать в семейную книгу рецептов! Используйте /help для справки.' };
  if (command === '/help') return { userId: m.from.id, chatId: m.chat.id, text: 'Сейчас доступны /start и /help. Добавление и поиск рецептов появятся в следующих этапах.' };
  return null;
}
export class TelegramRejected extends Error {}
export async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(8000),
  });
  // Non-2xx is a confirmed rejection; a timeout is ambiguous.
  if (!response.ok) throw new TelegramRejected(`Telegram HTTP ${response.status}`);
}
