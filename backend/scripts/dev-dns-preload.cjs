/**
 * TEMPORARY / DEVELOPMENT-ONLY workaround.
 *
 * On this machine, Node's built-in DNS resolver (used internally by the
 * MongoDB driver for `mongodb+srv://` SRV lookups) reports 127.0.0.1 as its
 * server instead of the real network DNS server, causing
 * `querySrv ECONNREFUSED` even though the OS resolver works fine. Root cause
 * is a stale/orphaned network adapter registry entry confusing Node's
 * Windows DNS-server enumeration — not an app, Atlas, or network problem.
 *
 * This preload script points Node's resolver at public DNS servers so local
 * dev/start can connect while the underlying Windows config is cleaned up
 * separately. It is loaded BEFORE any application code runs (either via a
 * `require()` at the top of a launcher script, or via `-r` on NODE_OPTIONS),
 * so it must stay outside `src/` — do not import it from app code.
 *
 * Wired into both `npm run dev:dns-fix` (scripts/dev-dns-fix.cjs) and
 * `npm start` (scripts/start.cjs) on this machine, since both need to reach
 * MongoDB Atlas locally. It is still a machine-local workaround, not a
 * real production fix — a deployment on a host without this DNS bug
 * doesn't need it.
 */
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);
