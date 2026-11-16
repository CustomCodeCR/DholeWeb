import test from 'node:test'
import assert from 'node:assert/strict'
import { accountCommercialPreset, leadCommercialPreset } from '../src/modules/integrations/utils/apiManagerCrmPresets.ts'

const owner = 'fb2475ca-e314-4a90-a388-8b1dd689c218'
const account = { id: 'e5e3761e-976a-4e07-b60b-6846d18e2389', displayName: 'CLIENTE WEB',
  executiveUserId: owner, isCastroFallasExecutive: false }
const lead = { id: '795c42b4-99e5-4bd8-87cb-98100329d70e', name: 'JANE',
  companyName: 'PROSPECTO WEB', executiveUserId: owner, isCastroFallasExecutive: false }

test('regular account resolves CRM seller id and executive', () => {
  assert.deepEqual(accountCommercialPreset(account, { displayName: 'Ejecutivo real', institutional: false }),
    { clientName: 'CLIENTE WEB', sellerUserId: owner, executiveName: 'Ejecutivo real' })
})

test('Castro Fallas account retains institutional executive, with real accountable owner', () => {
  const preset = accountCommercialPreset({ ...account, isCastroFallasExecutive: true },
    { displayName: 'Castro Fallas', institutional: true })
  assert.deepEqual(preset, { clientName: 'CLIENTE WEB', sellerUserId: owner, executiveName: 'Castro Fallas' })
  assert.throws(() => accountCommercialPreset({ ...account, isCastroFallasExecutive: true },
    { displayName: 'Otro vendedor', institutional: false }), /institucional/)
})

test('lead can be selected with company name and assigned executive', () => {
  assert.deepEqual(leadCommercialPreset(lead, 'Ejecutivo real'),
    { clientName: 'PROSPECTO WEB', sellerUserId: owner, executiveName: 'Ejecutivo real' })
})

test('Castro Fallas lead keeps house label and accountable owner', () => {
  assert.deepEqual(leadCommercialPreset({ ...lead, isCastroFallasExecutive: true }, 'Castro Fallas'),
    { clientName: 'PROSPECTO WEB', sellerUserId: owner, executiveName: 'Castro Fallas' })
  assert.throws(() => leadCommercialPreset({ ...lead, isCastroFallasExecutive: true }, 'Ejecutivo real'), /institucional/)
})

test('missing actor and unreadable executive fail closed', () => {
  assert.throws(() => leadCommercialPreset({ ...lead, executiveUserId: null }, 'Castro Fallas'), /usuario responsable/)
  assert.throws(() => accountCommercialPreset({ ...account, executiveUserId: null },
    { displayName: 'Ejecutivo real' }), /usuario responsable/)
  assert.throws(() => leadCommercialPreset(lead, 'Vendedor no disponible'), /ejecutivo/)
  assert.throws(() => leadCommercialPreset(lead, 'Sin asignar'), /ejecutivo/)
})

test('converted leads cannot be used as a new prospect default', () => {
  assert.throws(() => leadCommercialPreset({ ...lead, convertedAt: '2026-11-16T10:00:00Z' }, 'Ejecutivo real'), /convertido/)
})
