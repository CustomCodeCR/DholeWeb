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

      // Un cambio de equipo, cantidad, moneda, vigencia o source de flete NO puede
      // convertir una ausencia temporal de UI en una eliminación. Solo se elimina:
      // 1) una línea que el usuario quitó explícitamente; 2) una línea todavía presente
      // pero desmarcada; o 3) una línea que dejó de pertenecer al contexto real de costos.
      const removedExtraDetailIds = existingRateDetails
        .filter((detail) => {
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
