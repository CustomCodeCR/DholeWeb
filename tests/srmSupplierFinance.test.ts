import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { supplierBankSaveIssue } from '../src/modules/srm/utils/srmSupplierSave.ts'

const bank = {
  id: '00000000-0000-4000-8000-000000000001',
  bankName: 'BANCO DE COSTA RICA',
  accountHolder: 'TRANSPORTES ROMO S.A.',
  registration: 'LOCAL',
  accountNumber: 'CR05015202001026284066',
  swiftBic: '',
  currency: 'CRC',
  bankCountryId: '00000000-0000-4000-8000-000000000002',
  intermediaryBank: '',
  isPrimary: true,
}

test('supplier financial accounts are optional but exactly one payment account is primary', () => {
  assert.equal(supplierBankSaveIssue([]), null)
  assert.equal(supplierBankSaveIssue([bank]), null)
  assert.equal(supplierBankSaveIssue([bank, { ...bank, id: '3', accountNumber: '123456789', isPrimary: false }]), null)
  assert.equal(supplierBankSaveIssue([{ ...bank, isPrimary: false }])?.section, 'bank')
  assert.equal(supplierBankSaveIssue([bank, { ...bank, id: '3', accountNumber: '123456789', isPrimary: true }])?.section, 'bank')
})

test('supplier banking rejects duplicate accounts, incomplete payments and invalid SWIFT', () => {
  assert.equal(supplierBankSaveIssue([bank, { ...bank, id: '3', isPrimary: false }])?.section, 'bank')
  assert.equal(supplierBankSaveIssue([{ ...bank, accountHolder: '' }])?.section, 'bank')
  assert.equal(supplierBankSaveIssue([{ ...bank, registration: 'INTERNACIONAL' }])?.section, 'bank')
  assert.equal(supplierBankSaveIssue([{ ...bank, registration: 'INTERNACIONAL', swiftBic: 'BCRICRSJ' }]), null)
  assert.equal(supplierBankSaveIssue([{ ...bank, swiftBic: 'BAD-BIC' }])?.section, 'bank')
})

test('supplier form stores company identity and finance contact while banks use a separate API', () => {
  const view = readFileSync('src/modules/srm/views/SrmWorkspaceView.vue', 'utf8')
  const api = readFileSync('src/modules/srm/services/srmApi.ts', 'utf8')
  assert.match(view, /companyPhone: companyPhone\.value/)
  assert.match(view, /financeContactId: financeContactId\.value/)
  assert.match(view, /SrmApi\.saveBankAccounts\(saved\.id/)
  assert.match(view, /bankAccountsLoaded\.value/)
  assert.match(view, /costaRicaCountryId/)
  assert.match(view, /applyHaciendaResult/)
  assert.match(api, /bank-accounts/)
  assert.match(api, /hacienda\/lookup/)
  assert.doesNotMatch(view.match(/const metadataJson = JSON\.stringify\(\{[\s\S]*?\}\)/)?.[0] || '', /bankAccounts\s*:/)
})
