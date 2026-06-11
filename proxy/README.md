# SubstrateOS — Hardened WISP Networking Proxy (Phase 3)

Bridges the in-browser VM's emulated NE2000 NIC to the real internet, but only
under ETI's control: **allowlist + port restriction + SSRF guards + per-client
rate limit + connection audit**. Built on `@mercuryworkshop/wisp-js`.

## Run locally

```bash
cd proxy
npm install
node server.mjs                 # ws://localhost:6001/  (use as wisp://localhost:6001/)
```

Then open the app with the relay configured:

```
http://localhost:5173/?engine=kernel&net=wisp://localhost:6001/
```

In the VM, bring networking up (until the image auto-DHCPs):

```sh
udhcpc -i eth0 -n -q          # gets a virtual lease via WISP
wget -O- http://github.com    # reaches allowlisted hosts; others are refused
```

## How v86 talks to it (important)

- v86 picks its relay protocol from the **URL scheme**: `ws://`/`wss://` = raw
  ethernet websockproxy; **`wisp://`/`wisps://` = WISP**. Use `wisp://` (or
  `wisps://` for TLS) so v86 speaks WISP to this server.
- v86's WISP client resolves DNS **locally** and opens TCP streams to **IPs**, not
  hostnames. So hostname allowlisting is implemented by **pre-resolving the
  allowlisted hostnames to their IPs** and allowing those (refreshed every 5 min).

## Egress policy

**Default (functional): public web on web ports, with SSRF guards.** The VM can
reach any *public* host on ports 53/80/443; private/loopback IPs are blocked; per-
client rate limit + audit apply. HTTP **and HTTPS** work (verified). This is the
default because a strict per-host allowlist is impractical with v86 (see below).

**Strict mode (opt-in): `WISP_STRICT_ALLOWLIST=1`.** Additionally restricts to the
pre-resolved IPs of `WISP_ALLOWLIST` hosts. Accept the CDN fragility (below).

| Control | Default | Env |
|---|---|---|
| Egress | public web + SSRF + ports | `WISP_STRICT_ALLOWLIST=1` for host allowlist |
| Host allowlist (strict only) | example/github/pypi/npm/debian/… | `WISP_ALLOWLIST` (comma, `*.` ok) |
| Port allowlist | 53, 80, 443 | — |
| SSRF guard | private + loopback IPs blocked | — |
| Per-client rate limit | 30 new conns / 60s / IP | `WISP_MAX_CONN`, `WISP_WINDOW_MS` |
| Stream cap | 64 total | — |
| Audit | every connect/deny to stdout | — |

## Why the strict allowlist is opt-in (v86 + WISP realities)

1. **v86's WISP client resolves DNS locally and opens streams to IPs**, not names —
   so allowlisting works only by pre-resolving hostnames to IPs. Multi-provider
   hosts (`example.com` spans Cloudflare **and** AWS) return IPs that differ between
   the proxy's resolver and the VM's, so legitimate traffic gets refused. Real fix
   for strict per-host control: forward DNS through the proxy so VM + proxy share
   resolution. Tracked for deploy.
2. **wisp-js 0.4.1 bug:** do NOT set `stream_limit_per_host` — `filter.mjs:103`
   iterates the streams object with `for..of` (`connection.streams is not iterable`),
   which silently kills every stream. We use `stream_limit_total` (correct) + our own
   per-client rate limiter instead. Upstream fix: `Object.values(connection.streams)`.

## Deployment (ETI-hosted)

Not yet deployed — target (Cloudflare Workers vs Railway) is a pending decision.
The allowlist + rate-limit + audit are the egress controls the §0 / program spec
require; this server is the enforcement point. **Do not** point production at a
third-party public relay.
