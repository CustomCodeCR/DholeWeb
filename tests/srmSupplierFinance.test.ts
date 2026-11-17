import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { supplierBankSaveIssue } from '../src/modules/srm/utils/srmSupplierSave.ts'
import { IBAN_LENGTH_BY_COUNTRY, srmCountryIbanFormat, srmIbanChecksumValid, srmIbanInput, srmIbanValidForCountry } from '../src/modules/srm/utils/srmIban.ts'

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

test('IBAN lengths and prefixes match the registered bank country', () => {
  const cr = srmCountryIbanFormat({ code: 'CRI', label: 'Costa Rica' })!
  const de = srmCountryIbanFormat({ code: 'DE', label: 'Alemania' })!
  const es = srmCountryIbanFormat({ code: 'ESP', label: 'España' })!
  const ni = srmCountryIbanFormat({ label: 'Nicaragua' })!
  assert.deepEqual(cr, { code: 'CR', length: 22 })
  assert.deepEqual(de, { code: 'DE', length: 22 })
  assert.deepEqual(es, { code: 'ES', length: 24 })
  assert.deepEqual(ni, { code: 'NI', length: 28 })
  assert.equal(IBAN_LENGTH_BY_COUNTRY.NO, 15)
  assert.equal(IBAN_LENGTH_BY_COUNTRY.RU, 33)
  assert.equal(srmCountryIbanFormat({ code: 'US', label: 'United States' }), null)
  assert.equal(srmIbanInput('CR05 0152-0200 1026 2840 66', cr), 'CR05015202001026284066')
  assert.equal(srmIbanInput('CR0501520200102628406699999', cr).length, 22)
  assert.equal(srmIbanInput('', cr), 'CR')
})

test('supplier bank IBAN validates country length, prefix and MOD-97 checksum before saving', () => {
  const cr = srmCountryIbanFormat({ code: 'CR' })!
  const de = srmCountryIbanFormat({ code: 'DE' })!
  const formats = new Map([[bank.bankCountryId, cr]])
  assert.equal(srmIbanChecksumValid(bank.accountNumber), true)
  assert.equal(srmIbanValidForCountry(bank.accountNumber, cr), true)
  assert.equal(srmIbanChecksumValid('DE89370400440532013000'), true)
  assert.equal(srmIbanValidForCountry('DE89370400440532013000', de), true)
  assert.equal(supplierBankSaveIssue([bank], false, formats), null)
  for (const accountNumber of ['123456789', 'DE89370400440532013000',
    'CR0501520200102628406', 'CR05015202001026284067', 'CR050152020010262840669']) {
    const issue = supplierBankSaveIssue([{ ...bank, accountNumber }], false, formats)
    assert.equal(issue?.section, 'bank', accountNumber)
    assert.match(issue?.message || '', /IBAN.*CR.*22/)
  }
})

test('SRM bank form enforces country-specific maximum and preserves non-IBAN countries', () => {
  const view = readFileSync('src/modules/srm/views/SrmWorkspaceView.vue', 'utf8')
  assert.match(view, /:maxlength="bankIbanFormat\(account.bankCountryId\)\?\.length \?\? 44"/)
  assert.match(view, /onBankCountryChange\(account, \$event\)/)
  assert.match(view, /onBankNumberInput\(account, \$event\)/)
  assert.match(view, /supplierBankSaveIssue\(bankAccounts.value, en.value, ibanFormats\)/)
})
