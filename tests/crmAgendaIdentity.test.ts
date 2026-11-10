import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crmAgendaClientName, crmAgendaExecutiveName, crmAgendaIdentityIds, crmAgendaOwnerId }
  from '../src/modules/crm/model/crmAgendaIdentity.ts'

const labels = {
  accounts: { a1: 'CLIENTE UNO' },
  leads: { l1: 'PROSPECTO UNO' },
  owners: { u1: 'Ejecutiva Uno', u2: 'Ejecutivo Dos' },
}
test('agenda shows linked account or prospect and fallback on historical records', () => {
  assert.equal(crmAgendaClientName({ accountId: 'a1' }, labels), 'CLIENTE UNO')
  assert.equal(crmAgendaClientName({ leadId: 'l1' }, labels), 'PROSPECTO UNO')
  assert.equal(crmAgendaClientName({ accountId: 'a1', leadId: 'l1' }, labels), 'CLIENTE UNO')
  assert.equal(crmAgendaClientName({}, labels), 'Sin cliente vinculado')
  assert.equal(crmAgendaClientName({ accountId: 'absent' }, labels), 'Cliente no disponible')
})
test('followups use assignedUserId; activities use ownerUserId', () => {
  const followup = { _crmResource: 'followups', assignedUserId: 'u1', ownerUserId: 'u2' }
  const activity = { _crmResource: 'activities', assignedUserId: 'u1', ownerUserId: 'u2' }
  assert.equal(crmAgendaOwnerId(followup), 'u1')
  assert.equal(crmAgendaExecutiveName(followup, labels), 'Ejecutiva Uno')
  assert.equal(crmAgendaExecutiveName(activity, labels), 'Ejecutivo Dos')
  assert.equal(crmAgendaExecutiveName({ _crmResource: 'followups' }, labels), 'Sin asignar')
})
test('agenda identities are deduplicated before requesting authorized labels', () => {
  assert.deepEqual(crmAgendaIdentityIds([
    { _crmResource: 'activities', accountId: 'a1', ownerUserId: 'u2' },
    { _crmResource: 'followups', accountId: 'a1', assignedUserId: 'u1' },
    { _crmResource: 'activities', leadId: 'l1', ownerUserId: 'u2' },
  ]), { accounts: ['a1'], leads: ['l1'], owners: ['u2', 'u1'] })
})
