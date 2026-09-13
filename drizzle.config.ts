import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// `pnpm db:push:prod` and `pnpm db:studio:prod` target production; the other scripts use the development database.
config({ path: process.env.npm_lifecycle_event?.endsWith(":prod") ? ".env.production.local" : ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
