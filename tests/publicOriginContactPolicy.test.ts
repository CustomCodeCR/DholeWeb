import test from 'node:test'
import assert from 'node:assert/strict'
import { isPublicColoaderOrigin } from '../src/modules/pricing/utils/publicOriginContactPolicy.ts'

test('legacy LCL QR with an external coloader does not require an office', () => {
  assert.equal(isPublicColoaderOrigin({
    pol: 'Shanghai, China', shipmentMode: 'Lcl', agentCode: 'PIER17',
  }), true)
})

test('own LCL/GCF is not mistaken for a coloader', () => {
  assert.equal(isPublicColoaderOrigin({ shipmentMode: 'Lcl', agentCode: 'GCF' }), false)
  assert.equal(isPublicColoaderOrigin({ shipmentMode: 'Lcl', agent: 'Grupo Castro Fallas' }), false)
})

test('FCL external agents keep the existing office resolution', () => {
  assert.equal(isPublicColoaderOrigin({ shipmentMode: 'Fcl', agentCode: 'WWL' }), false)
})

test('explicit source selection wins over legacy inference', () => {
  assert.equal(isPublicColoaderOrigin({ shipmentMode: 'Lcl', sourceKind: 'Own', agentCode: 'PIER17' }), false)
  assert.equal(isPublicColoaderOrigin({ shipmentMode: 'Ltl', sourceKind: 'Coloader' }), true)
})

test('no agent or source does not infer coloader', () => {
  assert.equal(isPublicColoaderOrigin({ shipmentMode: 'Lcl' }), false)
})
