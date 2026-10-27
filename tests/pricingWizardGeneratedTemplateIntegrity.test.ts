import assert from 'node:assert/strict'
import test from 'node:test'
import { closeUnfinishedStepFour } from '../build/pricingWizardGeneratedTemplateIntegrity.ts'

const prefix = [
  '<template>',
  '        <div v-else-if="step === 4" class="space-y-6">',
  '          <div>',
  '            <p>Descripción de carga y CABYS</p>',
  '          </div>',
]
const suffix = [
  '        <div v-else-if="step === 7" class="crystal-lines-stage space-y-6">',
  '          <p>Líneas de tarifa</p>',
  '        </div>',
  '</template>',
]

test('closes exactly one missing step 4 root without altering its content or Step 7', () => {
  const broken = [...prefix, ...suffix].join('\n')
  const fixed = closeUnfinishedStepFour(broken)
  assert.equal(fixed, [...prefix,'        </div>','',...suffix].join('\n').replace(
    '        </div>\n\n        <div v-else-if', '        </div>\n\n        <div v-else-if'))
  assert.equal(closeUnfinishedStepFour(fixed),fixed)
})

test('correctly balanced wizard is unchanged', () => {
  const balanced=[...prefix, '        </div>',...suffix].join('\n')
  assert.equal(closeUnfinishedStepFour(balanced),balanced)
})

test('unexpected unmatched markup fails closed', () => {
  const malformed=[...prefix, '<div>','<div>',...suffix].join('\n')
  assert.throws(()=>closeUnfinishedStepFour(malformed),/Unexpected unbalanced/)
})
