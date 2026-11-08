/**
 * F4 browser acceptance. Real Chromium, real Vue 3 component lifecycle and
 * real HTTP GET interception. SignalR and REST owner are controlled fixtures:
 * this is NOT a staging/production authorization or Traefik WSS test.
 *
 * CI installs playwright out-of-tree; do not change production lockfiles.
 */
import assert from 'node:assert/strict'
import { writeFile, mkdir } from 'node:fs/promises'
const mod = process.env.F4_PLAYWRIGHT_MODULE
if (!mod) throw new Error('F4_PLAYWRIGHT_MODULE is required')
const { chromium } = await import(mod)
const url = process.env.F4_BROWSER_ORIGIN || 'http://127.0.0.1:5187'
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
})
const context = await browser.newContext()
const versions = { 'crm.account': 1, 'pricing.rate': 1 }
const restReads = []
const restWrites = []
const errors = []
const report = { browser: 'Chromium', vueCycles: 0, changedResources: [],
  users: [], errors: [], postRequests: 0, listenerGrowth: null, socketGrowth: null,
  heapDeltaBytesSecondHundred: null }

await context.route('**/api/f4-rest/**', async route => {
  const request = route.request()
  const kind = request.url().includes('/crm.account/') ? 'crm.account' : 'pricing.rate'
  const user = request.headers()['x-f4-user']
  if (request.method() !== 'GET') {
    restWrites.push(request.url())
    await route.fulfill({ status: 405, body: 'Mutations disallowed by fixture.' })
    return
  }
  restReads.push({ kind, user, method: request.method() })
  if (user === 'C') {
    await route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })
    return
  }
  const version = versions[kind]
  await route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'Cache-Control': 'no-store' },
    body: JSON.stringify({ version, label: kind + '-version-' + version }),
  })
})
async function createPage(user) {
  const page = await context.newPage()
  page.on('pageerror', error => errors.push({ user, error: String(error) }))
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push({ user, console: msg.text() })
  })
  await page.goto(url + '/tests/fixtures/realtime-f4-browser.html?user=' + user, {
    waitUntil: 'networkidle',
  })
  await page.waitForFunction(() => window.F4Ready === true)
  await page.evaluate(() => window.F4.start())
  await page.waitForFunction(() => window.F4.stats().status === 'connected')
  return page
}
async function mount(page, kind) {
  const key = await page.evaluate(async kind => {
    const key = window.F4.mount(kind)
    await window.F4.settled()
    return key
  }, kind)
  return key
}
async function waitVersion(page, key, expected) {
  await page.waitForFunction(({ key, expected }) =>
    window.F4.version(key) === expected, { key, expected }, { timeout: 10000 })
}
async function emit(page, kind, version) {
  await page.evaluate(({ kind, version }) => window.F4.emit(kind, version), { kind, version })
}
try {
  const a1 = await createPage('A')
  const cdp = await context.newCDPSession(a1)
  await cdp.send('HeapProfiler.enable')
  await cdp.send('HeapProfiler.collectGarbage')
  const startHeap = await a1.evaluate(() => performance.memory?.usedJSHeapSize ?? null)
  const first = await a1.evaluate(() => window.F4.cycles(100))
  await cdp.send('HeapProfiler.collectGarbage')
  const afterFirstHeap = await a1.evaluate(() => performance.memory?.usedJSHeapSize ?? null)
  const second = await a1.evaluate(() => window.F4.cycles(100))
  await cdp.send('HeapProfiler.collectGarbage')
  const afterSecondHeap = await a1.evaluate(() => performance.memory?.usedJSHeapSize ?? null)
  assert.equal(first.mounts, 100)
  assert.equal(first.unmounts, 100)
  assert.equal(first.watcherCount, 0)
  assert.equal(first.leakedListeners, 0)
  assert.equal(first.activeSockets, first.baselineSockets)
  assert.equal(first.totalSockets, 1)
  assert.equal(second.mounts, 200)
  assert.equal(second.unmounts, 200)
  assert.equal(second.watcherCount, 0)
  assert.equal(second.leakedListeners, 0)
  assert.equal(second.activeSockets, second.baselineSockets)
  assert.equal(second.totalSockets, 1)
  const heapDelta = afterSecondHeap != null && afterFirstHeap != null
    ? afterSecondHeap - afterFirstHeap : null
  report.vueCycles = 200
  report.listenerGrowth = second.leakedListeners
  report.socketGrowth = second.totalSockets - first.totalSockets
  report.heapUsedBytes = { startHeap, afterFirstHeap, afterSecondHeap }
  report.heapDeltaBytesSecondHundred = heapDelta
  // Chrome's GC heap has noise; hard-fail on sustained > 3 MiB growth
  // after the *second* identical 100-cycle cohort.
  if (heapDelta !== null) assert.ok(heapDelta < 3 * 1024 * 1024,
    'Sustained retained heap growth beyond 3 MiB in second 100 Vue cycles')

  // 2 users (A, B), 2 tabs for A, plus unprivileged C.
  const a2 = await createPage('A')
  const b1 = await createPage('B')
  const c1 = await createPage('C')
  const a1Crm = await mount(a1, 'crm.account')
  const a2Crm = await mount(a2, 'crm.account')
  const b1Crm = await mount(b1, 'crm.account')
  const c1Crm = await mount(c1, 'crm.account')
  await Promise.all([
    waitVersion(a1, a1Crm, 1),
    waitVersion(a2, a2Crm, 1),
    waitVersion(b1, b1Crm, 1),
  ])
  await c1.waitForFunction(key => window.F4.denied(key) === true, c1Crm)
  assert.equal(await c1.evaluate(key => window.F4.version(key), c1Crm), 0)
  report.users = ['A/tab-1', 'A/tab-2', 'B/tab-1', 'C/denied']

  versions['crm.account'] = 2
  await a1.evaluate(key => window.F4.setDirty(key, true), a1Crm)
  await Promise.all([emit(a1, 'crm.account', 2), emit(a2, 'crm.account', 2),
    emit(b1, 'crm.account', 2)])
  await Promise.all([waitVersion(a2, a2Crm, 2), waitVersion(b1, b1Crm, 2)])
  await a1.waitForFunction(key => window.F4.conflict(key) === true, a1Crm)
  assert.equal(await a1.evaluate(key => window.F4.version(key), a1Crm), 1,
    'Dirty CRM draft was overwritten by remote invalidation')
  await a1.evaluate(key => {
    window.F4.setDirty(key, false)
    window.F4.resume('crm.account')
  }, a1Crm)
  await waitVersion(a1, a1Crm, 2)
  report.changedResources.push('crm.account')

  // Both views covered. The pricing backend producer is only simulated
  // because its real Outbox adapter is intentionally deferred to F6.
  const a1Pricing = await mount(a1, 'pricing.rate')
  const a2Pricing = await mount(a2, 'pricing.rate')
  const b1Pricing = await mount(b1, 'pricing.rate')
  await Promise.all([
    waitVersion(a1, a1Pricing, 1),
    waitVersion(a2, a2Pricing, 1),
    waitVersion(b1, b1Pricing, 1),
  ])
  versions['pricing.rate'] = 3
  await Promise.all([emit(a1, 'pricing.rate', 3),
    emit(a2, 'pricing.rate', 3), emit(b1, 'pricing.rate', 3)])
  await Promise.all([
    waitVersion(a1, a1Pricing, 3),
    waitVersion(a2, a2Pricing, 3),
    waitVersion(b1, b1Pricing, 3),
  ])
  report.changedResources.push('pricing.rate')

  // REST reconciliation on network recovery even when notification was lost.
  await a2.evaluate(() => window.F4.network(false))
  versions['crm.account'] = 5
  await a2.evaluate(() => window.F4.network(true))
  await waitVersion(a2, a2Crm, 5)
  assert.equal(restWrites.length, 0, 'Realtime client issued an unsafe mutation')
  report.postRequests = restWrites.length
  report.restGets = restReads.length

  for (const page of [a1, a2, b1, c1]) {
    await page.evaluate(() => window.F4.close())
    const stats = await page.evaluate(() => window.F4.stats())
    assert.equal(stats.watcherCount, 0)
    assert.equal(stats.activeSockets, 0)
    assert.equal(stats.restWrites, 0)
  }
  assert.deepEqual(errors, [], 'Browser emitted uncaught JavaScript errors')
  console.log('F4 BROWSER PASS ' + JSON.stringify(report))
} catch (error) {
  report.errors = errors
  console.error('F4 BROWSER FAIL', error, JSON.stringify(report))
  process.exitCode = 1
} finally {
  await mkdir('TestResults', { recursive: true })
  await writeFile('TestResults/rt-20261107-01-f4-browser.json',
    JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
