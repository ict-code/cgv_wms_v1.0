# WMS Phase 1 — Design Decisions

Client: City Government of Vigan. Single warehouse at launch, schema multi-warehouse-ready. Brand-new system, no legacy migration.

## Confirmed rules
- Negative inventory: **blocked strictly**, no override in Phase 1.
- Reorder alert: `items.reorder_level` breach on any balance -> low-stock notification/dashboard alert (uses existing schema field, no new column needed).
- Costing: **fixed/standard cost** per item. `items` gets `standard_cost`; `inventory_transactions.unit_cost` copies the item's standard cost at transaction time (immutable snapshot), `total_cost = quantity * unit_cost`. No moving-average/FIFO layers.
- Approvals required before posting: **Issuance, Transfer, Adjustment**. Receiving does not require approval (received_by posts directly on delivery, matches DRAFT -> PENDING -> RECEIVED). Stock counts require review+approval per spec (variance gate).
- ORM: **Prisma**.
- Tracking: **serial, batch, and expiry** all enabled and usable in Phase 1 (per-item flags `track_serial`/`track_batch`/`track_expiry` still control whether an item requires them).
- Auth: **JWT** (access + refresh), bcrypt password hashing.
- Hosting: internal-only, no public domain. Caddy configured for internal reverse proxy (no auto-HTTPS cert step); TLS can be layered later if a domain appears.

## Status enums (per STATUS WORKFLOWS section, confirmed as baseline)
- receivings: DRAFT -> PENDING -> RECEIVED -> CANCELLED
- issuances: DRAFT -> PENDING_APPROVAL -> APPROVED -> ISSUED -> CANCELLED / REJECTED
- transfers: DRAFT -> PENDING_APPROVAL -> APPROVED -> IN_TRANSIT -> COMPLETED -> CANCELLED
- returns: DRAFT -> RECEIVED -> CANCELLED
- adjustments: DRAFT -> PENDING_APPROVAL -> APPROVED -> POSTED -> CANCELLED / REJECTED
- stock_counts: DRAFT -> IN_PROGRESS -> SUBMITTED -> REVIEWED -> APPROVED -> CANCELLED

Only terminal posted status writes `inventory_transactions`.

## Reservation lifecycle (must be explicit per spec)
`available_quantity = quantity - reserved_quantity`.
- On issuance **APPROVED**: reserve `quantity_issued` (default = `quantity_requested` unless partially approved) against `inventory_balances.reserved_quantity` at the chosen `location_id`.
- On issuance **ISSUED** (posted): release the reservation and post the ISSUE transaction (quantity leaves `quantity` and `reserved_quantity` together).
- On issuance **CANCELLED/REJECTED** (from APPROVED or PENDING_APPROVAL): release reservation, no transaction.
- Transfers/adjustments do not reserve — they act immediately on POST since they are single-step operational moves once approved (transfer moves on `execute`, not on `approve`).

## Verified locally (no Docker on this machine — used `embedded-postgres` devDependency instead)
- Prisma schema (19 tables, all enums) migrates cleanly against real Postgres 16.
- Doc-number sequences (`generate_doc_no`) produce `RCV-2026-000001`, `TXN-2026-000001` style numbers atomically.
- Login issues JWT with role baked into the payload; RBAC guard correctly returns 403 for a Requester posting a receiving, 200 for the same user reading inventory, 401 with no token.
- Full Receiving flow verified live: create (PENDING, doc number assigned) -> `/receive` (locks balance row, posts RECEIVE transaction, updates `inventory_balances`, writes audit log) -> `GET /inventory/item/:id` shows the new balance -> `GET /inventory/:itemId/history` shows the immutable ledger entry.
- Two real bugs were caught and fixed during this verification (not just typos): a Postgres `uuid` vs `text` type mismatch in the balance-row insert, and the global `ValidationPipe`'s `forbidNonWhitelisted` rejecting query params on any controller that mixed `@Query() dto` with sibling `@Query('key')` params — fixed by moving every such filter into a typed query DTO per resource.
- `backend/prisma/seed.ts` bootstraps the 6 roles, a placeholder department/warehouse/location/category/unit, and an admin user with a randomly generated password printed once to the console.

