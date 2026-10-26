import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const wizards = [
  'src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
  'src/modules/pricing/components/PricingRateExistingWizardStable.vue',
]

for (const file of wizards) {
  test(file + ' displays CSV IDTRA and Dhole-only references on screen 8', () => {
    const source = readFileSync(file, 'utf8')
    assert.match(source, /label="Números IDTRA \(separados por comas, opcional\)"/)
    assert.match(source, /label="Otras referencias \(opcional\)"/)
    assert.match(source, /v-model="form\.otherReferences"/)
    assert.match(source, /wizardIdtraIdentifiers/)
    assert.match(source, /:error="wizardIdtraError \|\| undefined"/)
    assert.match(source, /:error="wizardOtherReferencesError \|\| undefined"/)
    assert.match(source, /Otras referencias se guardan únicamente en Dhole/)
  })

  test(file + ' sends both fields on create and edit and restores internal references', () => {
    const source = readFileSync(file, 'utf8')
    assert.equal((source.match(/idtraNumber: wizardNormalizedIdtra\.value \|\| null/g) || []).length, 2)
    assert.equal((source.match(/otherReferences: form\.otherReferences\.trim\(\)/g) || []).length, 2)
    assert.match(source, /form\.otherReferences = rate\.otherReferences \?\? ''/)
    assert.match(source, /function validateWizardReferences\(\)/)
    assert.match(source, /if \(!validateWizardReferences\(\)\) return/)
  })
}
