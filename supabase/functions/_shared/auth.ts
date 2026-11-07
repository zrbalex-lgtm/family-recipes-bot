export function validWebhookSecret(received: string | null, expected: string): boolean {
  if (!received || !expected || received.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}
