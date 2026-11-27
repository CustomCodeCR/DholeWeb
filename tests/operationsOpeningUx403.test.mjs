import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const view = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')
const picker = readFileSync(new URL('../src/modules/pricing/components/PricingCrmClientSelect.vue', import.meta.url), 'utf8')

test('manual opening has exactly three steps without standalone transport or services pages', () => {
  assert.match(view, /label: 'Cliente y ruta'/)
  assert.match(view, /label: 'Carga y servicios'/)
  assert.match(view, /label: 'Revisión'/)
  assert.doesNotMatch(view, /v-show="activeStep === [456]"/)
  assert.doesNotMatch(view, /label: 'Puntos de complejidad'/)
  assert.doesNotMatch(view, /Solicitar revisión comercial en Pricing/)
  assert.doesNotMatch(view, /Identificador del trámite/)
})

test('client selector and executive are reused from Pricing and routes derive countries', () => {
  assert.match(view, /import PricingCrmClientSelect from/)
  assert.match(view, /<PricingCrmClientSelect/)
  assert.match(view, /@selected="onCrmClientSelected"/)
  assert.match(picker, /emit\('selected',client\)/)
  assert.match(view, /countryFromRoute/)
  assert.doesNotMatch(view, /label="País de origen \(ISO\)"/)
  assert.doesNotMatch(view, /label="País destino \(ISO\)"/)
})

test('cargo uses the Pricing CABYS endpoint and exclusive destination handling', () => {
  assert.match(view, /api\/pricing\/cabys/)
  assert.match(view, /CABYS seleccionado/)
  assert.match(view, /toggleHandling\('Redestino'\)/)
  assert.match(view, /toggleHandling\('Anticipado'\)/)
  assert.match(view, /form\.isImo = conditionValue\(\$event\)/)
  assert.match(view, /form\.stackable = conditionValue\(\$event\)/)
  assert.match(view, /form\.overweight = conditionValue\(\$event\)/)
})

test('attachments are saved in Storage and referenced by openingData for drafts', () => {
  assert.match(view, /StorageService\.uploadFile/)
  assert.match(view, /OperationsOpeningSupport/)
  assert.match(view, /supportDocuments: \[\] as Array/)
  assert.match(view, /supportEntityId:/)
  assert.match(view, /operationsApi\.createAperture/)
  assert.match(view, /operationsApi\.updateCase/)
  assert.match(view, /completionStatus: blockers\.value/)
  assert.match(view, /Crear y enviar a Coordinación Origen/)
})
