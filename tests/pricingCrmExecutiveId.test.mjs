import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const contracts = readFileSync(new URL('../src/core/interfaces/pricing.ts', import.meta.url), 'utf8')
const identity = readFileSync(new URL('../build/pricingCommercialIdentityFields.ts', import.meta.url), 'utf8')

test('Crear y editar tarifas envían el ejecutivo real de CRM junto al nombre', () => {
  const payloads = [...wizard.matchAll(/executiveName:\s*form\.executiveName\.trim\(\) \|\| null,\s*\n\s*executiveUserId:\s*form\.executiveId \|\| null,/g)]
  assert.equal(payloads.length, 2, 'Ambos payloads deben enviar executiveUserId')
  assert.match(wizard, /form\.executiveId = client\?\.executiveUserId \|\| ''/)
  assert.match(wizard, /form\.executiveName = client\?\.executiveName \|\| ''/)
  assert.match(wizard, /<PricingCrmClientSelect\b/)
})

test('El contrato create/update publica executiveUserId sin romper consumidores anteriores', () => {
  const create = contracts.slice(contracts.indexOf('export interface CreateRateRequest'), contracts.indexOf('export interface UpsertRateExtraDetailRequest'))
  assert.match(create, /executiveUserId\?: string \| null/)
  assert.match(contracts, /export interface UpdateRateRequest extends Omit<\s*CreateRateRequest,/)
})

test('No se envía una cuenta CRM cuyo ejecutivo no tiene identidad Auth; Castro Fallas sigue permitido', () => {
  assert.match(identity, /form\.executiveName\.trim\(\)\.toLowerCase\(\) !== 'castro fallas' && !form\.executiveId/)
  assert.match(identity, /Asigne un vendedor en CRM/)
})
