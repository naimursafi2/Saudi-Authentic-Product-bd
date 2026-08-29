import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/db";
import { ensureSystemRoles } from "./services/role.service";
import { startCampaignScheduler } from "./services/scheduler.service";

const DATABASE_RETRY_DELAY_MS = 10_000;
let schedulerStarted = false;

async function initializeDatabase(): Promise<void> {
  try {
    await connectDatabase();
    // Seeds the seven built-in roles if they aren't in the database yet, the
    // same lazily-seeded-singleton pattern SiteSettings and StaticPage use.
    // resolvePermissions() falls back to the compiled-in defaults if this
    // hasn't run, so a cold start is never unauthorized by accident.
    await ensureSystemRoles();
    // Drives weekly/monthly/custom campaign sends from the server itself, so
    // a scheduled campaign fires whether or not any browser is open.
    if (!schedulerStarted) {
      schedulerStarted = true;
      startCampaignScheduler();
    }
  } catch (err) {
    console.error(
      `MongoDB is unavailable; retrying in ${DATABASE_RETRY_DELAY_MS / 1000}s:`,
      (err as Error).message
    );
    setTimeout(() => void initializeDatabase(), DATABASE_RETRY_DELAY_MS);
  }
}

async function main() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`Saudi Authentic Product API running on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`   API base: http://localhost:${env.PORT}${env.API_PREFIX}`);
  });

  // Do not make the HTTP server disappear when Atlas is briefly unreachable.
  // The retry loop keeps attempting the configured database in the background,
  // while the frontend receives ordinary API responses instead of ECONNREFUSED.
  void initializeDatabase();

  const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
