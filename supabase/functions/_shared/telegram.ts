export type TelegramUpdate = {
  update_id: number;
  callback_query?: {id:string;from:{id:number};data?:string;message?:{message_id:number;chat:{id:number;type:string}}};
  message?: { chat: { id: number; type: string }; from?: { id: number }; text?: string; caption?:string; photo?:{file_id:string;file_size?:number;width:number;height:number}[] };
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
export async function sendMessage(token: string, chatId: number, text: string, buttons?:{text:string;callback_data:string}[]): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...(buttons?.length?{reply_markup:{inline_keyboard:[buttons]}}:{}) }), signal: AbortSignal.timeout(8000),
  });
  // Non-2xx is a confirmed rejection; a timeout is ambiguous.
  if (!response.ok) throw new TelegramRejected(`Telegram HTTP ${response.status}`);
}

export async function answerCallback(token:string,id:string):Promise<void>{
  await fetch('https://api.telegram.org/bot'+token+'/answerCallbackQuery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({callback_query_id:id}),signal:AbortSignal.timeout(8000)});
}
export async function clearButtons(token:string,chatId:number,messageId:number):Promise<void>{
  await fetch('https://api.telegram.org/bot'+token+'/editMessageReplyMarkup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,message_id:messageId,reply_markup:{inline_keyboard:[]}}),signal:AbortSignal.timeout(8000)});
}

export async function getTelegramPhoto(token:string,fileId:string):Promise<{mime:string;bytes:Uint8Array}>{
  const meta=await fetch('https://api.telegram.org/bot'+token+'/getFile?file_id='+encodeURIComponent(fileId),{signal:AbortSignal.timeout(10000)});
  if(!meta.ok)throw new Error('Telegram file metadata failed');
  const data=await meta.json();
  const path=data?.result?.file_path;
  if(!data?.ok||typeof path!=='string'||!/^photos\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png|webp)$/i.test(path))throw new Error('Unsupported Telegram photo');
  const response=await fetch('https://api.telegram.org/file/bot'+token+'/'+path,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Telegram photo download failed');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>8_000_000)throw new Error('Photo too large');
  return {mime:path.toLowerCase().endsWith('.png')?'image/png':path.toLowerCase().endsWith('.webp')?'image/webp':'image/jpeg',bytes};
}
export async function sendJsonExport(token:string,chatId:number,body:string):Promise<void>{
  const form=new FormData();
  form.append('chat_id',String(chatId));
  form.append('caption','Экспорт семейной книги рецептов');
  form.append('document',new Blob([body],{type:'application/json'}),'family-recipes.json');
  const response=await fetch('https://api.telegram.org/bot'+token+'/sendDocument',{method:'POST',body:form,signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new TelegramRejected('Telegram document send failed');
}
