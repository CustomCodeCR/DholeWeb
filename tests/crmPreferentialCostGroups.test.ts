import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { CostSelectDto } from '../src/core/interfaces/pricing'
import {
 groupPreferentialCosts, preferentialCostOwners, preferentialCostZone, preferentialCostBasis,
} from '../src/modules/crm/utils/crmPreferentialCostGroups'
import { sellerRateCurrencyValue } from '../src/modules/pricing/utils/sellerRateCurrency'

const cost = (id: string, opts: Partial<CostSelectDto> = {}): CostSelectDto => ({
 id, name: 'Manejos', costDetailType: 'AgentCharge', costType: 'Fixed',
 currencyId: 'usd', currencyName: 'Dólares', currencyCode: 'CUR-2026-001',
 costAmount: 25, saleAmount: 40, utilityAmount: 15, isAccountant: false,
 isActive: true, incoterms: [], chargeBasis: 'PerContainer', ...opts,
})

test('group by origin, destination, transit and unclassified without treating POL applicability as location', () => {
 const rows = [
  cost('a', {name:'Manejos origen',agentName:'Agente A'}),
  cost('b', {costDetailType:'DestinationCharge',carrierName:'Naviera B'}),
  cost('c', {costDetailType:'Freight',carrierName:'Naviera B'}),
  cost('d', {name:'Release',polCode:'CNSHA'}),
  cost('e', {portRole:'Pol'}),
 ]
 assert.deepEqual(groupPreferentialCosts(rows).map(s=>[s.key,s.count]), [
  ['origin',2],['destination',1],['transit',1],['other',1],
 ])
 assert.equal(preferentialCostZone(cost('x',{name:'Release',polCode:'CNSHA'})), 'other')
})
test('carrier and agent owners are both displayed, while duplicate names stay distinct rows', () => {
 const costs = [
  cost('1',{costDetailType:'OriginCharge',agentName:'Agente A',carriers:[{id:'1',name:'Naviera B',code:'b'}]}),
  cost('2',{costDetailType:'OriginCharge',agentName:'Agente C'}),
  cost('3',{costDetailType:'OriginCharge',agentName:'Agente C'}),
 ]
 const section = groupPreferentialCosts(costs)[0]
 assert.equal(section?.count,3)
 assert.equal(section?.providers.length,2)
 assert.deepEqual(preferentialCostOwners(costs[0]!).carrierNames,['Naviera B'])
 assert.equal(section?.providers.find(p=>p.label.includes('Agente C'))?.costs.length,2)
})
test('currency Value, not generated catalog code, is used for display and saving', () => {
 const currencies=[{id:'usd',code:'CUR-2026-001',value:'USD',label:'Dólares'}]
 assert.equal(sellerRateCurrencyValue(cost('a'),currencies),'USD')
 assert.equal(sellerRateCurrencyValue(cost('b',{currencyId:'missing',currencyCode:'CUR-2026-999',currencyName:''}),currencies),null)
 const builder=readFileSync('src/modules/crm/components/CrmPreferentialRouteBuilder.vue','utf8')
 assert.ok(builder.includes('sellerRateCurrencyValue(cost, currencies.value)'))
 assert.ok(builder.includes('currencyCode: currencyFor(cost)'))
 assert.ok(builder.includes('groupPreferentialCosts(filteredCosts.value)'))
 assert.doesNotMatch(builder,/money\(cost\.costAmount,cost\.currencyCode\)/)
})
test('Pricing charge basis is shown with readable names',()=>{
 assert.equal(preferentialCostBasis('PerContainer'),'Por contenedor')
 assert.equal(preferentialCostBasis('PerChargeableCbm'),'Por CBM cobrable')
})
