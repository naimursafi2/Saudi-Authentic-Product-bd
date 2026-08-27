import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/db";
import { ensureSystemRoles } from "./services/role.service";
import { startCampaignScheduler } from "./services/scheduler.service";


async function main() {
  await connectDatabase();
  // Seeds the seven built-in roles if they aren't in the database yet, the
  // same lazily-seeded-singleton pattern SiteSettings and StaticPage use.
  // resolvePermissions() falls back to the compiled-in defaults if this
  // hasn't run, so a cold start is never unauthorized by accident.
  await ensureSystemRoles();
  // Drives weekly/monthly/custom campaign sends from the server itself, so
  // a scheduled campaign fires whether or not any browser is open.
  startCampaignScheduler();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`Saudi Authentic Product API running on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`   API base: http://localhost:${env.PORT}${env.API_PREFIX}`);
  });

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
