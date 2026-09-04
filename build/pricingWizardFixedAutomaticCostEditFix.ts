import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardFixedAutomaticCostEditFix] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

export function pricingWizardFixedAutomaticCostEditFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-fixed-automatic-cost-edit-fix',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null

      let code = source

      const removalAnchor = `      const originalDetailIds = new Set(editingRate.value.rateDetails.map((detail) => detail.id))
      const currentDetailIds = new Set(includedLines.value.map((line) => line.detailId).filter((id): id is string => Boolean(id)))
      const removedExtraDetailIds = [...originalDetailIds].filter((id) => !currentDetailIds.has(id))`

      const removalReplacement = `      const originalDetailIds = new Set(editingRate.value.rateDetails.map((detail) => detail.id))
      // Fixed costs linked to the Pricing cost master are automatic details. They are
      // synchronized by Pricing and must never be interpreted as user deletions just
      // because a rebuilt LCL/FCL source line no longer carries the persisted detailId.
      const protectedAutomaticFixedDetailIds = new Set(
        editingRate.value.rateDetails
          .filter((detail) => Boolean(detail.costId) && detail.costType === 'Fixed')
          .map((detail) => detail.id),
      )
      const currentDetailIds = new Set(includedLines.value.map((line) => line.detailId).filter((id): id is string => Boolean(id)))
      const removedExtraDetailIds = [...originalDetailIds].filter(
        (id) => !currentDetailIds.has(id) && !protectedAutomaticFixedDetailIds.has(id),
      )`

      code = replaceOne(code, removalAnchor, removalReplacement, 'automatic fixed-cost removal reconciliation')

      const createDetailsAnchor = `  const details: CreateRateDetailRequest[] = includedLines.value.map((line) => ({
    costId: line.costId ?? null,
    name: line.name,
    costDetailType: line.costDetailType,
    costType: line.costType,`

      const createDetailsReplacement = `  const details: CreateRateDetailRequest[] = includedLines.value.map((line) => ({
    costId: line.costId ?? null,
    name: line.name,
    costDetailType: line.costDetailType,
    // LCL source snapshots can be marked Fixed without belonging to the global
    // Costs master. Backend reserves Fixed for automatic rows backed by CostId.
    // Persist unlinked LCL source rows as normal quotation lines instead.
    costType: shipmentModeForApi.value === 'Lcl' && !line.costId && line.costType === 'Fixed'
      ? 'Variable'
      : line.costType,`

      code = replaceOne(code, createDetailsAnchor, createDetailsReplacement, 'LCL unlinked fixed-line creation normalization')

      return { code, map: null }
    },
  }
}
