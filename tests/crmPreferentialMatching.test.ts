import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exactPreferentialScope, mostSpecificPreferentialRate,
  matchesPreferentialRule, preferentialSpecificity,
  type PreferentialRule } from '../src/modules/crm/utils/crmPreferentialMatching'

const rate = (id:string, qualifiers:Partial<PreferentialRule>={}):PreferentialRule=>({
  id,modality:'FCL',chargeCode:'Other',customChargeName:'Fumigación',sourceCostId:null,
  rateType:'FIXED_AMOUNT',value:200,isActive:true,...qualifiers,
})
const selection = {modality:'FCL',chargeCode:'Other',customChargeName:'Fumigación',
  polCode:'CNSHA',carrierCode:'ONE',incotermCode:'FOB',serviceCode:'CUSTOMS'}

test('Preferential matching prefers port and naviera above port alone',()=>{
  const general=rate('general',{polCodes:['CNSHA'],value:250})
  const specific=rate('specific',{polCodes:['CNSHA'],carrierCode:'ONE',value:210})
  assert.equal(preferentialSpecificity(specific),2)
  assert.equal(mostSpecificPreferentialRate([general,specific],selection)?.id,'specific')
  assert.equal(mostSpecificPreferentialRate([general,specific],
    {...selection,carrierCode:'MSC'})?.id,'general')
})

test('Unrestricted tariff matches as a fallback but specific service and Incoterm win',()=>{
  const general=rate('general')
  const specific=rate('specific',{serviceCodes:['CUSTOMS'],incotermCode:'FOB'})
  assert.equal(mostSpecificPreferentialRate([general,specific],selection)?.id,'specific')
  assert.equal(mostSpecificPreferentialRate([general,specific],
    {...selection,serviceCode:'WAREHOUSE'})?.id,'general')
  assert.equal(mostSpecificPreferentialRate([general,specific],
    {...selection,serviceCode:undefined,incotermCode:undefined})?.id,'general')
})

test('Future, expired and disabled rates do not override active tariffs',()=>{
  const general=rate('general')
  const future=rate('future',{carrierCode:'ONE',validFrom:'2090-01-01T00:00:00Z'})
  const disabled=rate('disabled',{carrierCode:'ONE',isActive:false})
  assert.equal(mostSpecificPreferentialRate([future,disabled,general],selection,
    new Date('2026-11-19T12:00:00Z'))?.id,'general')
})

test('Exact stored scope differs from the generic fallback and ignores code order',()=>{
  const general=rate('general',{polCodes:['CNSHA']})
  const scope={modality:'FCL',laneCode:null,carrierCode:'ONE',incotermCode:'',
    equipmentCodes:[],polCodes:['CNSHA'],poeCodes:[],podCodes:[],serviceCodes:['CUSTOMS']}
  assert.equal(exactPreferentialScope(general,scope),false)
  const specific=rate('specific',{polCodes:['CNSHA'],carrierCode:'ONE',serviceCodes:['CUSTOMS']})
  assert.equal(exactPreferentialScope(specific,scope),true)
  assert.equal(matchesPreferentialRule(specific,{...selection,polCode:'CNNGB'}),false)
})
