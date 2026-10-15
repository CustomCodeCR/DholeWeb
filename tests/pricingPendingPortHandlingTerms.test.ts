import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

const patchSource = readFileSync(
  new URL('../build/pricingCommercialAutomation20260906Fixed.ts', import.meta.url),
  'utf8',
)

function pendingPortHandling(overrides: {
  shipmentMode?: string
  modality?: string
  direction?: string
  rateRequestId?: string | null
  sellerSelection?: string
  formSelection?: string
  destination?: string
} = {}) {
  const helper = patchSource.match(/const portHandlingHelper = `([\s\S]*?)`\s*code = replaceOne/)
  assert.ok(helper, 'the wizard patch must supply the port-handling helper')

  const source = helper[1]
    .replace('subjectTo: string[]', 'subjectTo')
    .replace('term: string', 'term')
  const context = {
    shipmentModeForApi: { value: overrides.shipmentMode ?? 'Fcl' },
    form: {
      modality: overrides.modality ?? 'Maritime',
      portHandlingMode: overrides.formSelection ?? '',
    },
    direction: { value: overrides.direction ?? 'Importación' },
    props: { rateRequestId: overrides.rateRequestId ?? null },
    requestedPortHandlingMode: { value: overrides.sellerSelection ?? '' },
    normalizeCatalogValue(value: string) {
      return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ').trim()
    },
    selectedOrigin: { value: { value: 'Shanghai' } },
    selectedDestination: { value: { value: overrides.destination ?? 'Caldera' } },
    resolvePodForDestination: () => null,
    displayValue: (item: { value?: string } | null) => item?.value ?? '',
  }

  // Evaluate the JavaScript emitted by the Vite patch, not a reimplemented rule.
  const execute = runInNewContext(`(${source})`, context, { timeout: 1000 }) as (terms: string[]) => string[]
  return (terms: string[]) => Array.from(execute(terms))
}

test('screen 8: an unspecified Caldera FCL import preserves terms and adds the pending maneuver', () => {
  const subjectTo = pendingPortHandling()(['Inspecciones', 'Marchamo USD 100 + IVA'])
  assert.deepEqual(subjectTo, [
    'Inspecciones',
    'Marchamo USD 100 + IVA',
    'Anticipado USD 150 + IVA o Redestino USD 65 + IVA',
  ])
})

test('screen 8: Moín uses the agreed Anticipado amount', () => {
  const terms = pendingPortHandling({ destination: 'Moín' })(['Muellaje'])
  assert.ok(terms.includes('Anticipado USD 125 + IVA o Redestino USD 65 + IVA'))
})

test('screen 8: does not duplicate an existing conditional term', () => {
  const input = ['Muellaje', 'Anticipado USD 150 + IVA o Redestino USD 65 + IVA']
  assert.deepEqual(pendingPortHandling()(input), input)
})

test('screen 8: an explicit choice from Sales removes the pending alternative', () => {
  const terms = pendingPortHandling({ rateRequestId: 'request-1', sellerSelection: 'Anticipado' })([
    'Inspecciones',
    'Anticipado USD 150 + IVA o Redestino USD 65 + IVA',
  ])
  assert.deepEqual(terms, ['Inspecciones'])
})

test('screen 8: a resumed request without a Sales choice still shows the pending option', () => {
  const terms = pendingPortHandling({ rateRequestId: 'request-2' })(['Inspecciones'])
  assert.equal(terms.length, 2)
  assert.match(terms[1], /Anticipado USD 150.*Redestino USD 65/)
})

test('screen 8: Pricing selection takes effect when Sales did not select a maneuver', () => {
  const terms = pendingPortHandling({ rateRequestId: 'request-3', formSelection: 'Redestino' })([
    'Inspecciones',
    'Anticipado USD 150 + IVA o Redestino USD 65 + IVA',
  ])
  assert.deepEqual(terms, ['Inspecciones'])
})

test('screen 8: LCL, land and export terms are unaffected', () => {
  const terms = ['Inspecciones', 'Muellaje']
  assert.deepEqual(pendingPortHandling({ shipmentMode: 'Lcl' })(terms), terms)
  assert.deepEqual(pendingPortHandling({ modality: 'Land' })(terms), terms)
  assert.deepEqual(pendingPortHandling({ direction: 'Exportación' })(terms), terms)
})

test('the patch updates both screen-8 rendering and rate persistence', () => {
  assert.doesNotMatch(patchSource, /rateRequestId\.value/)
  assert.match(patchSource, /props\.rateRequestId/)
  assert.match(patchSource, /reconcilePendingPortHandling\(linkedSubjectTo\)/)
  assert.match(patchSource, /reconcilePendingPortHandling\(subjectTerms\)/)
})
