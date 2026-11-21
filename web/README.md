# Семейная книга — веб-редактор

React + TypeScript + Vite. Ветка разработки: `feature/web-recipe-editor`.

## Запуск

`npm install` затем `cp .env.example .env.local`, заполнить публичные параметры Supabase, `npm run dev`.

**Безопасность:** никогда не помещать database URL, service_role или токен Telegram в браузер. Интерфейс ожидает отдельную Edge Function `family-recipes-web`, проверяющую JWT и семейный allowlist. До реализации и проверки API интерфейс не публиковать. Доступ только для явно приглашённых пользователей.
