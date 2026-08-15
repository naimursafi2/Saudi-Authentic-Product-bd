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
 * `npm run dev` can connect while the underlying Windows config is cleaned
 * up separately. It is loaded via `-r` BEFORE any application code runs, so
 * it must stay outside `src/` — do not import it from app code, and do not
 * wire it into `npm start` / production.
 */
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);
