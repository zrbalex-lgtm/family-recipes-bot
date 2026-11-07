grant usage on schema family_recipes to family_recipes_login;
grant select,insert,update,delete on all tables in schema family_recipes to family_recipes_login;
create policy recipes_login on family_recipes.recipes for all to family_recipes_login using(true) with check(true);
create policy ingredients_login on family_recipes.recipe_ingredients for all to family_recipes_login using(true) with check(true);
create policy drafts_login on family_recipes.recipe_drafts for all to family_recipes_login using(true) with check(true);
create policy users_login on family_recipes.bot_users for all to family_recipes_login using(true) with check(true);
create policy sessions_login on family_recipes.bot_sessions for all to family_recipes_login using(true) with check(true);
create policy updates_login on family_recipes.processed_updates for all to family_recipes_login using(true) with check(true);
