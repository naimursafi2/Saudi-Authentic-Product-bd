/**
 * TEMPORARY / DEVELOPMENT-ONLY launcher.
 *
 * Runs `tsx watch src/server.ts` with NODE_OPTIONS set so the DNS preload
 * (see dev-dns-preload.cjs) reaches the actual server process that tsx
 * spawns for hot-reload, not just this wrapper. This is the default local
 * `npm run dev` path on this Windows workspace; production remains unaffected.
 */
const path = require("path");
const { spawn } = require("child_process");

const preloadPath = path.join(__dirname, "dev-dns-preload.cjs");
const tsxCli = path.join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs");

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, `-r ${preloadPath}`].filter(Boolean).join(" "),
};

const child = spawn(process.execPath, [tsxCli, "watch", "src/server.ts"], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
  env,
});

child.on("exit", (code) => process.exit(code ?? 0));
