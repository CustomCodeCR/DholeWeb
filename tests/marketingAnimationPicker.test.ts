import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const animationPickerUrl = new URL('../src/modules/marketing/components/MarketingAnimationPicker.vue', import.meta.url)
const propertiesUrl = new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url)
const editorUrl = new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url)

test('FASE 50 exposes exactly the six human animation choices requested by the roadmap', async () => {
  const source = await readFile(animationPickerUrl, 'utf8')

  assert.match(source, /title: tr\('Sin animación', 'No animation'\)/)
  assert.match(source, /title: tr\('Aparecer suavemente', 'Fade in softly'\)/)
  assert.match(source, /title: tr\('Subir suavemente', 'Slide up softly'\)/)
  assert.match(source, /title: tr\('Entrar desde izquierda', 'Enter from left'\)/)
  assert.match(source, /title: tr\('Entrar desde derecha', 'Enter from right'\)/)
  assert.match(source, /title: tr\('Zoom suave', 'Soft zoom'\)/)
  assert.match(source, /preset: 'none'/)
  assert.match(source, /preset: 'fade'/)
  assert.match(source, /preset: 'slide-up'/)
  assert.match(source, /preset: 'slide-left'/)
  assert.match(source, /preset: 'slide-right'/)
  assert.match(source, /preset: 'zoom-in'/)
  assert.doesNotMatch(source, /title: 'Fade'|title: 'Slide Up'|title: 'Slide Left'|title: 'Slide Right'|title: 'Zoom'/)
})

test('FASE 50 previews each visual option on hover without exposing technical controls', async () => {
  const source = await readFile(animationPickerUrl, 'utf8')

  assert.match(source, /animation-option:hover/)
  assert.match(source, /preview-fade:hover/)
  assert.match(source, /preview-slide-up:hover/)
  assert.match(source, /preview-slide-left:hover/)
  assert.match(source, /preview-slide-right:hover/)
  assert.match(source, /preview-zoom:hover/)
  assert.match(source, /prefers-reduced-motion/)
})

test('FASE 50 renders the picker in the Animation properties tab', async () => {
  const source = await readFile(propertiesUrl, 'utf8')

  assert.match(source, /MarketingAnimationPicker/)
  assert.match(source, /activeSection === 'animation'/)
  assert.match(source, /@select="saveAnimation"/)
  assert.match(source, /Pase el cursor sobre cada opción para ver una vista previa/)
  assert.match(source, /'save-animation': \[preset: CmsMotionPreset\]/)
})

test('FASE 50 persists the selected preset through Page Builder animationJson', async () => {
  const source = await readFile(editorUrl, 'utf8')

  assert.match(source, /async function saveBlockAnimation\(block: PageBuilderBlock, preset: CmsMotionPreset\)/)
  assert.match(source, /operation: 'edit'/)
  assert.match(source, /animationJson: JSON\.stringify\(animation\)/)
  assert.match(source, /block\.animation \? \{ \.\.\.block\.animation, preset \} : \{ preset \}/)
  assert.equal((source.match(/@save-animation=/g) ?? []).length, 2)
})

test('FASE 50 does not advance the simple animation levels from FASE 51', async () => {
  const picker = await readFile(animationPickerUrl, 'utf8')
  const properties = await readFile(propertiesUrl, 'utf8')
  const visibleSource = `${picker}\n${properties}`

  assert.doesNotMatch(visibleSource, /Movimiento:/)
  assert.doesNotMatch(visibleSource, /Velocidad:/)
  assert.doesNotMatch(visibleSource, /Suave.*Normal.*Dinámico/s)
  assert.doesNotMatch(visibleSource, /Lenta\s*\/\s*Normal\s*\/\s*Rápida/)
})
