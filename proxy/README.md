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

## Controls (env-configurable)

| Control | Default | Env |
|---|---|---|
| Host allowlist | example/github/pypi/npm/debian/alpine/… (resolved to IPs) | `WISP_ALLOWLIST` (comma list, `*.` ok) |
| Port allowlist | 53, 80, 443 | — |
| SSRF guard | private + loopback IPs blocked | — |
| Per-client rate limit | 30 new conns / 60s / IP | `WISP_MAX_CONN`, `WISP_WINDOW_MS` |
| Stream caps | 8/host, 64 total | — |
| Audit | every connect/deny logged to stdout | — |

## Known nuance

Multi-provider hosts (e.g. `example.com` spans Cloudflare **and** AWS) can return
DNS records that differ between the proxy's resolver and the VM's, so some of a
host's IPs may be refused. Single-origin hosts (github, pypi, …) are unaffected.
Production options: forward DNS through the proxy so VM + proxy share resolution,
or cache a broader IP set per host. Tracked for the deploy phase.

## Deployment (ETI-hosted)

Not yet deployed — target (Cloudflare Workers vs Railway) is a pending decision.
The allowlist + rate-limit + audit are the egress controls the §0 / program spec
require; this server is the enforcement point. **Do not** point production at a
third-party public relay.
