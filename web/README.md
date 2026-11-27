# Семейная книга — веб-редактор

React + TypeScript + Vite. Ветка разработки: `feature/web-recipe-editor`.

## Запуск

`npm install` затем `cp .env.example .env.local`, заполнить публичные параметры Supabase, `npm run dev`.

**Безопасность:** никогда не помещать database URL, service_role или токен Telegram в браузер. Интерфейс ожидает отдельную Edge Function `family-recipes-web`, проверяющую JWT и семейный allowlist. До реализации и проверки API интерфейс не публиковать. Доступ только для явно приглашённых пользователей.

## API и доступ

API: `supabase/functions/family-recipes-web/index.ts`. Доступ только после проверки Supabase Auth JWT и членства в `family_recipes.web_members` (по `auth.users.id`). Добавление пользователей требует явного приглашения. Записи рецептов обновляются атомарно с проверкой версии; при конфликте сохранение отклоняется. Веб-интерфейс не использует Gemini для редактирования.

Пока не настроен первый пользователь Auth, не проверен end-to-end сценарий и не настроен GitHub Pages. Публикация ожидает этих проверок.
