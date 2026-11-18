import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { Blobatar } from '@blobatar/vue'
import { happy, idle, sleepy, thinking } from 'blobatar/expression'

const avatar = readFileSync(new URL('../src/shared/components/atoms/DhAvatar.vue', import.meta.url), 'utf8')
const topbar = readFileSync(new URL('../src/shared/components/organisms/DhTopbar.vue', import.meta.url), 'utf8')

test('Dhole avatar keeps photography, local Blobatar, initials and stable IDs', () => {
  assert.match(avatar, /v-if="src && !photoFailed"/)
  assert.match(avatar, /fallback === 'blobatar' && avatarSeed/)
  assert.match(avatar, /v-else\s*\n/)
  assert.match(avatar, /status === 'online'/)
  assert.match(avatar, /watch\(\(\) => props\.src/)
  assert.match(avatar, /:hue="210"/)
  assert.match(avatar, /String\(props\.id \?\? ''\)/)
})

test('Dhole avatar supports continuous, hover and static modes', () => {
  assert.match(avatar, /animate\?: boolean \| 'hover' \| 'always'/)
  assert.match(avatar, /animate: false/)
  assert.match(avatar, /props\.animate === true \? 'hover'/)
  assert.match(avatar, /followCursor && animationMode === 'always' && canTrackPointer/)
  assert.match(avatar, /:animate="animationMode"/)
})

test('Avatar expressions respond to presence and pointer hover', () => {
  assert.match(avatar, /props\.status === 'busy'\) return 'thinking'/)
  assert.match(avatar, /props\.status === 'offline'\) return 'sleepy'/)
  assert.match(avatar, /hovered\.value && animationMode\.value \? 'happy' : 'idle'/)
  assert.match(avatar, /event\.pointerType === 'mouse' \|\| event\.pointerType === 'pen'/)
})

test('Eye tracking only opts in on fine pointers and respects reduced motion', () => {
  assert.match(avatar, /useGaze\(trackedBlob, \{ travel: 3, target: 'pointer' \}\)/)
  assert.match(avatar, /prefers-reduced-motion: reduce/)
  assert.match(avatar, /hover: hover\) and \(pointer: fine/)
  assert.match(avatar, /onBeforeUnmount/)
  assert.match(avatar, /@media \(prefers-reduced-motion: reduce\)/)
})

test('Topbar uses authenticated ID, continuous breathing and pointer tracking', () => {
  assert.match(topbar, /<DhAvatar :id="authStore\.userId" :name="displayName"/)
  assert.match(topbar, /animate="always" :follow-cursor="true"/)
})

test('Local Blobatar SSR is deterministic and each mood changes the face', async () => {
  const render = (name, options = {}) => renderToString(createSSRApp({
    render: () => h(Blobatar, { name, size: 40, background: 'circle', hue: 210, ...options }),
  }))
  const first = await render('dhole-user-42')
  assert.equal(first, await render('dhole-user-42'))
  assert.notEqual(first, await render('dhole-user-43'))
  assert.match(first, /<img/)
  const neutral = await render('dhole-user-42', { animate: 'always', expression: idle })
  assert.match(neutral, /<svg/)
  assert.notEqual(neutral, await render('dhole-user-42', { animate: 'always', expression: happy }))
  assert.notEqual(neutral, await render('dhole-user-42', { animate: 'always', expression: thinking }))
  assert.notEqual(neutral, await render('dhole-user-42', { animate: 'always', expression: sleepy }))
})
