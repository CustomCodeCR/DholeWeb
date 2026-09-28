import type { Plugin } from 'vite'

const WIZARD_SUFFIXES = [
  '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
  '/src/modules/pricing/existing/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
]
const MARKER = '// dhole-ltl-provider-parity-20260928'

function patchStepSixTemplate(source: string) {
  const startTag = '<div v-else-if="step === 6" class="space-y-6">'
  const endTag = '<div v-else-if="step === 4" class="space-y-6">'
  const start = source.indexOf(startTag)
  const end = source.indexOf(endTag, start + startTag.length)
  if (start < 0 || end < 0) return source

  let block = source.slice(start, end)

  block = block.replace(
    `<p class="crystal-description">{{ form.modality === 'Land' ? 'Para terrestre no se requiere agente ni naviera. La moneda muestra el Value configurado en Config.' : 'Los selects muestran el Value configurado en Config.' }}</p>`,
    `<p class="crystal-description">{{ shipmentModeForApi === 'Ltl' ? 'La tarifa LTL seleccionada en Pantalla 5 se carga automáticamente. LTL no utiliza agente, naviera ni días libres.' : form.modality === 'Land' ? 'Para terrestre no se requiere agente ni naviera. La moneda muestra el Value configurado en Config.' : 'Los selects muestran el Value configurado en Config.' }}</p>`,
  )

  const gridAnchor = '          <div class="crystal-soft grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 md:p-5">'
  if (block.includes(gridAnchor)) {
    block = block.replace(
      gridAnchor,
      `          <div
            v-if="shipmentModeForApi === 'Ltl' && resolvedFtlTariff"
            class="rounded-[22px] border border-[rgb(var(--dh-primary-rgb)/0.22)] bg-[rgb(var(--dh-primary-rgb)/0.05)] p-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">Tarifa LTL seleccionada</p>
                <p class="mt-1 font-black">{{ landLtlCommercialProfile === 'Nvocc' ? 'NVOCC' : 'Cliente' }}</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ resolvedFtlTariff.originName }} → {{ resolvedFtlTariff.destinationName }}
                </p>
              </div>
              <DhBadge variant="success">{{ landLtlBillableCbm(resolvedFtlTariff).toFixed(3) }} CBM cobrable</DhBadge>
            </div>
          </div>

${gridAnchor}`,
    )
  }

  block = block.replace(
    '<DhSelect v-model="form.currencyId" label="Moneda" :options="currencyOptions" />',
    '<DhSelect v-model="form.currencyId" label="Moneda" :options="currencyOptions" :disabled="shipmentModeForApi === \'Ltl\' && Boolean(resolvedFtlTariff)" />',
  )

  block = block.replace(
    '<DhInput v-model.number="form.freightCost" type="number" min="0" step="0.01" label="Flete internacional · costo" />',
    '<DhInput v-model.number="form.freightCost" type="number" min="0" step="0.01" :label="shipmentModeForApi === \'Ltl\' ? \'Flete LTL · costo calculado\' : \'Flete internacional · costo\'" :disabled="shipmentModeForApi === \'Ltl\' && Boolean(resolvedFtlTariff)" />',
  )

  block = block.replace(
    '<DhInput v-model.number="form.freightSale" type="number" min="0" step="0.01" label="Flete internacional · venta" />',
    '<DhInput v-model.number="form.freightSale" type="number" min="0" step="0.01" :label="shipmentModeForApi === \'Ltl\' ? \'Flete LTL · venta calculada\' : \'Flete internacional · venta\'" :disabled="shipmentModeForApi === \'Ltl\' && Boolean(resolvedFtlTariff)" />',
  )

  block = block.replace(
    '<DhInput v-if="shipmentModeForApi !== \'Lcl\'" v-model.number="form.freeDays" type="number" min="0" label="Días libres" :disabled="number(selectedImportRate?.freeDays) > 0" />',
    '<DhInput v-if="shipmentModeForApi !== \'Lcl\' && shipmentModeForApi !== \'Ltl\'" v-model.number="form.freeDays" type="number" min="0" label="Días libres" :disabled="number(selectedImportRate?.freeDays) > 0" />',
  )

  block = block.replace(
    '<div v-else class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-sm font-bold text-[var(--dh-text-muted)]"><span class="block text-[10px] font-black uppercase tracking-[0.12em]">Días libres</span><span class="mt-1 block text-[var(--dh-text)]">No aplica para LCL</span></div>',
    '<div v-else-if="shipmentModeForApi === \'Lcl\'" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-sm font-bold text-[var(--dh-text-muted)]"><span class="block text-[10px] font-black uppercase tracking-[0.12em]">Días libres</span><span class="mt-1 block text-[var(--dh-text)]">No aplica para LCL</span></div>',
  )

  block = block.replace(
    '<DhInput v-model.number="form.transitDays" type="number" min="0" label="Días de tránsito" />',
    '<DhInput v-model.number="form.transitDays" type="number" min="0" label="Días de tránsito" :disabled="shipmentModeForApi === \'Ltl\' && Boolean(resolvedFtlTariff)" />',
  )

  return source.slice(0, start) + block + source.slice(end)
}

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  let code = source

  if (
    code.includes('resolvedFtlTariff')
    && code.includes('applyResolvedLandLtlFreight')
    && code.includes('async function next() {')
  ) {
    code = code.replace(
      'async function next() {',
      `async function next() {
  if (step.value === 5 && shipmentModeForApi.value === 'Ltl' && resolvedFtlTariff.value) {
    applyResolvedLandLtlFreight()
    form.freeDays = 0
    form.agentId = ''
    form.carrierId = ''
    form.transitDays = resolvedFtlTariff.value.transitDays ?? 0
    if (resolvedFtlTariff.value.currencyId) form.currencyId = resolvedFtlTariff.value.currencyId
  }`,
    )
  }

  if (
    code.includes('resolvedFtlTariff')
    && code.includes('applyResolvedLandLtlFreight')
    && code.includes('function previous() {')
  ) {
    code = code.replace(
      'function previous() {',
      `watch(step, (currentStep) => {
  if (currentStep !== 6 || shipmentModeForApi.value !== 'Ltl' || !resolvedFtlTariff.value) return
  applyResolvedLandLtlFreight()
  form.freeDays = 0
  form.agentId = ''
  form.carrierId = ''
  form.transitDays = resolvedFtlTariff.value.transitDays ?? 0
  if (resolvedFtlTariff.value.currencyId) form.currencyId = resolvedFtlTariff.value.currencyId
})

function previous() {`,
    )
  }

  code = code.replaceAll(
    "freeDays: shipmentModeForApi.value === 'Lcl' ? 0 : number(form.freeDays),",
    "freeDays: (shipmentModeForApi.value === 'Lcl' || shipmentModeForApi.value === 'Ltl') ? 0 : number(form.freeDays),",
  )

  code = patchStepSixTemplate(code)

  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd >= 0) {
    code = code.slice(0, scriptEnd) + '\n' + MARKER + '\n' + code.slice(scriptEnd)
  }

  return code
}

export function pricingWizardLtlProviderParity(): Plugin {
  return {
    name: 'dhole-pricing-wizard-ltl-provider-parity',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!WIZARD_SUFFIXES.some((suffix) => normalizedId.endsWith(suffix))) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
