import { ensureSchema, closeDatabase } from "./index.js";
import { logger } from "../utils/logger.js";

async function runMigrations() {
  try {
    logger.info("Running database migrations / schema initialization...");
    await ensureSchema();
    logger.info("Migrations completed successfully.");
  } catch (err) {
    logger.error({ err }, "Migration failed");
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

runMigrations();
