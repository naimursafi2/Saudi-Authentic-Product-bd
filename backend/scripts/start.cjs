/**
 * TEMPORARY / DEVELOPMENT-ONLY launcher.
 *
 * Wraps `node dist/server.js` so the DNS preload (see dev-dns-preload.cjs)
 * is applied automatically, without requiring NODE_OPTIONS to be set by
 * hand. `require()` is synchronous, so `dns.setServers(...)` runs and
 * completes before dist/server.js (and therefore the Mongoose connection
 * it opens) is ever loaded.
 *
 * This exists because of the same machine-local DNS resolver bug described
 * in dev-dns-preload.cjs — not because production deployments in general
 * need it. If this app is ever deployed to a real production host where
 * that bug doesn't exist, this script can be simplified back to a plain
 * `node dist/server.js`.
 */
require("./dev-dns-preload.cjs");
require("../dist/server.js");