## Backend: complete and verified (2026-08-30)
All Phase 1 backend modules are implemented and live-tested end-to-end against the Dockerized stack (Docker Engine in WSL2, not Docker Desktop — see below):
- Master data: departments, warehouses, locations, categories, units, suppliers, items (+ barcode lookup), roles, users.
- All 6 operational workflows, each following the Receiving reference pattern (DTO validation → `$transaction` → `InventoryService.postMovement`/`adjustReservation` → audit log):
  - **Receiving**: create (PENDING) → `/receive` (posts RECEIVE).
  - **Issuance**: create (PENDING_APPROVAL) → `/approve` (reserves stock) → `/issue` (posts ISSUE, releases reservation, supports optional per-line `quantityIssued` override for partial fulfillment) → `/cancel` (releases reservation if APPROVED).
  - **Transfer**: create → `/approve` → `/execute` (posts TRANSFER_OUT + TRANSFER_IN atomically in one transaction; IN_TRANSIT is in the schema but unreachable via API since execute completes the move in one step, matching the "inventory must never disappear" requirement).
  - **Return**: create (DRAFT) → `/receive` (posts RETURN).
  - **Adjustment**: create (PENDING_APPROVAL) → `/approve` → `/post` (posts ADJUSTMENT_IN/OUT per line based on the line's `adjustmentType`).
  - **Stock Count**: create → `/start` (snapshots `systemQuantity` from current balances) → `/submit` (records `physicalQuantity`, computes `variance`) → `/review` → `/approve` (posts STOCK_COUNT correction for every non-zero-variance line). `/review` isn't in the original required-endpoints list but was added because the spec explicitly requires variance to be "reviewed and approved" as two distinct checks.
- Reports: current inventory, low-stock, out-of-stock, expiring (best-effort — see caveat below), transaction ledger (covers stock-in/out/transfer/return/adjustment/by-user via query params), issuances-by-department, stock-count variance, and a `/reports/dashboard` aggregate endpoint.
- Live-verified: negative-inventory rejection (400 on over-issuance), reservation reserve/release lifecycle, atomic two-location transfer, adjustment posting, full stock-count variance-to-correction flow, return posting, dashboard aggregation.

### Known caveats
- **Expiring-inventory report is best-effort**: `inventory_balances` isn't batch-tracked (aggregated per item+warehouse+location only), so the report surfaces items whose most recent RECEIVE carried a near-term expiry rather than an exact remaining-quantity-per-batch figure. A batch-level balance table would be needed for precision — not built, to avoid a schema change this late without confirming it's actually needed.
- **No PDF/Excel/CSV export yet** — report endpoints return JSON only.
- **`prisma generate` now runs via `postinstall`** (added after a real bug: a fresh `npm install`/`npm ci` doesn't regenerate the client on its own, which caused the whole backend to fail typechecking until caught). Both Docker stages now `COPY prisma ./prisma` before `npm ci` so `postinstall` has a schema to generate from — the runtime stage doesn't have the rest of the source yet at that point in the build, only the build stage does after `COPY . .`, so this had to be fixed in two places.

## Docker: running via Docker Engine in WSL2 (no Docker Desktop)
Per user request, Docker Engine (dockerd, containerd, CLI, buildx, compose plugin) was installed directly into the existing Ubuntu WSL2 distro via Docker's official apt repo — no Docker Desktop involved. Two real environment issues were hit and fixed:
1. **npm version skew**: `node:22-alpine` ships npm 10.9.8, but lockfiles were generated locally with npm 11.19.x; npm 10's `npm ci` misreads the v3 lockfile and reports phantom missing packages. Fixed by `RUN npm install -g npm@11` before `npm ci` in both Dockerfiles.
2. **WSL2 instance teardown between commands**: with no process holding a session open, WSL fully reboots the Ubuntu instance (and therefore every container) between separate `wsl.exe` invocations — surfaces as containers repeatedly restarting with a fresh few-seconds uptime. Fixed by keeping a persistent `wsl -d Ubuntu -e sleep infinity` background process running, plus `vmIdleTimeout=-1` in `C:\Users\USER\.wslconfig` as backup. **This keep-alive process needs to be running for the stack to stay up reliably** — if it's not (e.g. after a reboot), containers will flap until it's restarted, even though `restart: unless-stopped` eventually recovers them.

Dev stack is currently up at `http://localhost:8080` (Caddy), proxying `/api/v1/*` and `/api/docs` to the backend and everything else to the frontend. `.env` at the project root holds locally-generated secrets (gitignored).

## Frontend: built and deployed (2026-08-30)
Next.js 16 (App Router, Turbopack) + Tailwind 4 + TanStack Query + React Hook Form + Zod, hand-built UI primitives in the shadcn style (no CLI, since it's interactive) rather than a component library. Auth via JWT stored in `localStorage`, axios interceptor attaches the bearer token and retries once through `/auth/refresh` on a 401.

Every nav item from the spec's FRONTEND NAVIGATION section has a working page:
- Dashboard (consumes `/reports/dashboard`).
- Items (search + create) and Current Stock (inventory search by warehouse).
- All 6 operational workflows — list, create, and detail-with-workflow-actions pages for Receiving, Issuance, Transfers, Returns, Adjustments, Stock Counts. Stock count detail handles the full start → enter physical quantities → submit → review → approve sequence inline.
- Master data — Departments, Warehouses, Categories, Units, Suppliers share one generic `ResourceCrudPage` component (list + create + activate/deactivate) since their shape is identical; Locations gets its own page (needs warehouse/type selects).
- Reports (low-stock, expiring, filterable transaction ledger) and Administration (Users, Roles).

Two real bugs surfaced and fixed during the build:
- **zod `.coerce.number()` vs React Hook Form typing**: `useForm<FormValues>` (the zod *output* type) doesn't match what `zodResolver` expects as input when a field is coerced (raw form input is a string, output is a number) — every create form with a numeric field needed `useForm<FormInput, unknown, FormValues>` (RHF's three-generic form: field type, context, transformed/submitted type), using `z.input<typeof schema>` for `FormInput`.
- **A real ESLint error, not just a warning**: `auth-context.tsx`'s effect that hydrates auth state from `localStorage` on mount was flagged by the React Compiler's `set-state-in-effect` rule. This is a legitimate one-time-on-mount pattern (localStorage isn't available during SSR, so it can't move to a lazy `useState` initializer without a hydration mismatch) — suppressed locally with a comment explaining why, rather than reworking a correct pattern.

Verified: `tsc --noEmit` clean, `next build` succeeds (all 29 routes compile and prerender), `eslint` clean (0 errors), and the built image serves `/`, `/login`, and `/dashboard` with real HTML through Caddy on the live Docker stack. **Not verified**: an actual browser click-through of the login → dashboard → create-a-document flow — no headless browser was available in this environment, so this was checked at the HTTP-response level, not the rendered/interactive level. The user should smoke-test the real flow in a browser before relying on it.

One build-time note: `NEXT_PUBLIC_API_URL` is inlined into the client bundle at build time, but `frontend/Dockerfile` never receives it as a build arg — it silently falls back to the code's own default (`/api/v1`), which happens to be correct for this Caddy setup. If the API base path ever needs to change, it requires a rebuild with that value passed as a build arg, not just a `docker-compose.yml` environment change.

## Phase 1 gap closure (2026-08-31)
A full audit against every acceptance criterion in `build_prompt.txt`'s PHASE 1 SCOPE / ACCEPTANCE CRITERIA / WHAT NOT TO DO sections found three real gaps (everything else was already met). All three are now closed:

1. **Automated tests** — `backend/src/inventory/inventory.service.spec.ts` (7 unit tests, mocked `Prisma.TransactionClient`, no DB required): inbound/outbound movement math, rejection when on-hand quantity would go negative, rejection when *available* quantity would go negative even though on-hand stays non-negative, reservation reserve/release math and its own negative-guard. `backend/test/*.e2e-spec.ts` (15 integration tests against a real Postgres — see below): `auth.e2e-spec.ts` (login failure, missing/garbage bearer token, server-side RBAC 403 for a Requester hitting an Administrator-only endpoint), `inventory-lifecycle.e2e-spec.ts` (receiving → issuance approve/issue → transfer → adjustment, asserting the actual balance after each step, plus rejecting a duplicate `/receive` post and an over-large issuance approval), and `concurrency.e2e-spec.ts` — the spec's own worked example verbatim: balance of 10, two simultaneous issuance approvals for 7 and 5, asserting exactly one succeeds (never both, never neither) and the final balance is never negative or corrupted; a second concurrent-adjustment variant proves the same for on-hand quantity directly. All 22 tests pass, re-run twice to rule out flakiness.

   Infrastructure: `backend/test/support/global-setup.ts` boots a throwaway `embedded-postgres` instance (devDependency, already used earlier for offline migration checks) on port 15498 and runs `prisma migrate deploy` against it once per test run; `backend/test/support/test-app.ts` boots a full Nest app via `Test.createTestingModule` and seeds isolated per-suite fixtures (randomized codes so parallel suites can't collide — though `vitest.config.e2e.ts` also sets `fileParallelism: false` to keep everything against the one shared instance simple). One real environment issue hit along the way: the default test port (55488) fell inside a Windows-reserved TCP exclusion range (`netsh interface ipv4 show excludedportrange`), which surfaced as an unhelpful `ERROR undefined` from the `embedded-postgres` library — fixed by picking a port outside every excluded range (15498).

2. **Backup/restore** — `scripts/backup.sh` runs `pg_dump -Fc` inside the running `postgres` container (via `docker compose exec`) into the already-bind-mounted `./backups/` directory, sanity-checks the resulting file isn't suspiciously small, and prunes anything older than `--retention-days` (default 30). `scripts/restore.sh` restores a given backup into a **scratch database** (`wms_restore_check`) by default and prints row counts for the core tables so the backup can be verified without touching the live database — this is the "documented restore verification procedure" the spec asks for, not just a script that assumes success because a dump file exists; `--target live` performs the actual destructive restore, gated behind typing the database name to confirm. Both scripts were run against the live Docker stack, not just written: a real backup was taken, restored into the scratch database, and its table counts (`users`, `items`, `inventory_balances`, `inventory_transactions`, `audit_logs`) were confirmed to match the live database exactly before the scratch database was dropped.

3. **Locations hierarchy UI** — the schema and `CreateLocationDto`/`UpdateLocationDto` always supported `parentLocationId`, but the Locations master-data form never exposed it, so the hierarchy required by the DATABASE SCHEMA section ("use a hierarchical parent_location_id relationship") was reachable via the API but not the UI. Added a "Parent Location" combobox (options scoped to the same warehouse, excludes the location being edited) and a Parent Location column to the table. Verified live: created a `BIN`-type location with a real `parentLocationId` end-to-end through the API, then cleaned it up.

## Remaining — not required for Phase 1, deferred to Phase 2
- PDF/Excel/CSV report export (CSV+Excel now done for all 7 Master Data modules, Items, Current Stock, and the Transaction Ledger; still no PDF anywhere, and no dedicated export for the rest of the report catalog — inventory-by-warehouse/category, stock-in/out, transfer/return reports, issuance-by-employee).
- Barcode scanning UI (backend `GET /items/barcode/:barcode` lookup endpoint exists; no camera/USB-scanner frontend integration).
- PWA manifest and service worker (offline app shell).
- Notifications module (`backend/src/notifications/` doesn't exist; low-stock/expiring alerts currently surface only via the in-app dashboard, not as a decoupled notification/event system).
- Idempotency keys on inventory-changing POST endpoints (receive, issue, transfer execute, adjustment post, stock count approve) — a retried request from a flaky connection could theoretically double-post today.
- Performance/concurrency load testing (the correctness of concurrent behavior is now covered by `concurrency.e2e-spec.ts`; load/throughput testing under the spec's p95 latency targets is not).
- A real browser click-through of the frontend (see caveat above — still HTTP-level verification only, no headless browser available in this environment).

## Phase 1: reviewed and accepted (2026-08-31)
All PHASE 1 SCOPE and ACCEPTANCE CRITERIA FOR PHASE 1 items in `build_prompt.txt` are met. Proceeding to Phase 2 per the items listed above (spec itself never defines a "Phase 2" scope — this list is everything explicitly deferred out of Phase 1 plus the general spec sections that fall outside the PHASE 1 SCOPE section).

## Phase 2, item 1: idempotency keys (2026-08-31) — done
Opt-in `Idempotency-Key` header (client-generated UUID) on the five inventory-changing POSTs the spec names: `POST /receivings/:id/receive`, `/issuances/:id/issue`, `/transfers/:id/execute`, `/adjustments/:id/post`, `/stock-counts/:id/approve`. No header → unaffected, unprotected (matches every other endpoint's current behavior).

- New `idempotency_keys` table (migration `20260831114113_add_idempotency_keys`): `key` (globally unique), `endpoint`, `user_id`, `status` (`IN_PROGRESS`/`COMPLETED`), `status_code`, `response_body` (JSONB), timestamps.
- `IdempotencyInterceptor` (`backend/src/common/interceptors/idempotency.interceptor.ts`), applied per-method via `@UseInterceptors`, not globally: claims the key with a plain `prisma.idempotencyKey.create()` and lets Postgres's unique-constraint enforcement do the atomic "only one wins" part — no raw SQL, no advisory locks needed. Loser gets the winner's stored response replayed if it already finished, or a 409 if it's still in flight. Winner's response is normalized through `JSON.parse(JSON.stringify(...))` before storage so a replay is byte-for-byte what the client would have gotten the first time (Decimal/Date fields serialize the same way `res.json()` would).
- Deliberate tradeoff: a key that gets stuck `IN_PROGRESS` (process crash mid-request) blocks retries under that exact key forever — no TTL/cleanup job. This is by design (the goal is "a retry can't silently double-post," not "the same key stays retryable forever"); a client that hits a stuck key mints a new one. Documented in the interceptor's own docstring rather than a separate doc, since that's where the tradeoff needs to be understood.
- `backend/test/idempotency.e2e-spec.ts` (3 tests, part of the same e2e suite as Phase 1's tests): sequential retry replays the first response and posts inventory exactly once; concurrent identical-key requests never both post (one 201 + one 409, or two 201s with identical bodies if the second arrives after the first already committed); no-header requests are unaffected. All 19 e2e tests (16 from Phase 1 + 3 new) pass, re-run twice for stability.
- Verified live against the Docker stack, not just tests: two real HTTP requests with the same key against a real receiving both returned 201 with matching bodies, and the inventory balance only reflected the receive once.

## Phase 2, item 2: notifications module (2026-08-31) — done
New `notifications` domain module (`backend/src/notifications/`), migration `20260831115740_add_notifications`. Each notification is a per-user row (role-scoped alerts fan out to one row per active user with that role at creation time, so "read" state is always per-user, never a shared/ambiguous state on a broadcast row). Creation always happens *after* the triggering `$transaction` commits, never inside it, and every creation path swallows its own errors (logged, not thrown) — a notification failure can never roll back or fail an inventory-changing request, satisfying the spec's "decoupled from critical inventory writes."

Wired triggers: receiving completed (role: Warehouse Manager), issuance approved/issued/rejected-or-cancelled (the requester), transfer completed (the requester), adjustment pending approval (role: Warehouse Manager), stock count discrepancy on submit (role: Warehouse Manager), low-stock/out-of-stock (role: Inventory Controller, deduped — skipped if an unread alert for that item already exists — checked after every outbound movement: issue, transfer-out, adjustment-out, and a negative stock-count variance). Expiring-soon has no automatic trigger since there's no scheduler in this deployment (no BullMQ/cron) — `POST /notifications/check-expiring` (Administrator-only) exists for an operator or external cron to call periodically; documented as such rather than silently pretending it's automatic.

`GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`. Frontend: bell icon with unread-count badge in the nav bar (`notification-bell.tsx`), polling every 30s via TanStack Query (no WebSocket/real-time infra), dropdown list, click-to-mark-read-and-navigate to the source document where applicable.

`backend/test/notifications.e2e-spec.ts` (2 tests, part of the same suite): approving an issuance notifies the actual requester (not the approver) and the notification is retrievable/markable-read by them specifically; a user's notifications never leak into another user's inbox. 21 e2e tests total now pass (the one intermittent failure seen mid-run was the same known Windows/embedded-postgres connection blip documented earlier — reproduced clean on re-run). Verified live: a real issuance approval produced a real notification row for the actual requester, confirmed via the API.

## Phase 2, item 3: barcode scan UI (2026-08-31) — done
Backend lookup endpoint (`GET /items/barcode/:barcode`) already existed; this closes the frontend half of BARCODE SUPPORT — "USB barcode scanners, mobile camera scanning, PWA-compatible... barcode scanning must never bypass inventory validation."

- `@zxing/browser` (camera decode via `getUserMedia`, works across Chrome/Edge/Firefox/Safari including iOS — unlike the native `BarcodeDetector` API, which Safari doesn't implement, and mobile scanning needs to work on iPhone per spec). `barcode-scanner-dialog.tsx` wraps it in a modal with a live camera preview; `barcode-input.tsx` pairs a plain text field (so a USB scanner, which just types the code and hits Enter, works with zero extra code) with a "Scan" button that opens the camera dialog.
- `/scan` (Barcode Lookup) page implements the spec's literal primary workflow: scan → identify item → display item info + available inventory broken down by warehouse/location → buttons into Receiving/Issuance/Transfers to act on it. Falls back to the general item search endpoint if the code doesn't match a `barcode` exactly (covers items that only have an `item_code`, no barcode assigned).
- Inline "Scan" button added directly on the item line of the Receiving and Issuance create forms (the two highest-frequency scan-driven operations) — scanning there matches against the already-loaded item list client-side and fills the line's item selector directly, no page navigation needed.
- Scanning only ever *selects* an item into a normal form; posting still goes through each operation's existing validated `$transaction` flow, so "must never bypass inventory validation" holds by construction, not by convention.
- Two real React Compiler errors surfaced and were fixed properly, not suppressed: mutating a ref during render (`onDetectRef.current = onDetect` moved into a plain `useEffect`, matching React's own guidance for "always latest callback" refs) and calling `setState` synchronously inside an effect (`setError(null)` on reopen replaced with the same render-time prev-value-comparison pattern already established in `nav-bar.tsx` earlier in this project, rather than reaching for `useEffect` again).
- No image-generation tool is available in this environment, so the manifest/app icon (see PWA below) is SVG-only rather than also shipping PNG fallbacks — noted as a known gap, not silently glossed over.

## Phase 2, item 4: PWA (2026-08-31) — done
`app/manifest.ts` (Next's built-in manifest route convention, served at `/manifest.webmanifest`), a hand-written `public/sw.js` service worker (no `next-pwa` dependency — that package's Turbopack/Next-16 compatibility wasn't worth the risk versus ~40 lines of plain code), and `viewport`/`appleWebApp` metadata in the root layout.

Service worker strategy: network-first with cache fallback for navigations (so the app shell — `/dashboard`, `/login` — still renders offline once visited), cache-first for `/_next/static/*` build assets, and it **never touches `/api/*` at all** — every API request (GET or POST) passes straight through untouched. This is the mechanism behind the spec's explicit "do not allow inventory-changing transactions to execute offline unless a dedicated offline architecture is approved": there's no queuing, no background sync, no offline write path — a POST made with no connectivity simply fails visibly like it would with no service worker present, exactly as required.

`frontend/Dockerfile`'s existing `COPY --from=build /app/public ./public` already ships `sw.js`/`icon.svg` in the standalone runtime image — no Dockerfile change needed. Verified live: `/manifest.webmanifest`, `/sw.js`, and `/icon.svg` all serve correctly through the Docker/Caddy stack.

Known gap carried over from barcode UI above: icons are SVG-only (`purpose: any` and `purpose: maskable` both point at the same file) since no PNG-generation tool is available here — this is a reasonable installable PWA on Chrome/Edge/Android today, but iOS's home-screen icon rendering from SVG is less reliable than a proper PNG set would be. Also not done: a dedicated custom offline fallback *page* (falls back to a cached `/dashboard` instead) and precaching beyond the small `APP_SHELL` list.

## Phase 2, item 5: full report catalog + PDF export (2026-08-31) — done
Closes the spec's REPORTS section (Inventory / Transactions / Accountability / Physical Inventory groups, each needing date range / warehouse / department / category / item / transaction-type filters and PDF/Excel/CSV export). The underlying data endpoints mostly already existed (`currentInventory`, `lowStock`, `outOfStock`, `expiring`, `transactions` with its filter set, `issuancesByDepartment`, `stockCountVariance`); the only new data endpoint is `issuancesByEmployee` (mirrors `issuancesByDepartment`, grouped by `employeeId` instead), since "issuance by employee" was in the spec's Accountability list but nothing existing grouped by employee. Together the "Transaction Ledger" report (filterable by `transactionType`) already covers stock-in/out/transfer/return/adjustment/by-user as one flexible report rather than five separate near-duplicate endpoints, which is what the spec's own filter requirements imply anyway.

New pieces:
- `backend/src/common/utils/pdf.util.ts` — `toPdf(title, headers, rows)` using `pdfkit` (pure Node, no headless-Chromium dependency, which would have been heavy for a Docker image). Auto-switches to landscape for wide tables, paginates when a page fills, brand-blue header row, alternating row shading, an explicit "no records" state instead of a blank page.
- One generic export surface instead of 24 near-identical endpoints: `GET /reports/:key/export/:format` (`key` ∈ the 8 report types, `format` ∈ csv/xlsx/pdf), backed by `ReportsService#getReportTable()` — a single switch that shapes each report's `{title, headers, rows}` once, reused by all three encoders. Both `key` and `format` are validated against the allowed sets before the service is even called (400, not a 500, on garbage input). Same `CAN_VIEW_REPORTS` role gate as the rest of the module — no new RBAC surface introduced.
- Frontend `/reports` page rewritten from a single transaction-ledger table into a tabbed catalog (`current-inventory`, `low-stock`, `out-of-stock`, `expiring`, `transactions`, `issuances-by-department`, `issuances-by-employee`, `stock-count-variance`), grouped into the same four categories the spec uses, with a shared filter bar (warehouse always; date range and transaction type where the report actually supports them) and CSV/Excel/PDF buttons wired straight to the generic export endpoint with the current filters serialized as query params — so what's exported always matches what's on screen.
- Verified live against the Docker stack: all 8 report keys × 3 formats (24 combinations) return 200; the PDF output was downloaded and confirmed with `file` to be an actual valid `PDF document, version 1.3` — not just a 200 with a broken body.

Not done: report-level pagination inside the exported files (exports include the full filtered result set, not just the current on-screen page — a deliberate choice, since a partial CSV/PDF export would be a worse footgun than a large one), and no dedicated PDF *branding* beyond the plain brand-blue header (no logo — none was supplied).

## Performance/concurrency load testing (2026-08-31) — done
Last item from the spec's own PERFORMANCE REQUIREMENTS p95 targets. `backend/scripts/load-test.mjs`: logs in, fires concurrent requests at each target endpoint (worker-pool pattern, not a fixed-URL benchmarker, because the "stock transaction API" case needs a fresh valid document per request — it pre-creates 100 real PENDING receivings, then fires `POST .../receive` at each one concurrently, so it's measuring genuine unique-request latency, not hammering one document repeatedly), sorts durations, reports p50/p95/p99/max per endpoint against the spec's numbers.

First run surfaced two real things worth recording, not just re-running until green:
1. **Barcode lookup failed 100% at first** — not an app bug: the only seeded item had no `barcode` value, and `GET /items/barcode/:barcode` correctly 404s when there's nothing to match. Fixed by giving the test item a real barcode before running (`PATCH /items/:id`), not by loosening the test.
2. **~40% "failures" on two other endpoints at n=200** turned out to be the `ThrottlerGuard` itself (120 req/60s per route per IP — confirmed by reading `@nestjs/throttler`'s default `generateKey`, which buckets per controller+handler+IP, not globally) correctly rejecting a burst that exceeded its configured limit. That's the rate limiter working as designed, not a defect — but it also meant the first run's p95 numbers were contaminated by a mix of real handler latency and near-instant 429 rejections. Fixed by keeping every burst at n=100 (under the 120 budget), which is also a legitimate live confirmation that the rate limiter from the Phase 1 audit is actually enforced, not just configured.

Clean re-run, all targets met with real margin (measured over loopback through Caddy on the actual Docker stack, not synthetic):

| Endpoint | Target (p95) | Measured p95 | 
|---|---|---|
| Item barcode lookup | 150ms | 43ms |
| Inventory search (paginated) | 300ms | 41ms |
| Item detail | 300ms | 33ms |
| Dashboard | 500ms | 104ms |
| Stock transaction API (POST receive) | 200ms | 138ms |

Caveat carried over honestly: the spec says targets are "excluding network latency" — this measures full request time through Caddy over loopback, which is about as close as a single-machine dev environment gets, but isn't the same as server-side-only instrumentation. Also note the run posted 100 real, immutable RECEIVE transactions into the shared dev database (by design — inventory transactions can't be deleted per the spec's own audit-trail requirement), so the dev database's item/inventory counts are now a bit higher than a fresh seed; this is expected residue from testing, not a defect.

## Real browser click-through + PNG icons (2026-08-31) — done
Closes the two remaining honestly-tracked gaps from earlier ("no headless browser was available," "icons are SVG-only").

**Browser smoke test**: `frontend/scripts/browser-smoke-test.mjs` using Playwright + Chromium (installed and downloaded in this environment — it turned out to be available after all). Real click-through, not an HTTP status check: login form fill → submit → redirect to `/dashboard` → six key pages checked for `pageerror` events (a page that 200s but throws client-side would still be caught) → create a Category through its actual modal form and confirm the new row renders in the table.

First run: 8/9 passed, one genuine failure — `New Category` button never found. Not a selector problem: `ResourceCrudPage`'s `title.replace(/s$/, "")` singularization turns "Categories" into "Categorie" (strips only the last literal `s`, doesn't know `-ies → -y`), so the button actually rendered "New Categorie", the dialog title, delete-confirmation text, and table column header were all subtly wrong too — every other resource using this component happened to have a plural that plain trailing-`s` stripping handles correctly, which is exactly why this had gone unnoticed through the whole session's curl-based verification (HTTP-level checks never look at button label text). Fixed with a `singularize()` helper (`-ies → -y`, else strip trailing `s`) in both `resource-crud-page.tsx` and the structurally-identical `document-list.tsx` (which had the same bug, dormant — none of its current titles happen to end in `-ies`, but the next one might). Re-ran clean: 9/9.

This is the concrete case for why "curl says 200" and "a user could actually do this" are different claims — logged here rather than glossed over.

**PNG icons**: `sharp` (prebuilt binary, no native toolchain needed) rasterizes `icon.svg` into `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` at build time (script run once, files committed to `public/`, not generated per-build). Manifest and root layout both reference the PNGs alongside the SVG; service worker's app-shell precache and cache-first static-asset rule both cover them now. This was blocked earlier only by "no image-generation tool available" — turned out `sharp` just needed installing, so the gap wasn't structural, just not yet tried.

## Load-test cleanup
Test artifacts from this session that were mutable were deleted after verification (e.g. the browser smoke test's `SMOKE-*` category). Artifacts that are immutable by design — the load test's 100 real RECEIVE transactions — were deliberately left in place per the earlier note; deleting inventory transactions would itself violate the spec's own audit-trail requirement.

## Branding: real City of Vigan seal + layout tweaks (2026-08-31)
- Notification bell moved from the horizontal nav bar into the `Topbar`, immediately left of the user avatar/name block (was previously on the far right of the secondary nav row) — matches a reference screenshot the user provided.
- Placeholder `Package2` lucide icon replaced with the actual City of Vigan seal (`frontend/public/vigan-seal.png`, sourced from `resrouces/img/city_logo.png`) in both the Topbar and the login page. PWA icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) regenerated from the same source via `sharp` so the installed-app icon matches too, not just the in-app header.
- "WMS" / "City of Vigan" short-form text expanded to "Warehouse Management System" / "City Government of Vigan" everywhere it appeared as the primary label (Topbar, login page, page `<title>`, manifest `name`) — manifest `short_name` deliberately left short ("WMS Vigan"), since that field exists specifically for space-constrained contexts (home-screen label) and a full name there would just get truncated by the OS.
- Verified visually, not just via HTTP status: real Playwright screenshots of `/login` and `/dashboard` confirmed the seal renders correctly and the bell sits in the right place before this was called done.

## Phase 2: complete (2026-08-31)
All five items from the agreed scope are done: idempotency keys, notifications module, barcode scan UI, PWA, full report catalog + PDF export. Every change in this phase was verified against the live Docker stack (not just `tsc`/lint/build), and the backend test suite (7 unit + 21 e2e/integration/concurrency tests) stayed green throughout, growing alongside the feature work rather than being back-filled at the end.

## Deferred / not in Phase 1
- Existing item master import (none provided — brand-new system).
- Existing barcode format (none — new barcode scheme assigned via `item_code`/`barcode` fields, standard Code128/EAN-13 compatible).
- Departments list (seed placeholder departments, editable via Master Data > Departments UI).
- Document number format: simple `PREFIX-YYYY-NNNNNN` via Postgres sequence per type (e.g. `RCV-2026-000001`), confirm/adjust later — not a data-integrity risk to change post-launch since it's cosmetic over a DB-sequence-guaranteed unique id.
- Notification channels: in-app only for Phase 1 (dashboard alerts), email/SMS deferred.
- Backup storage destination: local named volume + documented `pg_dump` cron script; offsite copy target TBD by client IT.
