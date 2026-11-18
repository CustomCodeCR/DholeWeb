import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { Blobatar } from '@blobatar/vue'

const avatar = readFileSync(new URL('../src/shared/components/atoms/DhAvatar.vue', import.meta.url), 'utf8')
const topbar = readFileSync(new URL('../src/shared/components/organisms/DhTopbar.vue', import.meta.url), 'utf8')

test('Dhole avatar keeps photography, local Blobatar and initials fallbacks', () => {
  assert.match(avatar, /v-if="src && !photoFailed"/)
  assert.match(avatar, /fallback === 'blobatar' && avatarSeed/)
  assert.match(avatar, /v-else\s*\n/)
  assert.match(avatar, /status === 'online'/)
  assert.match(avatar, /watch\(\(\) => props\.src/)
  assert.match(avatar, /:hue="210"/)
})

test('Topbar avatar seed uses authenticated user ID rather than mutable display name', () => {
  assert.match(topbar, /<DhAvatar :id="authStore\.userId" :name="displayName"/)
})

test('Blobatar Vue renders a deterministic local avatar and supports animation', async () => {
  const staticAvatar = async (name) => renderToString(createSSRApp({ render: () => h(Blobatar, { name, size: 40, background: 'circle', hue: 210 }) }))
  const first = await staticAvatar('dhole-user-42')
  const second = await staticAvatar('dhole-user-42')
  const other = await staticAvatar('dhole-user-43')
  assert.equal(first, second)
  assert.notEqual(first, other)
  assert.match(first, /<img/)
  const animated = await renderToString(createSSRApp({ render: () => h(Blobatar, { name: 'dhole-user-42', size: 40, animate: 'hover' }) }))
  assert.match(animated, /<svg/)
})
