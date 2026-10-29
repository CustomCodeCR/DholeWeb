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

test('legacy own RS and WWL LCL must keep their actual WHS offices', () => {
  for (const agentCode of ['RS', 'RS Logistics', 'WWL', 'Worldwide Logistics', 'GCF']) {
    assert.equal(isPublicColoaderOrigin({ shipmentMode: 'Lcl', agentCode }), false)
  }
})

test('Costa Rica A257 and A287 are own warehouses, not coloaders', () => {
  assert.equal(isPublicColoaderOrigin({ shipmentMode: 'Lcl', agentCode: 'A257' }), false)
  assert.equal(isPublicColoaderOrigin({ shipmentMode: 'Lcl', agentCode: 'A287' }), false)
})

test('no agent or source does not infer coloader', () => {
  assert.equal(isPublicColoaderOrigin({ shipmentMode: 'Lcl' }), false)
})
