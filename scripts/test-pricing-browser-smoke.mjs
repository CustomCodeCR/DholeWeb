import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const base = 'http://127.0.0.1:5188'
const debugBase = 'http://127.0.0.1:9229'
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5188', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let viteLog = ''
vite.stdout.on('data', (chunk) => viteLog += chunk)
vite.stderr.on('data', (chunk) => viteLog += chunk)
let chrome
let chromeLog = ''
let ws
async function waitFor(getValue, label, iterations = 80) {
  for (let i = 0; i < iterations; i++) {
    await delay(200)
    try { const value = await getValue(); if (value) return value } catch {}
  }
  throw new Error('Timed out waiting for ' + label)
}
function createCdp(client) {
  let seq = 0
  const pending = new Map()
  const exceptions = []
  client.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params?.exceptionDetails?.text ?? 'Browser exception')
    const p = pending.get(msg.id)
    if (p) {
      pending.delete(msg.id)
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result)
    }
  }
  function call(method, params = {}) {
    const id = ++seq
    return new Promise((resolve, reject) => {
      pending.set(id, {resolve, reject})
      client.send(JSON.stringify({id, method, params}))
    })
  }
  return { call, exceptions }
}
try {
  await waitFor(async () => (await fetch(base + '/tests/fixtures/pricing-wizard-smoke.html')).ok, 'Vite dev server')
  chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-dev-shm-usage', '--disable-extensions', '--no-proxy-server',
    '--remote-allow-origins=*', '--remote-debugging-port=9229',
    '--user-data-dir=/tmp/dhole-pricing-chrome-' + process.pid,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  chrome.stderr.on('data', (chunk) => chromeLog += chunk)
  const tab = await waitFor(async () => {
    const tabs = await (await fetch(debugBase + '/json/list')).json()
    return tabs.find((item) => item.type === 'page' && item.webSocketDebuggerUrl)
  }, 'Chrome DevTools')
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  const cdp = createCdp(ws)
  await cdp.call('Page.enable')
  await cdp.call('Runtime.enable')
  await cdp.call('Page.navigate', {url: base + '/tests/fixtures/pricing-wizard-smoke.html'})
  let status = '', error = ''
  for (let attempt = 0; attempt < 110; attempt++) {
    await delay(200)
    status = (await cdp.call('Runtime.evaluate', {expression: 'document.body?.dataset.smokeStatus', returnByValue: true})).result?.value ?? ''
    if (status === 'ready' || status === 'failed' || status === 'empty') break
  }
  error = (await cdp.call('Runtime.evaluate', {expression: 'document.body?.dataset.smokeError', returnByValue: true})).result?.value ?? ''
  console.log('Pricing wizard browser status:', status, 'reported error:', error)
  if (status !== 'ready') {
    const html = (await cdp.call('Runtime.evaluate', {expression: 'document.documentElement.outerHTML.slice(0, 2000)', returnByValue: true})).result?.value
    console.error('Browser HTML:', html)
    console.error('Chrome exceptions:', cdp.exceptions.slice(-8))
    console.error('Vite stderr:', viteLog.slice(-1000))
  }
  assert.equal(status, 'ready', 'Chrome did not render real Pricing wizard: ' + error)
} finally {
  try { ws?.close() } catch {}
  chrome?.kill('SIGTERM')
  vite.kill('SIGTERM')
}
