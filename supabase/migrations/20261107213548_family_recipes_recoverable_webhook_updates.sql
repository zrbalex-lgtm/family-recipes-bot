alter table family_recipes.processed_updates
 add column status text not null default 'done' check(status in ('processing','done','retryable')),
 add column attempts integer not null default 1 check(attempts>0),
 add column lease_until timestamptz,
 add column completed_at timestamptz;
create index processed_updates_retry_idx on family_recipes.processed_updates(status,lease_until) where status <> 'done';
