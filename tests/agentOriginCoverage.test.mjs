import assert from 'node:assert/strict'
import test from 'node:test'
import { agentMatchesOrigin } from '../src/modules/catalogs/utils/agentOriginCoverage.ts'
const catalog = (id, label, metadata) => ({id, label, value: label, code: id, metadataJson: JSON.stringify(metadata)})
const china = catalog('CN-SHA','Shanghai, China',{countryCode:'CN',countryName:'China'})
const india = catalog('IN-BOM','Mumbai, India',{countryCode:'IN',countryName:'India'})
test('origin filter covers direct ISO and country-name aliases without cross-country agents', () => {
  assert.equal(agentMatchesOrigin(catalog('A','China Agent',{countries:['China']}),china,[china,india],false),true)
  assert.equal(agentMatchesOrigin(catalog('B','India Agent',{countryCodes:['IN']}),china,[china,india],false),false)
  assert.equal(agentMatchesOrigin(catalog('C','CN Agent',{countryCodes:['CN']}),china,[china,india],false),true)
  assert.equal(agentMatchesOrigin(catalog('D','No coverage',{}),china,[china,india],false),false)
  assert.equal(agentMatchesOrigin(catalog('GCF','Grupo Castro Fallas',{}),china,[china,india],false),true)
})
