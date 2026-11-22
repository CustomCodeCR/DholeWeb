import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const wizard = source('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
const opening = source('src/modules/operations/views/OperationsManualCreateView.vue')
const stepper = source('src/modules/pricing/components/PricingWizardStepper.vue')
const autosave = source('build/pricingWizardDraftAutosave.ts')
const multipleDrafts = source('build/pricingWizardMultipleDrafts.ts')
const editGuard = source('build/pricingRateEditCreateParity.ts')
const responsive = source('build/pricingWizardLclStableFlow.ts')

test('Pricing reuses exactly the Operations stepper, without the legacy stepbar', () => {
  assert.match(opening, /<PricingWizardStepper/)
  assert.match(wizard, /import PricingWizardStepper from '@\/modules\/pricing\/components\/PricingWizardStepper.vue'/)
  assert.match(wizard, /<PricingWizardStepper/)
  assert.match(wizard, /:steps="pricingNavigationSteps"/)
  assert.match(wizard, /:active-step="step"/)
  assert.match(wizard, /@update:active-step="goToStep"/)
  assert.doesNotMatch(wizard, /<div class="crystal-stepbar/)
  assert.match(stepper, /aria-current/)
  assert.match(stepper, /:style="\{ '--wizard-step-columns': steps\.length \}"/)
})

test('Wizard keeps all Pricing steps including the read-only ninth step', () => {
  for (const label of ['Modalidad','Embarque','Ruta y equipo','Carga','Tarifa','Proveedor','Líneas','Borrador','Vista completa'])
    assert.ok(wizard.includes(label), label)
  assert.match(wizard, /props\.viewOnly \? \[\.\.\.stepTitles, 'Vista completa'\] : stepTitles/)
  assert.match(wizard, /const pricingNavigationSteps = computed/)
})

test('Opening-style header preserves autosave, multiple drafts and discard actions', () => {
  assert.match(wizard, /FolderPlus/)
  assert.match(autosave, /PRICING · COTIZACIONES/)
  assert.match(autosave, /role="progressbar"/)
  assert.match(autosave, /Borrador automático/)
  assert.match(autosave, /pricingDraftStatusLabel/)
  assert.match(autosave, /discardPricingDraft/)
  assert.match(multipleDrafts, /Borradores en espera/)
  assert.match(multipleDrafts, /Nueva cotización/)
  assert.match(multipleDrafts, /discardAndReloadPricingDraft/)
  assert.match(multipleDrafts, /pricingDraftLibraryOpen/)
})

test('Editing reason and responsive transforms tolerate the new shared stepper', () => {
  assert.match(editGuard, /const sharedStepperAnchor/)
  assert.match(editGuard, /editReasonConfirmed/)
  assert.match(editGuard, /edit reason shared stepper gate/)
  assert.match(responsive, /if \(!code\.includes\('<PricingWizardStepper'\)\)/)
})

test('Web and ecosystem version metadata agree while retaining DH-402 release history', () => {
  const pkg = JSON.parse(source('package.json'))
  const lock = JSON.parse(source('package-lock.json'))
  const version = JSON.parse(source('version.json'))
  const release = JSON.parse(source('docs/releases/DH-20261122-PRICING-OPERATIONS-STEPPER-402.json'))
  const changelog = source('CHANGELOG.md')
  assert.equal(release.ecosystemVersion, '1.112.1')
  assert.ok(pkg.version.localeCompare(release.ecosystemVersion, undefined, {numeric:true}) >= 0, 'Current release must never regress DH-402')
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.equal(version.version, pkg.version)
  assert.equal(version.ecosystemVersion, pkg.version)
  assert.equal(version.releaseId, 'DH-20261122-OPERATIONS-UX-403')
  assert.match(changelog, /## \[1\.112\.1\]/)
  assert.match(changelog, new RegExp('## \\[' + pkg.version.replaceAll('.', '\\.') + '\\]'))
})
