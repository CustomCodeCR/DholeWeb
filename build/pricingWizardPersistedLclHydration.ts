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
  code = replaceOne(code,
    "import { PricingService } from '@/core/services/pricingService'",
    "import { PricingService } from '@/core/services/pricingService'\nimport { LclRateSourceService } from '@/core/services/lclRateSourceService'",
    'coloader source import',
  )

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

async function hydratePersistedLclSource(rate: RateDto) {
  if (rate.shipmentMode !== 'Lcl') return

  // Use the original saved metadata even when an earlier UI filter removed all
  // line snapshots. The selected coloader's source ID must survive the filter.
  const notes = (rate.rateDetails ?? []).map((line) => String(line.notes ?? '')).join('\\n')
  const ownMatch = notes.match(/ConsolidadoId:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  const coloaderMatch = notes.match(/LCL\\s+COLOADER\\s*·\\s*RateId:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  // El coloader actual prevalece aunque la tarifa todavía conserve notas
  // históricas del consolidado propio y no tenga RateId en los detalles.
  const coloaderMarker = /Fuente LCL:\\s*Coloader|LCL\\s+COLOADER/i.test(notes)
  const ownMarker = /Fuente LCL:\\s*Propio|LCL\\s*PROPIO|ConsolidadoId:/i.test(notes)
  const isNoCarrierLcl = String(rate.carrierCode ?? '').toUpperCase() === 'LCL'
  const kind = coloaderMarker || (isNoCarrierLcl && !ownMarker)
    ? 'Coloader'
    : ownMatch ? 'Own' : null
  let sourceId = kind === 'Coloader'
    ? coloaderMatch?.[1] ?? rate.id
    : ownMatch?.[1] ?? null

  lclRequestedCbm.value = Math.max(1, Number(rate.chargeableQuantity || 0))
  if (kind === 'Coloader' && !rateLines.value.some((line) =>
    /LCL\\s+COLOADER|Fuente LCL:\\s*Coloader/i.test(String(line.notes ?? '')))) {
    // Earlier builds could empty the entire quote before we recovered its source.
    // Reload actual rate items from the coloader catalog, never from FCL costs.
    try {
      const candidates = await LclRateSourceService.browseColoaders({
        modality: 'Maritime',
        polId: rate.polId,
        poeId: rate.poeId,
        podId: rate.podId,
        incotermId: rate.incotermId,
        quoteDate: String(rate.validFrom ?? '').slice(0, 10),
      })
      const matchingProvider = candidates.filter((candidate) =>
        candidate.lines?.length && rate.agentId && candidate.providerId === rate.agentId)
      const selected = candidates.find((candidate) =>
        candidate.id === coloaderMatch?.[1] && candidate.lines?.length)
        ?? (matchingProvider.length === 1 ? matchingProvider[0] : null)
      if (selected) {
        sourceId = selected.id
        rateLines.value = selected.lines.map((line) => ({
          key: 'coloader:' + selected.id + ':' + line.id,
          section: sectionForDetail(line.costDetailType, line.name),
          name: line.name,
          costDetailType: line.costDetailType,
          costType: line.costType,
          chargeBasis: line.chargeBasis,
          costId: line.costId,
          contextLabel: [selected.providerName, selected.rateCode].filter(Boolean).join(' · '),
          notes: ['LCL COLOADER · RateId: ' + selected.id, line.notes].filter(Boolean).join(' · '),
          currencyId: line.currencyId,
          currencyName: line.currencyName,
          currencyCode: line.currencyCode,
          amountCurrencyCode: line.currencyCode,
          costAmount: Number(line.costAmount || 0),
          saleAmount: Number(line.saleAmount || 0),
          included: true,
          optional: line.costType === 'Optional',
          manual: false,
          applyDestinationTax: Boolean(line.applyDestinationTax),
          destinationTaxRate: Number(line.destinationTaxRate || 0),
        })) as RateLine[]
        form.carrierId = ''
        form.freightCost = Number(rateLines.value.find((line) => line.costDetailType === 'Freight')?.costAmount || 0)
        form.freightSale = Number(rateLines.value.find((line) => line.costDetailType === 'Freight')?.saleAmount || 0)
      }
    } catch {
      // Keep edits read-only from a data-loss perspective: saveRate guards
      // against an empty LCL quote and asks to reselect the coloader.
    }
  }
  if (!kind || !sourceId) return

  lclSelectedSourceKey.value = \`\${kind}:\${sourceId}\`
  const billableCbm = lclRequestedCbm.value
  const profitAmount = Number(rate.totalUtilityAmount || 0)

  lclSelectedSource.value = {
    kind,
    id: sourceId,
    label: kind === 'Own'
      ? \`Consolidado propio · \${rate.polName}\`
      : \`\${rate.agentName || 'Coloader'} · \${rate.rateCode}\`,
    requestedCbm: billableCbm,
    providerId: kind === 'Own' ? null : rate.agentId ?? null,
    providerName: kind === 'Own' ? (rate.agentName || 'Grupo Castro Fallas') : rate.agentName ?? null,
    providerCode: kind === 'Own' ? (rate.agentCode || 'GCF') : rate.agentCode ?? null,
    carrierId: kind === 'Coloader' ? null : rate.carrierId ?? null,
    carrierName: kind === 'Coloader' ? null : rate.carrierName ?? null,
    carrierCode: kind === 'Coloader' ? null : rate.carrierCode ?? null,
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
    lines: rateLines.value.map((line) => {
      const normalizedName = normalizeCatalogValue(line.name)
      const isPickup = /pick\s*up|recole/.test(normalizedName)
      return {
        ...line,
        // Normalize historical own-LCL snapshots created before CFS and PICK UP
        // were separated from the ocean-freight/destination rules.
        section: isPickup ? 'pickup_origin' : line.section,
        costDetailType: isPickup ? 'OriginCharge' : line.costDetailType,
        chargeBasis: normalizedName === 'cfs' ? 'PerCbm' : line.chargeBasis,
      }
    }) as LclRateSourceSelection['lines'],
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
    `    if (refreshingDuplicatedRate.value && rate.shipmentMode === 'Fcl') {`,
    `    await hydratePersistedLclSource(rate)
    if (refreshingDuplicatedRate.value && rate.shipmentMode === 'Fcl') {`,
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
