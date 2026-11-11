import assert from 'node:assert/strict'
import { test } from 'node:test'
import { supplierSaveIssue, srmMutationFailure } from '../src/modules/srm/utils/srmSupplierSave.ts'
const contact = { name: 'Operaciones', email: 'contacto@ejemplo.com', phone: '+50688887777', role: 'Encargado', countryId: 'country-1' }
const credit = {
  contacts: [contact], creditEnabled: true, creditDays: '120', creditLimit: '1200000',
  creditCurrency: 'USD', monthlyFinancing: '0', lateInterest: '0',
  creditIncluded: ['international-freight'], creditExcluded: ['taxes'], creditReviewAt: '',
}
test('edit/create with valid contact and active credit can reach POST or PUT', () => {
  assert.equal(supplierSaveIssue(credit), null)
  assert.equal(supplierSaveIssue({ ...credit, creditEnabled: false }), null)
  assert.equal(supplierSaveIssue({ ...credit, contacts: [] }), null)
})
test('contact errors identify the row and do not suppress the button', () => {
  const issue = supplierSaveIssue({ ...credit, contacts: [{ ...contact, name: '' }] })
  assert.equal(issue?.section, 'contacts')
  assert.match(issue?.message ?? '', /contacto #1/)
})
test('credit fields show concrete errors and zero rates are valid', () => {
  assert.equal(supplierSaveIssue(credit), null)
  const issue = supplierSaveIssue({ ...credit, creditDays: '0' })
  assert.equal(issue?.section, 'credit')
  assert.match(issue?.message ?? '', /plazo de crédito/)
  assert.equal(supplierSaveIssue({ ...credit, monthlyFinancing: '0.0001' }), null)
})
test('SRM API distinguishes response success from application-level failure', () => {
  assert.equal(srmMutationFailure({ success: true, data: { id: 'abc' } }), null)
  assert.equal(srmMutationFailure({ success: false, message: 'srm_invalid_contacts' }), 'srm_invalid_contacts')
  assert.equal(srmMutationFailure({ data: { isSuccess: false, errors: ['Invalid credit'] } }), 'Invalid credit')
})
