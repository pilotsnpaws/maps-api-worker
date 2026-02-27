---
trigger: always_on
---

- after any change, you must run tests via `npm test` 
- for changes in tsconfig.json, wrangler.toml, or any other file that affects the runtime types, run `npx wrangler types`
 