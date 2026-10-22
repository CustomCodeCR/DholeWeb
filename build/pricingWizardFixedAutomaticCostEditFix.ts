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
        `${identityImportAnchor}\nimport { buildRateUpdateExtraDetails, reconcileRateUpdateDetailChanges, stalePersistedFclFreightDetailIds } from '@/modules/pricing/utils/pricingRateUpdateDetails'`,
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

      const removalAnchor = `      const originalDetailIds = new Set(editingRate.value.rateDetails.map((detail) => detail.id))
      const currentDetailIds = new Set(includedLines.value.map((line) => line.detailId).filter((id): id is string => Boolean(id)))
      const removedExtraDetailIds = [...originalDetailIds].filter((id) => !currentDetailIds.has(id))`

      const removalReplacement = `      const originalDetailIds = new Set(editingRate.value.rateDetails.map((detail) => detail.id))
      const existingRateDetails = editingRate.value.rateDetails
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
      const persistedServiceIds = (editingRate.value.services ?? [])
        .map((service) => service.id)
        .filter(Boolean)
        .sort()
      const currentServiceIds = [...form.serviceIds].filter(Boolean).sort()
      const samePersistedPricingContext =
        String(editingRate.value.polId ?? '') === String(form.originId ?? '')
        && String(editingRate.value.poeId ?? '') === String(form.destinationId ?? '')
        && String(editingRate.value.podId ?? '') === String(form.podId ?? '')
        && String(editingRate.value.carrierId ?? '') === String(form.carrierId ?? '')
        && String(editingRate.value.agentId ?? '') === String(form.agentId ?? '')
        && String(editingRate.value.incotermId ?? '') === String(form.incotermId ?? '')
        && String(editingRate.value.shipmentMode ?? '').toUpperCase() === String(shipmentModeForApi.value ?? '').toUpperCase()
        && persistedServiceIds.join('|') === currentServiceIds.join('|')

      const persistedLineForDetail = (detail: RateDto['rateDetails'][number]) =>
        rateLines.value.find((line) =>
          line.detailId === detail.id
          || Boolean(detail.costId && line.costId === detail.costId)
          || (
            line.costDetailType === detail.costDetailType
            && normalizeCatalogValue(line.name) === normalizeCatalogValue(detail.name)
          ),
        )

      // Keep unrelated saved costs when context is unchanged, but a freight
      // line no longer included in the current FCL equipment distribution is
      // obsolete (e.g. replacing 40HC + 40NOR with two 40NOR containers).
      const staleFclFreightIds = stalePersistedFclFreightDetailIds(
        shipmentModeForApi.value, existingRateDetails, includedLines.value,
      )
      const proposedRemovedExtraDetailIds = existingRateDetails
        .filter((detail) => {
          if (staleFclFreightIds.has(detail.id)) return true
          if (explicitlyRemovedPersistedDetailIds.value.has(detail.id)) return true

          const currentLine = persistedLineForDetail(detail)
          if (currentLine) return !currentLine.included

          if (samePersistedPricingContext) return false
          return !currentDetailIds.has(detail.id)
            && !(detail.costId && includedCostIds.has(detail.costId))
        })
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
      // A cost/name fallback may point two different rows to the same persisted Id.
      // Match the existing CostId, insert other distinct charges, and dedupe exact retries.
      const proposedExtraDetails = buildRateUpdateExtraDetails(
        createPayload.details,
        includedLines.value.map((line) => ({ detailId: persistedDetailIdForLine(line) })),
        editingRate.value!.rateDetails,
      )
      // Reconcile the actual PUT details with inferred removals. In CIF an old
      // Freight Id cannot also update Release, HBL, Manejos or other charges.
      const { extraDetails, removedExtraDetailIds } = reconcileRateUpdateDetailChanges(
        proposedExtraDetails,
        proposedRemovedExtraDetailIds,
        editingRate.value!.rateDetails,
        freightNotRequiredByIncoterm.value,
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
