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
      const identityImportAnchor = `import { computePricingRevisionTotals } from '@/modules/pricing/utils/pricingRevisionTotals'`
      code = replaceOne(
        code,
        identityImportAnchor,
        `${identityImportAnchor}\nimport { buildRateUpdateExtraDetails, reconcileRateUpdateDetailChanges } from '@/modules/pricing/utils/pricingRateUpdateDetails'`,
        'rate detail identity normalizer import',
      )

      const lineStateAnchor = `const rateLines = ref<RateLine[]>([])`
      code = replaceOne(
        code,
        lineStateAnchor,
        `${lineStateAnchor}\nconst explicitlyRemovedPersistedDetailIds = ref(new Set<string>())`,
        'explicit persisted-detail removal state',
      )

      const hydrateAnchor = `async function hydrateExistingRate() {`
      code = replaceOne(
        code,
        hydrateAnchor,
        `${hydrateAnchor}\n  explicitlyRemovedPersistedDetailIds.value.clear()`,
        'edit hydration removal-state reset',
      )

      const manualHelperAnchor = `function addManualCharge() {`
      code = replaceOne(
        code,
        manualHelperAnchor,
        `function removeManualRateLine(line: RateLine) {\n  if (line.detailId) explicitlyRemovedPersistedDetailIds.value.add(line.detailId)\n  rateLines.value = rateLines.value.filter((item) => item.key !== line.key)\n}\n\n${manualHelperAnchor}`,
        'manual persisted-detail removal helper',
      )

      const manualDeleteAnchor = `@click="rateLines = rateLines.filter((item) => item.key !== line.key)">Eliminar</button>`
      code = replaceOne(
        code,
        manualDeleteAnchor,
        `@click="removeManualRateLine(line)">Eliminar</button>`,
        'manual persisted-detail delete button',
      )

      // Keep user-deleted manual lines explicit, but never interpret a missing
      // or filtered persisted row as a deletion. The backend rejects incomplete
      // full snapshots with the same policy.
      const removalAnchor = '      const missingPersistedDetailIds = [...originalDetailIds].filter((id) => !currentDetailIds.has(id))'
      const removalReplacement = '      const missingPersistedDetailIds = [...originalDetailIds].filter((id) => !currentDetailIds.has(id) && !explicitlyRemovedPersistedDetailIds.value.has(id))'
      code = replaceOne(code, removalAnchor, removalReplacement, 'persisted detail omission guard')
      code = replaceOne(code,
        '      const removedExtraDetailIds: string[] = []',
        '',
        'explicit removal IDs in final edit payload')

      const updateExtraDetailsAnchor = `      const extraDetails = createPayload.details.map((detail, index) => ({
        ...detail,
        id: orderedCompleteRateLines.value[index]?.detailId ?? null,
      }))`
      const updateExtraDetailsReplacement = `      // Only the persisted RateDetail ID is authoritative for updates.
      // Never attach two homonymous CostIds to the same historical detail.
      const persistedDetailIdForLine = (line: RateLine | undefined) =>
        line?.detailId && editingRate.value!.rateDetails.some((detail) => detail.id === line.detailId)
          ? line.detailId
          : null
      const proposedExtraDetails = buildRateUpdateExtraDetails(
        createPayload.details,
        orderedCompleteRateLines.value.map((line) => ({ detailId: persistedDetailIdForLine(line) })),
        editingRate.value!.rateDetails,
      )
      // Both freight and every other historical line survive unless the
      // operator explicitly removed its ID. Incoterms only generate proposals.
      const { extraDetails, removedExtraDetailIds } = reconcileRateUpdateDetailChanges(
        proposedExtraDetails,
        [...explicitlyRemovedPersistedDetailIds.value],
        editingRate.value!.rateDetails,
        false,
        false,
      )`
      code = replaceOne(code, updateExtraDetailsAnchor, updateExtraDetailsReplacement, 'persisted detail id reconciliation')

      const detailsMapper = code.includes(
        'const details: CreateRateDetailRequest[] = normalizedIncludedLines.map((line) => ({',
      )
        ? 'normalizedIncludedLines'
        : 'includedLines.value'

      const freightNameLine = code.includes("name: form.modality === 'Air' && line.costDetailType === 'Freight'")
        ? "    name: form.modality === 'Air' && line.costDetailType === 'Freight' ? 'Flete Internacional' : line.name,"
        : '    name: line.name,'
      const createDetailsAnchor = `  const details: CreateRateDetailRequest[] = ${detailsMapper}.map((line) => ({
    costId: line.costId ?? null,
${freightNameLine}
    costDetailType: line.costDetailType,
    costType: line.costType,`

      const createDetailsReplacement = `  const details: CreateRateDetailRequest[] = ${detailsMapper}.map((line) => ({
    costId: line.costId ?? null,
${freightNameLine}
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
