import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
const exec = promisify(execFile)
const port = '5188'
const base = 'http://127.0.0.1:' + port
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''
child.stdout.on('data', (chunk) => output += chunk)
child.stderr.on('data', (chunk) => output += chunk)
try {
  let ready = false
  for (let attempt = 0; attempt < 80; attempt++) {
    await delay(250)
    if (child.exitCode !== null) break
    try { const res = await fetch(base + '/tests/fixtures/pricing-wizard-smoke.html'); ready = res.ok; if (ready) break } catch { }
  }
  assert.ok(ready, 'Vite smoke server did not start: ' + output.slice(-3000))
  const { stdout } = await exec('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--disable-extensions',
    '--virtual-time-budget=6500', '--dump-dom',
    base + '/tests/fixtures/pricing-wizard-smoke.html',
  ], { maxBuffer: 8_000_000, timeout: 60_000 })
  const status = stdout.match(/data-smoke-status="([^"]+)"/)?.[1]
  const error = stdout.match(/data-smoke-error="([^"]+)"/)?.[1]
  console.log('Pricing wizard browser mount status:', status, 'error:', error ?? 'none')
  assert.equal(status, 'ready', 'Actual Chrome mounting failed: ' + String(error || stdout.slice(0, 3500)))
} finally {
  child.kill('SIGTERM')
}
