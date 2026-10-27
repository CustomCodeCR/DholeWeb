import assert from 'node:assert/strict'
import test from 'node:test'
import { patchPricingWizardHistoricalValidity } from '../build/pricingWizardHistoricalValidity.ts'

const wizard = [
  "async function saveRate() {",
  "  return null",
  "}",
  "async function saveOpenRequest() {",
  "  return null",
  "}",
  "function chooseRate(rate: ImportRateSelectDto) {",
  "  const freightValidFrom = String(rate.validFrom ?? '').slice(0, 10)",
  "  const freightValidTo = String(rate.validTo ?? '').slice(0, 10)",
  "  if (freightValidFrom) form.loadDate = freightValidFrom",
  "  if (freightValidTo) form.validTo = freightValidTo",
  "}",
  "function chooseFclRateBundle(bundle: FclRateBundle) {",
  "  if (bundle.validFrom) form.loadDate = bundle.validFrom",
  "  if (bundle.validTo) form.validTo = bundle.validTo",
  "}",
  "const input = form.rateType === 'Tariff' ? 'Vigente desde' : 'Vigente desde / carga lista'",
  '<DhInput v-model="form.loadDate" type="date" label="Vigente desde / carga lista" />',
  '<DhInput v-model="form.validTo" type="date" label="Vigente hasta" :min="form.loadDate || undefined" />',
  "const payload = { validTo: addDaysIso(form.loadDate, 30) }",
].join('\n')

test('selecting supplier freight or an FCL bundle cannot change the shipment date', () => {
  const output = patchPricingWizardHistoricalValidity(wizard)
  assert.doesNotMatch(output, /if \(freightValidFrom\) form\.loadDate/)
  assert.doesNotMatch(output, /if \(bundle\.validFrom\) form\.loadDate/)
  assert.match(output, /if \(freightValidTo\) form\.validTo/)
})

test('shipment date and historical expiry retain distinct fields and clear labels', () => {
  const output = patchPricingWizardHistoricalValidity(wizard)
  assert.match(output, /Fecha de carga \/ embarque \(inicio de vigencia\)/)
  assert.match(output, /Vencimiento de la cotización/)
  assert.match(output, /Puede registrar vencimientos anteriores a hoy/)
  assert.match(output, /validTo: form\.validTo \|\| addDaysIso\(form\.loadDate, 30\)/)
})

test('only QUO saves validate expiry; Sales requests can omit it and use historical dates', () => {
  const output = patchPricingWizardHistoricalValidity(wizard)
  assert.equal((output.match(/form\.validTo < form\.loadDate/g) || []).length, 1)
  assert.doesNotMatch(output, /validTo < todayIso\(\)|validTo >= todayIso\(\)/)
  assert.match(output, /async function saveRate\(\) \{\n  if \(!form\.loadDate/)
  assert.match(output, /async function saveOpenRequest\(\) \{\n  return null/)
  const salesSave = output.split('async function saveOpenRequest() {')[1]?.split('}')[0] ?? ''
  assert.doesNotMatch(salesSave, /step\.value = 6|form\.validTo/)
})
