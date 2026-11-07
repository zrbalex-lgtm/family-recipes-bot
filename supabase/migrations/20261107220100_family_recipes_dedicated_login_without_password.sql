-- Applied remotely as family_recipes_dedicated_login_without_password.
-- No credentials are stored in migration history or source control.
create role family_recipes_login login password null noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant family_recipes_app to family_recipes_login;
alter role family_recipes_login set search_path = family_recipes, pg_catalog;
