import { test } from 'node:test'
import assert from 'node:assert/strict'
import { benefitUsesPod, isCompatibleBenefitLocation, routeTerminalType, terminalForBenefitMode } from '../src/modules/crm/utils/crmBenefitRouteCatalog.ts'

const location = (terminalType?: string, code = 'LOC-01') => ({
  code, metadataJson: terminalType ? JSON.stringify({ terminalType }) : null,
})

test('CRM benefit POL/POE/POD follow Pricing terminal types across modalities', () => {
  for (const mode of ['FCL', 'LCL'] as const) {
    assert.equal(terminalForBenefitMode(mode), 'CY')
    assert.equal(benefitUsesPod(mode), true)
    assert.ok(isCompatibleBenefitLocation(location('CY'), mode, 'pol'))
    assert.ok(isCompatibleBenefitLocation(location('CY'), mode, 'poe'))
    assert.ok(isCompatibleBenefitLocation(location('SD'), mode, 'pod'))
    assert.ok(!isCompatibleBenefitLocation(location('APT'), mode, 'pol'))
    assert.ok(!isCompatibleBenefitLocation(location('CY'), mode, 'pod'))
  }
  for (const mode of ['FTL', 'LTL'] as const) {
    assert.ok(isCompatibleBenefitLocation(location('SD'), mode, 'pol'))
    assert.ok(isCompatibleBenefitLocation(location('SD'), mode, 'poe'))
    assert.ok(!isCompatibleBenefitLocation(location('CY'), mode, 'poe'))
    assert.equal(benefitUsesPod(mode), false)
    assert.ok(!isCompatibleBenefitLocation(location('SD'), mode, 'pod'))
  }
  assert.equal(terminalForBenefitMode('AIR'), 'APT')
  assert.ok(isCompatibleBenefitLocation(location('APT'), 'AIR', 'pol'))
  assert.ok(isCompatibleBenefitLocation(location('APT'), 'AIR', 'poe'))
  assert.ok(!isCompatibleBenefitLocation(location('CY'), 'AIR', 'pol'))
  assert.ok(!isCompatibleBenefitLocation(location('APT'), 'AIR', 'pod'))
})
test('Legacy metadata and code markers follow the same fallback as Pricing', () => {
  assert.equal(routeTerminalType(location(undefined, 'SD_SAN_JOSE'), 'CY'), 'SD')
  assert.equal(routeTerminalType(location(undefined, 'SJ_APT'), 'CY'), 'APT')
  assert.equal(routeTerminalType(location(undefined, 'CY_MOIN'), 'SD'), 'CY')
  assert.equal(routeTerminalType(location(), 'CY'), 'CY')
  assert.equal(routeTerminalType(location(), 'SD'), 'SD')
  assert.ok(isCompatibleBenefitLocation(location(), 'FCL', 'pol'))
  assert.ok(!isCompatibleBenefitLocation(location(), 'FTL', 'pol'))
  assert.ok(isCompatibleBenefitLocation(location(), 'LCL', 'pod'))
})
