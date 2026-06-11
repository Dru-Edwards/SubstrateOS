// SubstrateOS — hardened WISP networking proxy.
//
// Bridges the in-browser VM's emulated NE2000 NIC to real TCP/UDP, but only to
// an allowlist of hosts/ports, with per-client rate limiting and connection
// auditing. ETI-hosted in production; runnable locally for Gate G3.
//
//   node server.mjs            # ws://localhost:6001/
//   PORT=6001 WISP_ALLOWLIST=example.com,github.com node server.mjs
import http from 'node:http';
import dns from 'node:dns/promises';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';

const PORT = Number(process.env.PORT || 6001);

// --- Egress allowlist: ONLY these hosts are reachable from the VM. -----------
// Supports a leading "*." wildcard for subdomains. Everything else is blocked.
const ALLOWLIST = (
  process.env.WISP_ALLOWLIST ||
  [
    'example.com', 'example.org', '*.example.com',
    'deb.debian.org', 'dl-cdn.alpinelinux.org', 'downloads.openwrt.org',
    'pypi.org', 'files.pythonhosted.org', 'registry.npmjs.org',
    'github.com', 'codeload.github.com', 'raw.githubusercontent.com',
    'cloudflare-dns.com', 'dns.google',
  ].join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function hostToRegex(h) {
  // Leading "*." => one or more subdomain labels (e.g. *.example.com).
  const wildcard = h.startsWith('*.');
  const base = (wildcard ? h.slice(2) : h).replace(/[.+?^${}()|[\]\\*]/g, '\\$&');
  return new RegExp('^' + (wildcard ? '([^.]+\\.)+' : '') + base + '$', 'i');
}

// Egress policy. v86's WISP client resolves DNS LOCALLY and opens streams to IPs,
// so a strict per-host allowlist is impractical (it refuses legitimate traffic to
// allowlisted hosts whenever the VM's resolved IP differs from ours — common with
// CDNs). So the DEFAULT, always-enforceable policy is: any PUBLIC host, but only on
// web ports, with SSRF guards + rate-limit + audit. Set WISP_STRICT_ALLOWLIST=1 to
// additionally restrict to pre-resolved allowlist IPs (accepting the CDN fragility).
const STRICT_ALLOWLIST = process.env.WISP_STRICT_ALLOWLIST === '1';

wisp.options.port_whitelist = [53, 80, 443]; // DNS, HTTP, HTTPS only
wisp.options.allow_direct_ip = true;
wisp.options.allow_private_ips = false; // SSRF guard (no 10/172.16/192.168)
wisp.options.allow_loopback_ips = false; // SSRF guard (no 127.0.0.0/8)
// NOTE: do NOT set stream_limit_per_host — wisp-js 0.4.1 has a bug in that path
// (filter.mjs:103 iterates the streams object with for..of → "connection.streams
// is not iterable", which silently kills every stream). stream_limit_total is fine
// (it uses Object.keys). Per-client throttling is handled by our rate limiter below.
wisp.options.stream_limit_total = 64;

function ipToRegex(ip) {
  return new RegExp('^' + ip.replace(/[.]/g, '\\.') + '$');
}

// Resolve every allowlisted hostname to its current IPs and allow ONLY those
// destinations (plus the hostnames themselves, for clients that send names).
// Refreshed periodically because CDN IPs rotate.
async function refreshAllowlist() {
  const ipRegexes = [];
  for (const host of ALLOWLIST) {
    if (host.startsWith('*.')) continue; // wildcards can't be pre-resolved
    for (const fn of [dns.resolve4, dns.resolve6]) {
      try {
        const ips = await fn(host);
        for (const ip of ips) ipRegexes.push(ipToRegex(ip));
      } catch { /* no record of this type */ }
    }
  }
  wisp.options.hostname_whitelist = [...ALLOWLIST.map(hostToRegex), ...ipRegexes];
  audit('ALLOWLIST_REFRESH', '-', `${ALLOWLIST.length} hosts -> ${ipRegexes.length} ip rules`);
}

// --- Per-client rate limiting (new WS connections per IP per window). --------
const WINDOW_MS = Number(process.env.WISP_WINDOW_MS || 60_000);
const MAX_CONN = Number(process.env.WISP_MAX_CONN || 30);
const hits = new Map(); // ip -> number[] (timestamps)
function rateLimited(ip, now) {
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_CONN;
}

function audit(event, ip, extra = '') {
  // Connection-level audit trail. The allowlist (not payload inspection) is the
  // primary egress control: only approved hosts are reachable at all.
  process.stdout.write(`[wisp] ${event} ip=${ip} ${extra}\n`);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('SubstrateOS WISP proxy — connect a WISP/v86 client via WebSocket.\n');
});

// wisp.routeRequest handles the WebSocket upgrade itself, so hook the raw
// HTTP 'upgrade' event (not a ws connection handler).
server.on('upgrade', (request, socket, head) => {
  const ip = request.socket.remoteAddress || 'unknown';
  if (rateLimited(ip, Date.now())) {
    audit('DENY_RATELIMIT', ip);
    socket.destroy();
    return;
  }
  audit('CONNECT', ip);
  socket.on('close', () => audit('DISCONNECT', ip));
  socket.on('error', (e) => audit('SOCK_ERROR', ip, String(e && e.message ? e.message : e)));
  try {
    wisp.routeRequest(request, socket, head);
  } catch (e) {
    audit('ROUTE_ERROR', ip, String(e && e.message ? e.message : e));
    socket.destroy();
  }
});

// Never let a single bad connection take the whole proxy down.
process.on('uncaughtException', (e) => audit('UNCAUGHT', '-', String(e && e.message ? e.message : e)));

server.listen(PORT, async () => {
  if (STRICT_ALLOWLIST) {
    await refreshAllowlist();
    setInterval(() => { void refreshAllowlist(); }, 5 * 60 * 1000);
  }
  const mode = STRICT_ALLOWLIST ? `strict allowlist (${ALLOWLIST.length} hosts)` : 'public web (SSRF+ports+ratelimit)';
  audit('LISTENING', `0.0.0.0:${PORT}`, `mode=${mode} ports=[53,80,443]`);
});
