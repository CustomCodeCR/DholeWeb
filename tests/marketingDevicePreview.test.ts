import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const previewUrl = new URL('../src/modules/marketing/components/MarketingLivePreview.vue', import.meta.url)
const deviceUrl = new URL('../src/shared/components/molecules/DhDevicePreview.vue', import.meta.url)

test('FASE 53 uses the official DhDevicePreview with Desktop Tablet and Mobile controls', async () => {
  const preview = await readFile(previewUrl, 'utf8')
  const device = await readFile(deviceUrl, 'utf8')

  assert.match(preview, /DhDevicePreview/)
  assert.match(preview, /v-model="previewDevice"/)
  assert.match(preview, /desktop: tr\('Desktop', 'Desktop'\)/)
  assert.match(preview, /tablet: tr\('Tablet', 'Tablet'\)/)
  assert.match(preview, /mobile: tr\('Mobile', 'Mobile'\)/)
  assert.match(device, /Monitor, Smartphone, Tablet/)
})

test('FASE 53 provides explicit device widths and keeps the user inside the editor', async () => {
  const preview = await readFile(previewUrl, 'utf8')

  assert.match(preview, /desktop: 1280/)
  assert.match(preview, /tablet: 768/)
  assert.match(preview, /mobile: 390/)
  assert.match(preview, /:widths="deviceWidths"/)
  assert.doesNotMatch(preview, /window\.open|location\.href|router\.push/)
})

test('FASE 53 makes the live renderer respond to the selected device', async () => {
  const preview = await readFile(previewUrl, 'utf8')

  assert.match(preview, /#default="\{ device \}"/)
  assert.match(preview, /preview-device-\$\{device\}/)
  assert.match(preview, /\.preview-device-tablet \.preview-services/)
  assert.match(preview, /\.preview-device-mobile \.preview-hero-text-image/)
  assert.match(preview, /\.preview-device-mobile \.preview-services/)
  assert.match(preview, /\.preview-device-mobile \.preview-gallery/)
})

test('FASE 53 preserves the FASE 52 live preview instead of introducing a separate page preview', async () => {
  const preview = await readFile(previewUrl, 'utf8')

  assert.match(preview, /visibleBlocks/)
  assert.match(preview, /mediaUrl\(block\)/)
  assert.match(preview, /animationClass\(block\)/)
  assert.match(preview, /emit\('select', block\)/)
})
