// Load test against the live Docker stack (through Caddy, matching real client
// latency). Measures p50/p95/p99 for the endpoints the spec names explicit
// p95 targets for, plus a concurrent-POST run against a real inventory-changing
// endpoint using a pool of pre-created documents (never the same doc twice).
//
// Usage: node scripts/load-test.mjs
// Env: LOAD_TEST_BASE_URL (default http://localhost:8080/api/v1), ADMIN_USERNAME, ADMIN_PASSWORD

const BASE = process.env.LOAD_TEST_BASE_URL ?? 'http://localhost:8080/api/v1';
const USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!PASSWORD) {
  console.error('Set ADMIN_PASSWORD to run the load test.');
  process.exit(1);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function timedFetch(url, options) {
  const start = performance.now();
  const res = await fetch(url, options);
  await res.arrayBuffer();
  const elapsed = performance.now() - start;
  return { elapsed, status: res.status };
}

async function runConcurrent(name, count, concurrency, taskFn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < count) {
      const i = index++;
      results.push(await taskFn(i));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const durations = results.map((r) => r.elapsed).sort((a, b) => a - b);
  const failures = results.filter((r) => r.status >= 400).length;
  const statusCounts = {};
  for (const r of results) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  const stats = { name, n: count, concurrency, p50: percentile(durations, 50), p95: percentile(durations, 95), p99: percentile(durations, 99), max: durations[durations.length - 1] ?? 0, failures, statusCounts };
  console.log(
    `${name}: n=${count} concurrency=${concurrency} failures=${failures} statuses=${JSON.stringify(statusCounts)} p50=${stats.p50.toFixed(1)}ms p95=${stats.p95.toFixed(1)}ms p99=${stats.p99.toFixed(1)}ms max=${stats.max.toFixed(1)}ms`,
  );
  return stats;
}

async function main() {
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const { accessToken } = await loginRes.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  const itemsBody = await (await fetch(`${BASE}/items?pageSize=1`, { headers })).json();
  const sampleItem = itemsBody.data[0];
  if (!sampleItem) throw new Error('No items exist to benchmark against — seed at least one item first.');
  const lookupCode = sampleItem.barcode ?? sampleItem.itemCode;

  const warehouse = (await (await fetch(`${BASE}/warehouses?pageSize=1`, { headers })).json()).data[0];
  let supplier = (await (await fetch(`${BASE}/suppliers?pageSize=1`, { headers })).json()).data[0];
  if (!supplier) {
    supplier = await (
      await fetch(`${BASE}/suppliers`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ code: `LOADTEST-${Date.now()}`, name: 'Load Test Supplier' }) })
    ).json();
  }
  const location = (await (await fetch(`${BASE}/locations?warehouseId=${warehouse.id}&pageSize=1`, { headers })).json()).data[0];

  console.log(`Load testing ${BASE} ...\n`);

  // Each route has its own ThrottlerGuard bucket (120 req/60s per IP, keyed
  // per controller+handler — confirmed by reading @nestjs/throttler's default
  // generateKey). N is kept at or under 120 per route so a burst here measures
  // pure handler latency instead of tripping the production rate limiter and
  // mixing fast 429s into the percentiles.
  const results = [];
  results.push(await runConcurrent('Item barcode lookup', 100, 10, () => timedFetch(`${BASE}/items/barcode/${encodeURIComponent(lookupCode)}`, { headers })));
  results.push(await runConcurrent('Inventory search (paginated)', 100, 10, () => timedFetch(`${BASE}/items?pageSize=25`, { headers })));
  results.push(await runConcurrent('Item detail', 100, 10, () => timedFetch(`${BASE}/items/${sampleItem.id}`, { headers })));
  results.push(await runConcurrent('Dashboard', 100, 10, () => timedFetch(`${BASE}/reports/dashboard`, { headers })));

  // Stock transaction API: pre-create N pending receivings so each concurrent
  // POST /receive hits a distinct, valid document — never the same one twice.
  const N = 100;
  const pendingIds = [];
  for (let i = 0; i < N; i++) {
    const body = await (
      await fetch(`${BASE}/receivings`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ supplierId: supplier.id, warehouseId: warehouse.id, items: [{ itemId: sampleItem.id, quantity: 1, unitCost: 1, locationId: location.id }] }),
      })
    ).json();
    pendingIds.push(body.id);
  }
  let idx = 0;
  results.push(
    await runConcurrent('Stock transaction API (POST receive)', N, 10, () => {
      const id = pendingIds[idx++];
      return timedFetch(`${BASE}/receivings/${id}/receive`, { method: 'POST', headers });
    }),
  );

  const targets = {
    'Item barcode lookup': 150,
    'Inventory search (paginated)': 300,
    'Item detail': 300,
    'Stock transaction API (POST receive)': 200,
    Dashboard: 500,
  };

  console.log('\n=== vs spec p95 targets (measured over loopback through Caddy; spec says "excluding network latency") ===');
  let allPass = true;
  for (const r of results) {
    const target = targets[r.name];
    const pass = r.p95 <= target;
    if (!pass) allPass = false;
    console.log(`  ${r.name}: p95=${r.p95.toFixed(1)}ms  target=${target}ms  ${pass ? 'PASS' : 'FAIL'}`);
  }
  console.log(allPass ? '\nAll targets met.' : '\nSome targets missed — see above.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
