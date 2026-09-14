import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const animationPickerUrl = new URL('../src/modules/marketing/components/MarketingAnimationPicker.vue', import.meta.url)
const animationLevelsUrl = new URL('../src/modules/marketing/components/MarketingAnimationLevelControls.vue', import.meta.url)
const propertiesUrl = new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url)
const editorUrl = new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url)

test('FASE 50 keeps the six human animation choices requested by the roadmap', async () => {
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

test('FASE 50 keeps hover previews for each visual animation option', async () => {
  const source = await readFile(animationPickerUrl, 'utf8')

  assert.match(source, /animation-option:hover/)
  assert.match(source, /preview-fade:hover/)
  assert.match(source, /preview-slide-up:hover/)
  assert.match(source, /preview-slide-left:hover/)
  assert.match(source, /preview-slide-right:hover/)
  assert.match(source, /preview-zoom:hover/)
  assert.match(source, /prefers-reduced-motion/)
})

test('FASE 51 exposes four simple Movement levels and three optional Speed levels', async () => {
  const source = await readFile(animationLevelsUrl, 'utf8')

  assert.match(source, /tr\('Movimiento', 'Movement'\)/)
  assert.match(source, /tr\('Ninguno', 'None'\)/)
  assert.match(source, /tr\('Suave', 'Soft'\)/)
  assert.match(source, /tr\('Normal', 'Normal'\)/)
  assert.match(source, /tr\('Dinámico', 'Dynamic'\)/)
  assert.match(source, /tr\('Velocidad', 'Speed'\)/)
  assert.match(source, /tr\('Lenta', 'Slow'\)/)
  assert.match(source, /tr\('Rápida', 'Fast'\)/)
  assert.match(source, /Opcional: elija una velocidad simple/)
})

test('FASE 51 maps human levels to bounded backend distance and duration values', async () => {
  const source = await readFile(animationLevelsUrl, 'utf8')

  assert.match(source, /distance: 0/)
  assert.match(source, /distance: 16/)
  assert.match(source, /distance: 32/)
  assert.match(source, /distance: 64/)
  assert.match(source, /duration: 900/)
  assert.match(source, /duration: 600/)
  assert.match(source, /duration: 400/)
  assert.match(source, /distance: 32,\n  duration: 600/)
})

test('FASE 51 uses Dhole buttons instead of technical sliders or numeric inputs', async () => {
  const source = await readFile(animationLevelsUrl, 'utf8')

  assert.match(source, /DhButton/)
  assert.doesNotMatch(source, /type=["']range["']/i)
  assert.doesNotMatch(source, /<input/i)
  assert.doesNotMatch(source, /transform:|translate[XYZ]?\(|cubic-bezier/i)
})

test('FASE 51 integrates movement and speed below the FASE 50 picker', async () => {
  const source = await readFile(propertiesUrl, 'utf8')

  assert.match(source, /MarketingAnimationPicker/)
  assert.match(source, /MarketingAnimationLevelControls/)
  assert.match(source, /:distance="animationDistance"/)
  assert.match(source, /:duration="animationDuration"/)
  assert.match(source, /@update-distance="saveAnimationDistance"/)
  assert.match(source, /@update-duration="saveAnimationDuration"/)
  assert.match(source, /'save-animation-settings': \[payload: MarketingAnimationSettingsPatch\]/)
})

test('FASE 51 persists settings through animationJson while preserving existing animation configuration', async () => {
  const source = await readFile(editorUrl, 'utf8')

  assert.match(source, /async function saveBlockAnimationSettings\(block: PageBuilderBlock, patch: AnimationSettingsPatch\)/)
  assert.match(source, /const currentDistance = block\.animation\?\.distance \?\? 32/)
  assert.match(source, /const currentDuration = block\.animation\?\.duration \?\? 600/)
  assert.match(source, /\{ \.\.\.block\.animation, \.\.\.patch \}/)
  assert.match(source, /preset: 'none' as CmsMotionPreset, \.\.\.patch/)
  assert.match(source, /animationJson: JSON\.stringify\(animation\)/)
  assert.equal((source.match(/@save-animation-settings=/g) ?? []).length, 2)
})

test('FASE 51 keeps the FASE 50 preset persistence path unchanged', async () => {
  const source = await readFile(editorUrl, 'utf8')

  assert.match(source, /async function saveBlockAnimation\(block: PageBuilderBlock, preset: CmsMotionPreset\)/)
  assert.match(source, /block\.animation \? \{ \.\.\.block\.animation, preset \} : \{ preset \}/)
  assert.equal((source.match(/@save-animation=/g) ?? []).length, 2)
})
