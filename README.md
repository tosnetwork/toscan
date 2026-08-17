# TOSCAN

TOSCAN is the official, read-only explorer for TOS Network. It is a new Vue 3 application built against the APIs that already exist in the TOS node and `tosctld` service.

The information architecture follows the familiar explorer progression — overview → blocks / transactions → entity detail — while the product model is TOS-native. Agent Accounts, Task Escrows, Service Actors and programmable account authority are first-class views instead of being flattened into generic contract calls.

## Design position

- **Visual direction:** quiet, high-density explorer UI inspired by TONViewer's hierarchy: a light-gray canvas, white 12px surfaces, restrained borders, a persistent search field, compact entity rows and blue reserved for navigation/focus.
- **Original implementation:** no TONScan source code, components, fonts, icons or images are copied. The older project is used only as an information-architecture reference.
- **Truthful data:** live RPC and indexer data are preferred. If preview fallback is enabled and the endpoint is unavailable, every page is covered by a persistent **Preview data** banner.
- **Read-only by design:** the application exposes no signing or transaction-submission path.

## Implemented routes

| Route | Data source | Purpose |
| --- | --- | --- |
| `/` | JSON-RPC + tosctld | Global search, chain summary, latest blocks / transactions, AI work summary |
| `/blocks` | JSON-RPC | Recent finalized masterchain blocks |
| `/block/:workchain/:shard/:seqno` | JSON-RPC | Header, hashes, logical-time range and block transactions |
| `/transactions` | JSON-RPC | Transactions reached from the recent block window |
| `/tx/:account/:lt/:hash` | JSON-RPC | Deterministic transaction lookup with account + LT + hash |
| `/address/:address` | JSON-RPC + wallet index | Balance, activity, Jetton/NFT ownership, capabilities and Agent authorities |
| `/agents` | tosctld + chain getters | Agents derived from current indexed task assignments |
| `/tasks` | tosctld index/query API | Task Escrows and settlement state |
| `/services` | tosctld index/query API | Service Actor price, access, load and revenue counters |
| `/network` | JSON-RPC | Chain tip and reconstructed proof-link participation |

## Run locally

Requirements: Node.js 20+ and pnpm 9+.

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Open `http://localhost:4173`.

The default development configuration proxies:

- `/jsonRPC` → `http://127.0.0.1:8011`
- `/tos-service-api` → `http://127.0.0.1:8080`

Override `TOS_RPC_PROXY_TARGET` and `TOS_SERVICE_PROXY_TARGET` in `.env` when the services run elsewhere. These proxy values are server-side development settings and are not embedded in the browser bundle.

For a public deployment, point `VITE_TOS_RPC_URL` at a read-only TOS JSON-RPC endpoint, or expose it through the same-origin reverse proxy. Point `VITE_TOS_SERVICE_API_URL` at a read-only reverse proxy for the tosctld query API. If that upstream requires credentials, attach them in the reverse proxy; never place operator tokens in a `VITE_*` variable because Vite variables are public browser code.

## Data contracts used

TOSCAN consumes the existing TOS surface rather than inventing a new explorer backend:

- Node JSON-RPC: `getMasterchainInfo`, `lookupBlock`, `getBlockHeader`, `getBlockTransactions`, `getTransactions`, `getAddressInformation`, `getConsensusBlock`, `getMasterchainBlockSignatures`.
- Programmable authority: `getAccountCapability`, `getAccountAgents`.
- In-process wallet index: `getAccountEvents`, `getAccountJettons`, `getAccountNfts`.
- tosctld read API: `/agents/{address}`, `/tasks`, `/services`.

The API adapter is isolated in `src/api/`. Page components only use normalized explorer models, so a future durable PostgreSQL/Search explorer service can be introduced without rewriting the UI.

## Current evidence boundaries

1. Recent blocks and account lookups are available directly from node state.
2. Recent transaction discovery is bounded by the loaded block window. Transaction detail therefore uses the deterministic `(account, lt, hash)` identity required by the current API.
3. The current task endpoint's coverage depends on the configured tosctld/indexer. The UI does not claim global completeness.
4. Agent enumeration is derived from agents referenced by indexed tasks because the current API provides per-address Agent Account reads, not a chain-wide Agent Account list.
5. Proof-link signer counts are reconstructed finalized evidence, not a live catchain/gossip telemetry stream.
6. Full-history arbitrary-text and transaction-hash-only search remain future durable-index capabilities. The search UI states this explicitly.

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The interface includes keyboard search (`/`), visible focus states, a skip link, semantic tables, reduced-motion handling, responsive layouts and persistent light/dark/system themes.

## License

TOSCAN uses the same license as the TOS repository: GNU General Public License v3.0 or later. See [LICENSE](./LICENSE).
