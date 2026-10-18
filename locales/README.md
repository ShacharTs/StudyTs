# StudyTS Locale Packs

This directory holds drop-in translation JSON files (e.g. `fr.json`, `es.json`, `ar.json`).

- Adding a `.json` file here makes the language immediately available in the application without rebuilding or restarting.
- To generate a new translation template: `npm run i18n:new <code>` (e.g. `npm run i18n:new fr --name "Français"`).
- To verify translations and missing keys: `npm run i18n:check`.
- For full instructions and format guidelines, see `docs/translating.md`.
