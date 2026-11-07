import { validWebhookSecret } from '../supabase/functions/_shared/auth.ts';
import { parseUpdate } from '../supabase/functions/_shared/telegram.ts';
Deno.test('webhook secret must match', () => {
  if (!validWebhookSecret('secret','secret')) throw new Error('valid rejected');
  if (validWebhookSecret('wrong','secret')) throw new Error('invalid accepted');
  if (validWebhookSecret(null,'secret')) throw new Error('missing accepted');
});
Deno.test('update shape validated', () => {
  if (parseUpdate({update_id: 1, message:{chat:{id:1,type:'private'},from:{id:1},text:'/start'}}) === null) throw new Error('valid rejected');
  if (parseUpdate({update_id: 2, message:{chat:null}}) !== null) throw new Error('invalid accepted');
});
