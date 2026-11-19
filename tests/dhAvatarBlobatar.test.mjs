import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { Blobatar } from '@blobatar/vue'

const themeCss = readFileSync(new URL('../src/assets/theme.css', import.meta.url), 'utf8')
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
  assert.ok(topbar.includes('<DhAvatar :src="avatarMascot.photo" :id="authStore.userId" :name="displayName"'))
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

test('Dark mode profile uses a true black backdrop without changing light mode', () => {
  assert.ok(topbar.includes('border-white/15 bg-black'))
  assert.ok(topbar.includes('border-slate-200 bg-white/95'))
  assert.match(topbar, /:dark-backdrop="themeStore\.resolvedTheme === 'dark'"/)
  assert.match(avatar, /:background="darkBackdrop \? false : 'circle'"/)
  assert.match(avatar, /background: #000/)
})

test('Avatar reacts on tap, click and keyboard with replayable expressions', () => {
  assert.ok(topbar.includes('@click="avatarTapTrigger += 1; avatarAppearance.nextExpression()"'))
  assert.match(topbar, /:tap-trigger="avatarTapTrigger"/)
  assert.match(avatar, /watch\(\(\) => props\.tapTrigger/)
  assert.match(avatar, /tapMood\.value = 'surprised'/)
  assert.match(avatar, /tapMood\.value = 'wink'/)
  assert.match(avatar, /tapMood\.value = 'happy'/)
  assert.match(avatar, /clearTapTimers\(\)/)
  assert.match(avatar, /dh-avatar--tap-a/)
  assert.match(avatar, /dh-avatar--tap-b/)
  assert.match(avatar, /prefers-reduced-motion: reduce/)
})

test('Expression preview starts angry, cycles the supported poses and retains the selected one', () => {
  assert.match(avatar, /const previewMoods = \['mad', 'happy', 'sad'/)
  assert.match(avatar, /previewIndex = ref\(-1\)/)
  assert.match(avatar, /previewIndex\.value = \(previewIndex\.value \+ 1\) % previewMoods\.length/)
  assert.match(avatar, /tapMood\.value = previewMoods\[previewIndex\.value\]/)
  assert.match(avatar, /Keep the selected pose until the next click/)
  assert.match(avatar, /tapActive\.value = false }, 720/)
  assert.match(avatar, /role="status"/)
  assert.match(avatar, /\{\{ previewLabel \}\}/)
  assert.match(topbar, /:preview-expressions="true"/)
  assert.match(topbar, /Cambiar expresión del avatar/)
})

test('Blobatar 2.7.0 renders an angry face and all distinct preview expressions locally', async () => {
  const { idle, happy, sad, mad, surprised, wink, sleepy, smug, unsure, scared, love, shy, sick, thinking } = await import('blobatar/expression')
  const poses = [mad, happy, sad, surprised, wink, sleepy, smug, unsure, scared, love, shy, sick, thinking, idle]
  const output = await Promise.all(poses.map(expression =>
    renderToString(createSSRApp({ render: () =>
      h(Blobatar, { name: 'dhole-user-42', size: 40, animate: 'always', expression }) })),
  ))
  assert.equal(output.length, 14)
  assert.equal(new Set(output).size, 14)
  assert.ok(output.every(markup => markup.includes('<svg')))
})

test('Dhole dark utilities follow the selected theme instead of the OS', () => {
  assert.ok(themeCss.includes('@custom-variant dark (&:where(.dark, .dark *));'))
})

test('Profile and expression badge contrast are readable in light and dark themes', () => {
  assert.ok(topbar.includes("themeStore.resolvedTheme === 'dark'"))
  assert.ok(topbar.includes('border-slate-200 bg-white/95'))
  assert.ok(topbar.includes('border-white/15 bg-black'))
  assert.ok(topbar.includes("'text-white' : 'text-slate-900'"))
  assert.ok(topbar.includes("'text-white/65' : 'text-slate-600'"))
  assert.ok(!topbar.includes('dark:bg-black'))
  assert.ok(avatar.includes("darkBackdrop ? 'border-white/15 bg-zinc-950 text-white' : 'border-slate-200 bg-white text-slate-900'"))
  assert.ok(avatar.includes(':background="darkBackdrop ? false : \'circle\'"'))
  assert.ok(topbar.includes(':preview-expressions="true"'))
})

test('Selected expression is stored per user and restored when the avatar mounts', () => {
  assert.ok(avatar.includes('dhole.blobatar.expression.v1:'))
  assert.ok(avatar.includes('encodeURIComponent(id)'))
  assert.ok(avatar.includes('window.localStorage.setItem(key, mood)'))
  assert.ok(avatar.includes('window.localStorage.getItem(key)'))
  assert.ok(avatar.includes('previewMoods.indexOf(saved as PreviewMood)'))
  assert.ok(avatar.includes('restoreMood()'))
  assert.ok(avatar.includes('watch(() => props.id'))
})

test('Automatic expressions cycle every 30 seconds and pause on hidden or reduced-motion pages', () => {
  assert.ok(avatar.includes('AUTO_MOOD_INTERVAL_MS = 30_000'))
  assert.ok(avatar.includes('setInterval(advancePreviewMood, AUTO_MOOD_INTERVAL_MS)'))
  assert.ok(avatar.includes('document.hidden'))
  assert.ok(avatar.includes('reducedMotion?.matches'))
  assert.ok(avatar.includes('visibilitychange'))
  assert.ok(avatar.includes('stopAutoMoodTimer()'))
  assert.ok(avatar.includes('rememberMood(tapMood.value)'))
})

test('Topbar delegates expressions to shared Pinia state without an Auto/Fixed button', () => {
  assert.ok(topbar.includes('useAvatarAppearanceStore'))
  assert.ok(topbar.includes('avatarAppearance.nextExpression()'))
  assert.ok(topbar.includes(':controlled-expressions="true"'))
  assert.ok(topbar.includes(':mood="avatarAppearance.expression'))
  assert.ok(!topbar.includes('toggleAvatarAutoExpressions'))
  assert.ok(!topbar.includes("{{ avatarAutoExpressions ? 'Auto' : 'Fijo' }}"))
})

test('Appearance has a large interactive avatar preview and Dhole Auto/Fixed buttons', () => {
  const appearance = readFileSync(new URL('../src/modules/settings/views/AppearanceSettingsView.vue', import.meta.url), 'utf8')
  assert.ok(appearance.includes('size="xl"'))
  assert.ok(appearance.includes('<DhCard :title="t(\'appearance.avatarTitle\')"'))
  assert.ok(appearance.includes(':controlled-expressions="true"'))
  assert.ok(appearance.includes('avatarAppearance.setAutomatic(true)'))
  assert.ok(appearance.includes('avatarAppearance.setAutomatic(false)'))
  assert.ok(appearance.includes('avatarAppearance.nextExpression()'))
  assert.ok(appearance.includes('useAvatarAppearanceStore'))
  assert.ok(avatar.includes("xl: 'h-40 w-40'"))
})

test('Shared avatar store has one 30-second timer, persists user preferences and synchronizes tabs', () => {
  const shared = readFileSync(new URL('../src/core/stores/avatarAppearanceStore.ts', import.meta.url), 'utf8')
  assert.ok(shared.includes("defineStore('avatarAppearance'"))
  assert.ok(shared.includes('AVATAR_AUTO_INTERVAL_MS = 30_000'))
  assert.ok(shared.includes('setInterval(rotate, AVATAR_AUTO_INTERVAL_MS)'))
  assert.ok(shared.includes('consumers === 1'))
  assert.ok(shared.includes("'dhole.blobatar.' + kind + '.v1:'"))
  assert.ok(shared.includes("event.key === keyFor('mode')"))
  assert.ok(shared.includes("event.key === keyFor('expression')"))
  assert.ok(shared.includes("document.addEventListener('visibilitychange'"))
  assert.ok(shared.includes("window.addEventListener('storage'"))
  assert.ok(avatar.includes('controlledExpressions?: boolean'))
})

test('Avatar appearance translations are complete in English and Spanish', () => {
  for (const lang of ['es', 'en']) {
    const data = JSON.parse(readFileSync(new URL('../src/core/i18n/' + lang + '.json', import.meta.url), 'utf8'))
    for (const label of ['avatarTitle', 'avatarAuto', 'avatarFixed', 'avatarNext', 'avatarHelp']) {
      assert.ok(data.appearance[label])
    }
    assert.equal(Object.keys(data.appearance.avatarMoods).length, 58)
  }
})


test('Dhole adds three distinct native Blobatar poses, synchronized with shared rotation', async () => {
  const { stressed, tired, resigned } = await import('../src/shared/components/atoms/blobatarExpressions.ts')
  const { mad, sleepy, sad } = await import('blobatar/expression')
  const faces = await Promise.all([stressed, tired, resigned, mad, sleepy, sad].map(expression =>
    renderToString(createSSRApp({ render: () =>
      h(Blobatar, { name: 'dhole-user-42', size: 160, animate: 'always', expression }) })),
  ))
  assert.equal(new Set(faces).size, 6)
  const store = readFileSync(new URL('../src/core/stores/avatarAppearanceStore.ts', import.meta.url), 'utf8')
  for (const mood of ['stressed', 'tired', 'resigned']) {
    assert.ok(store.includes(`'${mood}'`))
    assert.ok(avatar.includes(mood))
    for (const lang of ['es', 'en']) {
      const data = JSON.parse(readFileSync(new URL('../src/core/i18n/' + lang + '.json', import.meta.url), 'utf8'))
      assert.ok(data.appearance.avatarMoods[mood])
    }
  }
  assert.ok(avatar.includes('controlledExpressions'))
})


test('36 new Blobatar poses are registered, translated and render unique SVGs', async () => {
  const keys = ["achicopalado","emperrado","emocionado","nostalgico","desesperado","aburrido","pereza","celoso","avergonzado","culpable","orgulloso","curioso","asqueado","preocupado","decepcionado","irritado","impaciente","ojosLlorosos","arrogante","melancolico","humillado","miserable","abrumado","vulnerable","rechazado","desilusionado","alarmado","horrorizado","pasmado","irritable","desconcertado","desmotivado","resentido","agobiado","temeroso","incomodo"]
  const roster = readFileSync(new URL('../src/core/stores/avatarAppearanceStore.ts', import.meta.url), 'utf8')
  const poses = await import('../src/shared/components/atoms/blobatarExpressions.ts')
  assert.equal(keys.length, 36)
  for (const key of keys) {
    assert.ok(roster.includes(`'${key}'`), key + ' missing from shared roster')
    assert.ok(avatar.includes(key), key + ' missing from avatar')
    assert.ok(poses[key]?.p && typeof poses[key].vars === 'function', key + ' must be a native pose')
    for (const lang of ['es', 'en']) {
      const translations = JSON.parse(readFileSync(new URL('../src/core/i18n/' + lang + '.json', import.meta.url), 'utf8'))
      assert.ok(translations.appearance.avatarMoods[key], lang + ': ' + key)
    }
  }
  const output = await Promise.all(keys.map(key => renderToString(createSSRApp({
    render: () => h(Blobatar, { name: 'dhole-user-42', size: 160, animate: 'always', expression: poses[key] }),
  }))))
  assert.equal(new Set(output).size, 36)
  assert.ok(output.every(markup => markup.includes('<svg')))
  const view = readFileSync(new URL('../src/modules/settings/views/AppearanceSettingsView.vue', import.meta.url), 'utf8')
  assert.ok(view.includes('<DhSelect'))
  assert.ok(view.includes('avatarAppearance.setExpression'))
  assert.ok(roster.includes("saveSetting(keyFor('mode'), 'fixed')"))
})


test('Five additional emotions render distinct native Blobatar SVG poses', async () => {
  const keys = ['cringe', 'burlon', 'picaro', 'paranoico', 'disociado']
  const moods = await import('../src/shared/components/atoms/blobatarExpressions.ts')
  const registered = readFileSync(new URL('../src/core/stores/avatarAppearanceStore.ts', import.meta.url), 'utf8')
  for (const key of keys) {
    assert.ok(registered.includes(`'${key}'`))
    assert.ok(avatar.includes(key))
    assert.ok(moods[key]?.p)
    for (const lang of ['es', 'en']) {
      const translations = JSON.parse(readFileSync(new URL('../src/core/i18n/' + lang + '.json', import.meta.url), 'utf8'))
      assert.ok(translations.appearance.avatarMoods[key])
      assert.equal(Object.keys(translations.appearance.avatarMoods).length, 58)
    }
  }
  const rendered = await Promise.all(keys.map(key => renderToString(createSSRApp({
    render: () => h(Blobatar, { name: 'dhole-user-42', size: 160, animate: 'always', expression: moods[key] }),
  }))))
  assert.equal(new Set(rendered).size, 5)
  assert.ok(rendered.every(markup => markup.includes('<svg')))
})

test('Profile photo replaces topbar Blobatar while mascot is per user and globally mounted', () => {
  const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  const mascot = readFileSync(new URL('../src/shared/components/atoms/DhMascot.vue', import.meta.url), 'utf8')
  const storage = readFileSync(new URL('../src/core/stores/avatarMascotStore.ts', import.meta.url), 'utf8')
  const appearance = readFileSync(new URL('../src/modules/settings/views/AppearanceSettingsView.vue', import.meta.url), 'utf8')

  assert.ok(topbar.includes(':src="avatarMascot.photo"'))
  assert.ok(app.includes('authStore.isAuthenticated && !isPublicRoute && !isEmbedded'))
  assert.ok(app.includes('mascot.selectUser(id)'))
  assert.ok(mascot.includes('size="lg"'))
  assert.ok(mascot.includes('mascot.movement === \'roam\''))
  assert.ok(mascot.includes('pointerDown') && mascot.includes('pointerMove') && mascot.includes('pointerUp'))
  assert.ok(mascot.includes('ArrowLeft') && mascot.includes('ArrowDown'))
  assert.ok(mascot.includes("matchMedia('(prefers-reduced-motion: reduce)')"))
  assert.ok(mascot.includes('document.hidden'))
  assert.ok(storage.includes("KEY_PREFIX = 'dhole.blobatar.mascot.v1:'"))
  assert.ok(storage.includes("encodeURIComponent(userId.value)"))
  assert.ok(storage.includes("window.addEventListener('storage', handleStorage)"))
  assert.ok(storage.includes('setPhoto') && storage.includes('setName') && storage.includes('setMovement'))
  assert.ok(appearance.includes('handleProfilePhotoChange'))
  assert.ok(appearance.includes("canvas.toDataURL('image/jpeg', 0.8)"))
  assert.ok(appearance.includes('avatarMascot.setPhoto(null)'))
  assert.ok(appearance.includes('<DhSelect'))
})
