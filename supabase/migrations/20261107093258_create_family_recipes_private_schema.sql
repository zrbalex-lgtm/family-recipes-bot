create schema family_recipes;
create role family_recipes_app nologin;
revoke all on schema family_recipes from public;
grant usage on schema family_recipes to family_recipes_app;
create table family_recipes.recipes (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title))>0),
 description text, category text, tags text[] not null default '{}',
 servings integer check(servings>0), prep_minutes integer check(prep_minutes>=0), cook_minutes integer check(cook_minutes>=0),
 instructions jsonb not null default '[]'::jsonb check(jsonb_typeof(instructions)='array'),
 source_text text, created_by bigint not null, updated_by bigint,
 version integer not null default 1 check(version>0), deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table family_recipes.recipe_ingredients (
 id uuid primary key default gen_random_uuid(), recipe_id uuid not null references family_recipes.recipes(id) on delete cascade,
 name text not null check(length(trim(name))>0), normalized_name text not null,
 original_text text, quantity numeric check(quantity>=0), unit text, note text, sort_order integer not null default 0
);
create table family_recipes.recipe_drafts (
 id uuid primary key default gen_random_uuid(), telegram_user_id bigint not null,
 draft_type text not null check(draft_type in ('create','edit','delete')),
 target_recipe_id uuid references family_recipes.recipes(id),
 payload jsonb not null, status text not null default 'pending' check(status in ('pending','confirmed','cancelled','expired')),
 target_version integer, created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '1 day')
);
create table family_recipes.bot_users (
 telegram_user_id bigint primary key, display_name text, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table family_recipes.bot_sessions (
 telegram_user_id bigint primary key references family_recipes.bot_users(telegram_user_id),
 state text not null default 'idle', active_draft_id uuid references family_recipes.recipe_drafts(id),
 last_search_results jsonb, pending_photo_file_ids jsonb,
 updated_at timestamptz not null default now()
);
create table family_recipes.processed_updates (
 update_id bigint primary key, received_at timestamptz not null default now()
);
create index recipes_created_idx on family_recipes.recipes(created_at desc) where deleted_at is null;
create index recipes_title_idx on family_recipes.recipes using gin(to_tsvector('russian',title)) where deleted_at is null;
create index recipes_tags_idx on family_recipes.recipes using gin(tags) where deleted_at is null;
create index ingredients_recipe_idx on family_recipes.recipe_ingredients(recipe_id,sort_order);
create index ingredients_name_idx on family_recipes.recipe_ingredients(normalized_name);
create index drafts_user_status_idx on family_recipes.recipe_drafts(telegram_user_id,status,expires_at);
create index processed_updates_time_idx on family_recipes.processed_updates(received_at);
grant select,insert,update,delete on all tables in schema family_recipes to family_recipes_app;
alter default privileges in schema family_recipes revoke all on tables from public;
alter table family_recipes.recipes enable row level security;
alter table family_recipes.recipe_ingredients enable row level security;
alter table family_recipes.recipe_drafts enable row level security;
alter table family_recipes.bot_users enable row level security;
alter table family_recipes.bot_sessions enable row level security;
alter table family_recipes.processed_updates enable row level security;
create policy recipes_backend on family_recipes.recipes for all to family_recipes_app using(true) with check(true);
create policy ingredients_backend on family_recipes.recipe_ingredients for all to family_recipes_app using(true) with check(true);
create policy drafts_backend on family_recipes.recipe_drafts for all to family_recipes_app using(true) with check(true);
create policy users_backend on family_recipes.bot_users for all to family_recipes_app using(true) with check(true);
create policy sessions_backend on family_recipes.bot_sessions for all to family_recipes_app using(true) with check(true);
create policy updates_backend on family_recipes.processed_updates for all to family_recipes_app using(true) with check(true);
