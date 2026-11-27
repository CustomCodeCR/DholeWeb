import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const path = new URL('../.github/workflows/deploy-staging.yml', import.meta.url)
const available = existsSync(path)
const workflow = available ? readFileSync(path, 'utf8') : ''

test('staging builds on GitHub and transfers verified SHA-specific images', { skip: !available }, () => {
  const [hosted, local] = workflow.split('  deploy:\n')
  assert.match(hosted, /runs-on: ubuntu-latest/)
  assert.match(hosted, /docker build --pull/)
  assert.match(hosted, /actions\/upload-artifact@v4/)
  assert.match(local, /needs: build/)
  assert.match(local, /actions\/download-artifact@v4/)
  assert.match(local, /sha256sum -c SHA256SUMS/)
  assert.match(local, /docker load/)
  assert.match(local, /--pull never/)
  assert.doesNotMatch(local, /docker (build|pull) /)
  assert.doesNotMatch(workflow, /docker (image|container|builder) prune/)
  assert.match(hosted, /VITE_DHOLE_REALTIME_ENABLED=true/)
})

test('staging shell blocks parse on Linux', { skip: !available || process.platform !== 'linux' }, () => {
  for (const match of workflow.matchAll(/^        run: \|\n((?:^ {10}[^\n]*\n|^\n)+)/gm)) {
    const script = match[1].split('\n').map(line => line.slice(10)).join('\n')
    const result = spawnSync('bash', ['-n'], { input: script, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
})
