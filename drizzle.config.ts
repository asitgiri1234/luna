import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration — used only at development time to generate
 * SQL migrations from `electron/backend/db/schema.ts` into `drizzle/`.
 * Migrations are applied at app startup by `electron/backend/db/client.ts`.
 */
export default defineConfig({
  schema: "./electron/backend/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
