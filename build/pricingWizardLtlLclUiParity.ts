import type { Plugin } from 'vite'

const WIZARD_SUFFIXES = [
  '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
  '/src/modules/pricing/existing/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
]
const MARKER = '// dhole-ltl-lcl-ui-parity-20261005'

function patchStepFiveHeader(code: string) {
  const stepTag = '<div v-else-if="step === 5" class="space-y-6">'
  const stepIndex = code.indexOf(stepTag)
  if (stepIndex < 0) return code

  const titleStart = code.indexOf('<h2 class="crystal-title">', stepIndex)
  const titleEnd = titleStart >= 0 ? code.indexOf('</h2>', titleStart) : -1
  if (titleStart >= 0 && titleEnd >= 0) {
    code = code.slice(0, titleStart)
      + `<h2 class="crystal-title">{{ shipmentModeForApi === 'Ltl' ? 'Seleccione la fuente tarifaria LTL' : form.modality === 'Air' ? 'Seleccione la tarifa aérea' : shipmentModeForApi === 'Lcl' ? 'Seleccione la fuente tarifaria LCL' : form.modality === 'Land' && shipmentModeForApi === 'Ftl' ? 'Tarifa terrestre disponible' : 'Tarifas pre-aprobadas disponibles' }}</h2>`
      + code.slice(titleEnd + 5)
  }

  const descStart = code.indexOf('<p class="crystal-description">', stepIndex)
  const descEnd = descStart >= 0 ? code.indexOf('</p>', descStart) : -1
  if (descStart >= 0 && descEnd >= 0) {
    code = code.slice(0, descStart)
      + `<p class="crystal-description">{{ shipmentModeForApi === 'Ltl' ? 'Los tarifarios Cliente y NVOCC administrados en Tarifas terrestres son propios. Coloaders muestra únicamente LTL provenientes de Revisar importaciones.' : form.modality === 'Air' ? 'Solo se muestran fuentes tarifarias aéreas para la ruta APT-APT seleccionada.' : shipmentModeForApi === 'Lcl' ? 'Compare consolidados propios y tarifarios de coloader. Al seleccionar una fuente, sus líneas reales pasan a Pantalla 7.' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.' }}</p>`
      + code.slice(descEnd + 4)
  }

  return code
}

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  let code = source

  const importAnchor = `import { FtlTariffService, type FtlTariffDto, type LandCommercialProfile } from '@/core/services/ftlTariffService'`
  if (code.includes(importAnchor) && !code.includes('PricingLtlRateSourceSelector')) {
    code = code.replace(
      importAnchor,
      importAnchor + "\nimport PricingLtlRateSourceSelector from '@/modules/pricing/components/PricingLtlRateSourceSelector.vue'",
    )
  }

  const functionAnchor = 'function continueWithManualLandLtlTariff() {'
  if (code.includes(functionAnchor) && !code.includes('function selectLandLtlRateSource(')) {
    code = code.replace(
      functionAnchor,
      `function selectLandLtlRateSource(tariff: FtlTariffDto) {
  resolvedFtlTariff.value = tariff
  landLtlCommercialProfile.value = tariff.commercialProfile
  availableRates.value = []
  form.manualRate = false
  form.selectedImportRateId = ''
  applyResolvedLandLtlFreight()
  form.freeDays = 0
  form.agentId = ''
  form.carrierId = ''
  form.transitDays = tariff.transitDays ?? 0
  if (tariff.currencyId) form.currencyId = tariff.currencyId
  continueWithResolvedLandLtlTariff()
}

function importedLandLtlAsTariff(rate: ImportRateSelectDto): FtlTariffDto {
  const currencyCode = String(rate.currencyCode || rate.currency || 'USD')
  return {
    id: 'import:' + rate.id,
    originId: rate.polId || null,
    originName: String(rate.pol || ''),
    originCode: String(rate.polCode || ''),
    destinationId: rate.poeId || null,
    destinationName: String(rate.poe || rate.pod || ''),
    destinationCode: String(rate.poeCode || ''),
    applicableOriginIds: rate.polId ? [rate.polId] : [],
    applicableDestinationIds: rate.poeId ? [rate.poeId] : [],
    equipmentClass: 'LTL_CBM',
    equipmentLabel: 'LTL · CBM',
    currencyId: String(rate.currencyId || ''),
    currencyName: String(rate.currency || currencyCode),
    currencyCode,
    priceAmount: number(rate.totalSale ?? rate.freight),
    transitDays: rate.transitDays == null ? null : number(rate.transitDays),
    source: String(rate.agent || rate.agentCode || rate.carrier || rate.carrierCode || 'Revisar importaciones'),
    notes: String(rate.spaceComment || ''),
    isActive: true,
    shipmentMode: 'Ltl',
    rateBasis: 'PerCbm',
    minimumAmount: 0,
    warehouseName: 'Revisar importaciones',
    validFrom: String(rate.validFrom || ''),
    validTo: String(rate.validTo || ''),
    commercialProfile: 'Nvocc',
    applicableEquipmentClasses: ['LTL_CBM'],
    costPerCbm: number(rate.totalCost ?? rate.freight),
    weightKgPerCbm: 330,
    duaCost: null,
    ducaTCost: null,
    stuffingCostPerCbm: null,
    stuffingSalePerCbm: null,
    panamaCostSurchargePerCbm: 0,
    ltlChargeItems: [],
  }
}

function selectImportedLandLtlSource(rate: ImportRateSelectDto) {
  availableRates.value = [rate]
  form.selectedImportRateId = rate.id
  resolvedFtlTariff.value = importedLandLtlAsTariff(rate)
  landLtlCommercialProfile.value = 'Nvocc'
  form.manualRate = false
  applyResolvedLandLtlFreight()
  form.freeDays = 0
  form.agentId = ''
  form.carrierId = ''
  form.transitDays = rate.transitDays == null ? 0 : number(rate.transitDays)
  if (rate.currencyId) form.currencyId = rate.currencyId
  continueWithResolvedLandLtlTariff()
}

function startManualLandLtlOwnTariff() {
  landLtlCommercialProfile.value = 'FinalClient'
  continueWithManualLandLtlTariff()
}

${functionAnchor}`,
    )
  }

  const startTag = `          <template v-else-if="form.modality === 'Land' && (shipmentModeForApi === 'Ltl' || (shipmentModeForApi === 'Ftl' && resolvedFtlTariff))">`
  const endTag = `          <template v-else-if="availableRates.length">`
  const start = code.indexOf(startTag)
  const end = start >= 0 ? code.indexOf(endTag, start + startTag.length) : -1

  if (start >= 0 && end >= 0) {
    const replacement = `          <template v-else-if="form.modality === 'Land' && (shipmentModeForApi === 'Ltl' || (shipmentModeForApi === 'Ftl' && resolvedFtlTariff))">
            <PricingLtlRateSourceSelector
              v-if="shipmentModeForApi === 'Ltl'"
              :origin-id="form.originId || null"
              :origin-name="selectedOrigin ? displayValue(selectedOrigin) : null"
              :origin-code="selectedOrigin?.code ?? null"
              :destination-id="form.destinationId || null"
              :destination-name="selectedDestination ? displayValue(selectedDestination) : null"
              :destination-code="selectedDestination?.code ?? null"
              :quote-date="form.loadDate || null"
              :requested-cbm="Math.max(number(lclChargeableCbm), number(form.cargoWeightKg) / 330)"
              :selected-master-id="form.selectedImportRateId ? null : resolvedFtlTariff?.id ?? null"
              :selected-import-id="form.selectedImportRateId || null"
              @select-own="(tariff) => { step = 6; selectLandLtlRateSource(tariff) }"
              @select-coloader="(rate) => { step = 6; selectImportedLandLtlSource(rate) }"
              @manual-own="() => { step = 6; startManualLandLtlOwnTariff() }"
            />

            <template v-else>
              <div v-if="resolvedFtlTariff" class="grid gap-4 lg:grid-cols-2">
                <button type="button" class="crystal-rate-card crystal-rate-card--active text-left" @click="form.manualRate = false">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="font-black">Tarifa terrestre {{ shipmentModeForApi.toUpperCase() }}</p>
                      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ resolvedFtlTariff.originName }} → {{ resolvedFtlTariff.destinationName }} · {{ resolvedFtlTariff.equipmentLabel }}</p>
                    </div>
                    <DhBadge variant="success">Tarifario maestro</DhBadge>
                  </div>
                  <p class="mt-5 text-2xl font-black">
                    {{ formatMoney(resolvedFtlTariff.priceAmount, resolvedFtlTariff.currencyCode || resolvedFtlTariff.currencyName || 'USD') }}
                  </p>
                  <div class="mt-4 grid gap-2 sm:grid-cols-2">
                    <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2">
                      <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Tránsito</span>
                      <strong class="mt-1 block text-sm">{{ resolvedFtlTariff.transitDays != null ? resolvedFtlTariff.transitDays + ' días' : 'Por confirmar' }}</strong>
                    </div>
                    <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2">
                      <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Fuente</span>
                      <strong class="mt-1 block text-sm">{{ resolvedFtlTariff.source || 'Pricing terrestre' }}</strong>
                    </div>
                  </div>
                </button>
              </div>
              <div v-if="resolvedFtlTariff" class="flex flex-wrap justify-end gap-2">
                <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>
                <DhButton @click="next">Usar tarifa {{ shipmentModeForApi.toUpperCase() }}</DhButton>
              </div>
            </template>
          </template>

${endTag}`

    code = code.slice(0, start) + replacement + code.slice(end + endTag.length)
  }

  code = patchStepFiveHeader(code)

  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd >= 0) {
    code = code.slice(0, scriptEnd) + '\n' + MARKER + '\n' + code.slice(scriptEnd)
  }

  return code
}

export function pricingWizardLtlLclUiParity(): Plugin {
  return {
    name: 'dhole-pricing-wizard-ltl-lcl-ui-parity',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!WIZARD_SUFFIXES.some((suffix) => normalizedId.endsWith(suffix))) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
