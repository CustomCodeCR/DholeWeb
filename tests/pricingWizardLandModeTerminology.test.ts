import assert from 'node:assert/strict'
import test from 'node:test'
import { patchPricingWizardLandModeTerminology } from '../build/pricingWizardLandModeTerminology.ts'

const handoff = ["          <div v-if=\"rateRequestId\" class=\"crystal-soft space-y-4 border border-[rgb(var(--dh-primary-rgb)/0.28)] p-4 md:p-5\">","            <p>Datos definidos por Ventas</p>","            <p>Pricing recibe POE y POD exactamente como los definió Ventas, además del contenedor, Incoterm, fecha de carga lista y la indicación de Anticipado/Redestino antes de seleccionar la tarifa.</p>","            <div class=\"grid gap-3 sm:grid-cols-2 xl:grid-cols-6\">","              <div class=\"rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3\">","                <span>Contenedor</span>","                <strong>{{ shipmentModeForApi === 'Lcl' ? 'LCL' : displayValue(selectedEquipment) || form.equipmentType || 'Por definir' }}</strong>","              </div>","              <div class=\"rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3\">","                <span>POE</span>","                <strong>{{ requestedPoeName || displayValue(selectedDestination) || 'No indicado' }}</strong>","              </div>","              <div class=\"rounded-xl border border-[rgb(var(--dh-primary-rgb)/0.32)] bg-[rgb(var(--dh-primary-rgb)/0.06)] p-3\">","                <span>POD</span>","              </div>","              <div class=\"rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3\">","                <span>Muellaje</span>","              </div>","            </div>","          </div>"].join('\n')
const wizard = ["<div v-else-if=\"step === 3\">"," <PricingLocationSearchSelect","                label=\"Origen (POL)\"","                placeholder=\"Buscar puerto de origen\""," />"," <PricingLocationSearchSelect","                label=\"Destino (POE)\"","                placeholder=\"Buscar puerto de salida\""," />"," <PricingLocationSearchSelect","                v-model=\"form.podId\"","                label=\"POD\""," />","</div>","<div v-else-if=\"step === 4\"></div>","<p>{{ form.modality === 'Air' ? 'Aéreo' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.' }}</p>"].join('\n') + '\n' + handoff

test('LTL request shows land consolidation instead of a maritime container', () => {
  const output = patchPricingWizardLandModeTerminology(wizard)
  assert.match(output, /Modalidad terrestre/)
  assert.match(output, /LTL · carga consolidada/)
  assert.match(output, /Ruta terrestre/)
  assert.match(output, /Origen no indicado/)
  assert.match(output, /Destino no indicado/)
})

test('land hides port-only fields but retains maritime labels and values', () => {
  const output = patchPricingWizardLandModeTerminology(wizard)
  assert.match(output, /v-if="form\.modality !== 'Land'"/)
  assert.match(output, /v-if="form\.modality !== 'Land' && shipmentModeForApi === 'Fcl'"/)
  assert.match(output, /'POE'/)
  assert.match(output, /'Contenedor'/)
  assert.match(output, /Anticipado\/Redestino/)
})

test('route fields adapt to land while maritime mode stays unchanged', () => {
  const output = patchPricingWizardLandModeTerminology(wizard)
  assert.match(output, /Equipo terrestre/)
  assert.match(output, /Origen terrestre/)
  assert.match(output, /Destino terrestre/)
  assert.match(output, /Origen \(POL\)/)
  assert.match(output, /Destino \(POE\)/)
  assert.match(output, /La búsqueda terrestre utiliza origen, destino, equipo y fecha de carga lista/)
})

test('missing seller handoff fails instead of silently leaving maritime labels', () => {
  assert.throws(
    () => patchPricingWizardLandModeTerminology('<div v-else-if="step === 3"></div><div v-else-if="step === 4"></div>'),
    /Missing seller handoff/,
  )
})
