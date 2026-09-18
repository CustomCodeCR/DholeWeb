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

      const removalReplacement = `      const existingRateDetails = editingRate.value.rateDetails
      const originalDetailIds = new Set(existingRateDetails.map((detail) => detail.id))
      const currentDetailIds = new Set(
        includedLines.value
          .map((line) => line.detailId)
          .filter((id): id is string => Boolean(id)),
      )
      const includedCostIds = new Set(
        includedLines.value
          .map((line) => line.costId)
          .filter((id): id is string => Boolean(id)),
      )
      // Pantalla 7 es autoritativa durante una edición. Si una línea persistida ya no está
      // incluida, debe eliminarse incluso cuando provenga de un costo Fixed del maestro.
      // Solo evitamos una falsa eliminación cuando la línea sigue incluida pero perdió
      // temporalmente su detailId durante un rebuild y puede reconciliarse por CostId.
      const removedExtraDetailIds = existingRateDetails
        .filter((detail) =>
          !currentDetailIds.has(detail.id)
          && !(detail.costId && includedCostIds.has(detail.costId)),
        )
        .map((detail) => detail.id)`

      code = replaceOne(code, removalAnchor, removalReplacement, 'persisted detail removal reconciliation')

      const updateExtraDetailsAnchor = `      const extraDetails = createPayload.details.map((detail, index) => ({
        ...detail,
        id: includedLines.value[index]?.detailId ?? null,
      }))`
      const updateExtraDetailsReplacement = `      const persistedDetailIdForLine = (line: RateLine | undefined) => {
        if (!line) return null
        if (line.detailId) return line.detailId

        const byCostId = line.costId
          ? editingRate.value!.rateDetails.find((detail) => detail.costId === line.costId)
          : null
        if (byCostId) return byCostId.id

        return editingRate.value!.rateDetails.find((detail) =>
          detail.costDetailType === line.costDetailType
          && normalizeCatalogValue(detail.name) === normalizeCatalogValue(line.name),
        )?.id ?? null
      }
      const extraDetails = createPayload.details.map((detail, index) => ({
        ...detail,
        id: persistedDetailIdForLine(includedLines.value[index]),
      }))`
      code = replaceOne(code, updateExtraDetailsAnchor, updateExtraDetailsReplacement, 'persisted detail id reconciliation')

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
