import postgres from 'npm:postgres@3.4.7';
export function createDatabase(url: string) {
  return postgres(url, { max: 1, prepare: false, idle_timeout: 10, connect_timeout: 5 });
}
