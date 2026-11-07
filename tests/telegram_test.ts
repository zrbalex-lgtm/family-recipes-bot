import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validWebhookSecret } from '../supabase/functions/_shared/auth.ts';
import { parseUpdate, replyFor } from '../supabase/functions/_shared/telegram.ts';

test('webhook secret rejects wrong or missing values', () => {
  assert.equal(validWebhookSecret('abc','abc'),true);
  assert.equal(validWebhookSecret('abc','abd'),false);
  assert.equal(validWebhookSecret(null,'abc'),false);
  assert.equal(validWebhookSecret('',''),false);
});
test('parses valid update', () => {
  const u = parseUpdate({update_id:1,message:{chat:{id:12,type:'private'},from:{id:12},text:'/start'}});
  assert.equal(replyFor(u!)?.chatId,12);
});
test('rejects malformed update', () => {
  assert.equal(parseUpdate({update_id:1,message:{chat:null}}),null);
  assert.equal(parseUpdate({update_id:'1'}),null);
});
test('ignores groups and mismatched senders', () => {
  assert.equal(replyFor(parseUpdate({update_id:1,message:{chat:{id:-1,type:'group'},from:{id:12},text:'/start'}})!),null);
  assert.equal(replyFor(parseUpdate({update_id:1,message:{chat:{id:13,type:'private'},from:{id:12},text:'/start'}})!),null);
});
test('Russian help and unknown command', () => {
  assert.match(replyFor(parseUpdate({update_id:1,message:{chat:{id:12,type:'private'},from:{id:12},text:'/help'}})!)!.text,/справки|доступны/);
  assert.equal(replyFor(parseUpdate({update_id:1,message:{chat:{id:12,type:'private'},from:{id:12},text:'/unknown'}})!),null);
});
