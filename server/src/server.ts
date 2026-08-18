import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/db";


async function main() {
  await connectDatabase();

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
