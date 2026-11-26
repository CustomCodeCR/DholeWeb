import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const workflowPath = new URL('../.github/workflows/deploy-staging.yml', import.meta.url)
const available = existsSync(workflowPath) // Docker build context intentionally excludes .github.
const workflow = available ? readFileSync(workflowPath, 'utf8') : ''
const build = available ? workflow.split('      - name: Build image\n')[1].split('      - name: Verify staging bundle')[0]
  .split('        run: |\n')[1].split('\n').map(line => line.slice(10)).join('\n') : ''

test('staging build checks Docker DNS and retries only DNS failures', { skip: !available }, () => {
  assert.match(build, /probe_dns bridge/)
  assert.match(build, /probe_dns host/)
  assert.match(build, /docker build --pull --network "\$1"/)
  assert.match(build, /ENOTFOUND\|EAI_AGAIN/)
  assert.match(build, /build_image host/)
  assert.match(build, /set -euo pipefail/)
  assert.doesNotMatch(workflow, /docker image prune -af|docker container prune -f/)
  assert.match(workflow, /docker builder prune -af --filter until=168h/)
})

test('staging build shell parses on Linux', { skip: !available || process.platform !== 'linux' }, () => {
  const result = spawnSync('bash', ['-n'], { input: build, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
