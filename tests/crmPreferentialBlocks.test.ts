import assert from 'node:assert/strict'
import { test } from 'node:test'
import { customerAgreementScopeKey, groupCustomerAgreementBlocks }
  from '../src/modules/crm/utils/crmPreferentialGroups'

test('The six persisted preferential items form one commercial block, including legacy manuals', () => {
  const common = {
    modality:'FCL', equipmentCodes:['40HC'], polCodes:['POL-2026-029'],
    poeCodes:['POE-2026-001'],podCodes:['POD-2026-012'],
    carrierCode:'NAV-2026-005',incotermCode:'CIF',
    serviceCodes:['CUSTOMS_CR','RECEPTION'],
  }
  const rules = ['Desconsolidacion','Servicio de agencia','Marchamo Electronico',
    'Documentacion','Cargos en destino Linea Naviera','Anticipado']
    .map((name,i)=>({id:String(i),customChargeName:name,sourceCostId:i===0?null:'cost-'+i,
      ...common,serviceCodes:i%2===0?['RECEPTION','CUSTOMS_CR']:['CUSTOMS_CR','RECEPTION']}))
  const blocks = groupCustomerAgreementBlocks(rules)
  assert.equal(blocks.length,1)
  assert.equal(blocks[0]?.lines.length,6)
  assert.notEqual(customerAgreementScopeKey(rules[0]),customerAgreementScopeKey({...rules[0],incotermCode:'FOB'}))
})
