import assert from 'node:assert/strict'
import test from 'node:test'
import { currentSellerWorkflowStatus, unpublishedSellerWorkflowLabel } from '../src/modules/pricing/utils/sellerRateWorkflowStatus.ts'

const quo269 = {
  status: 'Sent' as const, // Last published snapshot
  currentRateStatus: 'Open' as const, // Actual Pricing rate header
  revisionPending: true,
}

test('QUO-00000-000269: completed Pricing work + actual Open rate displays Abierta', () => {
  assert.equal(currentSellerWorkflowStatus(quo269), 'Open')
  assert.equal(unpublishedSellerWorkflowLabel(quo269, false), 'Abierta')
})

test('an open modification request retains active Pricing label and protects draft', () => {
  assert.equal(unpublishedSellerWorkflowLabel(quo269, true), 'En modificación por Pricing')
  assert.equal(currentSellerWorkflowStatus(quo269), 'Open')
})

test('margin/approval statuses use the live workflow state without releasing draft values', () => {
  assert.equal(unpublishedSellerWorkflowLabel({ ...quo269, currentRateStatus: 'PendingApproval' }, false), 'Pendiente de aprobación')
  assert.equal(unpublishedSellerWorkflowLabel({ ...quo269, currentRateStatus: 'ApprovedByManagement' }, false), 'Aprobada por gerencia')
  assert.equal(unpublishedSellerWorkflowLabel({ ...quo269, currentRateStatus: 'RejectedByManagement' }, false), 'Rechazada por gerencia')
})

test('older APIs preserve the conservative unpublished warning until the status is available', () => {
  assert.equal(currentSellerWorkflowStatus({ status: 'Sent', revisionPending: true }), 'Sent')
  assert.equal(unpublishedSellerWorkflowLabel({ status: 'Sent', revisionPending: true }, false), 'Última revisión enviada · Actualización pendiente')
})

test('published commercial decisions retain their unchanged status', () => {
  const accepted = { status: 'AcceptedByClient' as const, revisionPending: false, currentRateStatus: 'AcceptedByClient' as const }
  assert.equal(currentSellerWorkflowStatus(accepted), 'AcceptedByClient')
  assert.equal(unpublishedSellerWorkflowLabel(accepted, false), null)
})
