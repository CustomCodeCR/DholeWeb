import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardPersistedLclHydration] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  const hydrateAnchor = 'async function hydrateExistingRate() {'
  const helpers = `function extractPersistedLclPickupAddress(value: unknown) {
  const text = String(value ?? '')
  const match = text.match(/(?:Recolecta|Recolecci[oó]n|Pickup)\\s*:\\s*([^\\r\\n·|]+)/i)
  return match?.[1]?.trim() ?? ''
}

function resolvePersistedLclPickupAddress(rate: RateDto) {
  const direct = String(rate.pickupAddress ?? '').trim()
  if (direct) return direct
  if (rate.shipmentMode !== 'Lcl') return ''

  for (const cargo of rate.cargoLines ?? []) {
    const extracted = extractPersistedLclPickupAddress(cargo.description)
    if (extracted) return extracted
  }

  return ''
}

function stripPersistedLclPickupObservation(value: unknown) {
  return String(value ?? '')
    .split(/\\r?\\n/)
    .filter((line) => !/^\\s*(?:Recolecta|Recolecci[oó]n|Pickup)\\s*:/i.test(line))
    .join('\\n')
    .trim()
}

function splitPersistedLclTerms(value: unknown) {
  return String(value ?? '')
    .split(/\\r?\\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function hydratePersistedLclSource(rate: RateDto) {
  if (rate.shipmentMode !== 'Lcl') return

  const notes = rateLines.value.map((line) => String(line.notes ?? '')).join('\\n')
  const ownMatch = notes.match(/ConsolidadoId:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  const coloaderMatch = notes.match(/LCL\\s+COLOADER\\s*·\\s*RateId:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  const kind = ownMatch ? 'Own' : coloaderMatch ? 'Coloader' : null
  const sourceId = ownMatch?.[1] ?? coloaderMatch?.[1] ?? null

  lclRequestedCbm.value = Math.max(1, Number(rate.chargeableQuantity || 0))
  if (!kind || !sourceId) return

  lclSelectedSourceKey.value = \`${kind}:${sourceId}\`
  const billableCbm = lclRequestedCbm.value
  const profitAmount = Number(rate.totalUtilityAmount || 0)

  lclSelectedSource.value = {
    kind,
    id: sourceId,
    label: kind === 'Own'
      ? \`Consolidado propio · ${rate.polName}\`
      : \`${rate.agentName || 'Coloader'} · ${rate.rateCode}\`,
    requestedCbm: billableCbm,
    providerId: kind === 'Own' ? null : rate.agentId ?? null,
    providerName: kind === 'Own' ? (rate.agentName || 'Grupo Castro Fallas') : rate.agentName ?? null,
    providerCode: kind === 'Own' ? (rate.agentCode || 'GCF') : rate.agentCode ?? null,
    carrierId: rate.carrierId ?? null,
    carrierName: rate.carrierName ?? null,
    carrierCode: rate.carrierCode ?? null,
    currencyId: rate.currencyId,
    currencyName: rate.currencyName,
    currencyCode: rate.currencyCode,
    freeDays: Number(rate.freeDays || 0),
    transitDays: transitDaysFrom(rate.transitTime),
    validFrom: rate.validFrom ?? null,
    validTo: rate.validTo ?? null,
    includes: splitPersistedLclTerms(rate.includes),
    subjectTo: splitPersistedLclTerms(rate.subjectTo),
    excludes: splitPersistedLclTerms(rate.excludes),
    lines: rateLines.value.map((line) => ({ ...line })) as LclRateSourceSelection['lines'],
    totalCost: Number(rate.totalCostAmount || 0),
    totalSale: Number(rate.totalSaleAmount || 0),
    profitAmount,
    profitPerCbm: profitAmount / billableCbm,
    profitPercentage: Number(rate.marginPercentage || 0),
    meetsMinimumMargin: !Boolean(rate.requiredApproval),
    matrixVersion: null,
  }
}

`

  code = replaceOne(code, hydrateAnchor, helpers + hydrateAnchor, 'LCL hydration helper insertion')

  code = replaceOne(
    code,
    `    form.pickupAddress = rate.pickupAddress ?? ''`,
    `    form.pickupAddress = resolvePersistedLclPickupAddress(rate)`,
    'persisted LCL pickup address',
  )

  code = replaceOne(
    code,
    `    hydratePersistedCargoDescription(rate.cargoLines?.[0]?.description)`,
    `    hydratePersistedCargoDescription(rate.cargoLines?.[0]?.description)
    if (rate.shipmentMode === 'Lcl' && form.pickupAddress) {
      form.cargoObservations = stripPersistedLclPickupObservation(form.cargoObservations)
    }`,
    'legacy pickup observation cleanup',
  )

  code = replaceOne(
    code,
    `    mergeConfiguredOptionalCostsIntoRateLines()
    step.value = props.viewOnly ? 9 : 8`,
    `    hydratePersistedLclSource(rate)
    mergeConfiguredOptionalCostsIntoRateLines()
    step.value = props.viewOnly ? 9 : 8`,
    'persisted LCL source hydration',
  )

  return code
}

export function pricingWizardPersistedLclHydration(): Plugin {
  return {
    name: 'dhole-pricing-wizard-persisted-lcl-hydration',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
