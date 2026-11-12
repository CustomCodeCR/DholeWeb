import assert from 'node:assert/strict'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const base = 'http://127.0.0.1:5188'
// Use a unique browser debugging port on shared CI runners. Fixed 9229 can
// collide with other concurrently running jobs or Node inspector sessions.
const chromeProfile = mkdtempSync(join(tmpdir(), 'dhole-pricing-chrome-'))
const productionBundle = process.env.DHOLE_PRICING_RUNTIME_SMOKE === '1'
const serveArgs = productionBundle
  ? ['node_modules/vite/bin/vite.js', 'preview', '--outDir', 'dist-smoke', '--host', '127.0.0.1', '--port', '5188', '--strictPort']
  : ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5188', '--strictPort']
const vite = spawn(process.execPath, serveArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
let viteLog = ''
vite.stdout.on('data', (chunk) => viteLog += chunk)
vite.stderr.on('data', (chunk) => viteLog += chunk)
let chrome
let chromeLog = ''
let ws
async function waitFor(getValue, label, iterations = 150) {
  for (let i = 0; i < iterations; i++) {
    await delay(200)
    try { const value = await getValue(); if (value) return value } catch {}
  }
  throw new Error('Timed out waiting for ' + label +
    '. Chrome output: ' + chromeLog.slice(-1600) +
    '. Vite output: ' + viteLog.slice(-500))
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
    '--remote-allow-origins=*', '--remote-debugging-port=0',
    '--user-data-dir=' + chromeProfile,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  chrome.stderr.on('data', (chunk) => chromeLog += chunk)
  chrome.on('error', (error) => { chromeLog += String(error) })
  const tab = await waitFor(async () => {
    if (chrome.exitCode !== null)
      throw new Error('Chrome terminated: ' + chromeLog.slice(-1500))
    const portFile = join(chromeProfile, 'DevToolsActivePort')
    if (!existsSync(portFile)) return null
    const port = Number(readFileSync(portFile, 'utf8').split('\n')[0])
    if (!Number.isInteger(port) || port <= 0) return null
    const response = await fetch('http://127.0.0.1:' + port + '/json/list')
    if (!response.ok) return null
    const tabs = await response.json()
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
    // Preserve the failing minified expression: Firefox/Chrome shorten the
    // original variable to one letter, so the literal bundle column matters.
    const position = error.match(/(PricingAlternativeWizardCrystal-[^/:]+\.js):(\d+):(\d+)/)
    if (position) {
      const code = readFileSync('dist-smoke/assets/' + position[1], 'utf8')
      const line = code.split('\n')[Number(position[2]) - 1] ?? ''
      const col = Number(position[3]) - 1
      console.error('Offending production expression:', line.slice(Math.max(0, col - 1300), col + 1400))
      console.error('G initializers:', [...code.matchAll(/\bG=[^,;]{1,110}/g)].slice(0, 12).map((m) => m[0]))
    }
    console.error('Chrome exceptions:', cdp.exceptions.slice(-8))
    console.error('Vite stderr:', viteLog.slice(-1000))
  }
  assert.equal(status, 'ready', 'Chrome did not render real Pricing wizard: ' + error)
} finally {
  try { ws?.close() } catch {}
  chrome?.kill('SIGTERM')
  vite.kill('SIGTERM')
  rmSync(chromeProfile, {recursive: true, force: true})
}
