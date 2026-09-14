import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceBetween(
  source: string,
  start: string,
  end: string,
  replacement: string,
  label: string,
) {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) throw new Error(`[pricingWizardManualRatesVisibilityFix] Missing ${label} start.`)
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (endIndex < 0) throw new Error(`[pricingWizardManualRatesVisibilityFix] Missing ${label} end.`)
  return source.slice(0, startIndex) + replacement + source.slice(endIndex)
}

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingWizardManualRatesVisibilityFix] Missing ${label}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  // This plugin intentionally runs after pricingWizardSavedManualRates and
  // pricingWizardScreen5Stability. browseRates returns a light projection in some
  // deployments, so rateDetails can be absent even though the saved manual tariff
  // is valid. Previously that made every manual tariff fail the Screen 5 filter.
  if (!code.includes('const availableSavedManualRates = ref<RateDto[]>([])')) return code

  const commentAnchor = `function savedManualRateComment(rate: RateDto) {
  const comments = (rate.rateDetails ?? [])
    .map((detail) => String(detail.notes ?? '').trim())
    .filter(Boolean)
  return [...new Set(comments)].join(' | ')
}`

  const commentReplacement = `${commentAnchor}

function savedManualRateCommentText(rate: RateDto) {
  const detailComment = savedManualRateComment(rate)
  if (detailComment) return detailComment

  return [rate.includes, rate.subjectTo, rate.excludes]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' | ')
}

function savedManualRatePrice(rate: RateDto) {
  const freight = savedManualRateFreight(rate)
  if (freight) return number(freight.costAmount)
  return number(rate.totalCostAmount ?? rate.totalSaleAmount ?? 0)
}

function savedManualRateHeaderMatchesContext(rate: RateDto) {
  if (rate.sourceImportFclRateId) return false
  if (!['Open', 'ApprovedByManagement'].includes(rate.status)) return false
  if (rate.shipmentMode !== shipmentModeForApi.value) return false
  if (rate.polId !== form.originId || rate.poeId !== form.destinationId) return false
  if (form.podId && rate.podId && rate.podId !== form.podId) return false

  const quoteDate = new Date(\`${'${form.loadDate}'}T12:00:00\`).getTime()
  const validFrom = new Date(rate.validFrom).getTime()
  const validTo = new Date(rate.validTo).getTime()
  if (Number.isFinite(quoteDate) && Number.isFinite(validFrom) && quoteDate < validFrom) return false
  if (Number.isFinite(quoteDate) && Number.isFinite(validTo) && quoteDate > validTo) return false

  if (shipmentModeForApi.value === 'Fcl') {
    if (fclContainerAllocations.value.length !== 1) return false
    const requirement = fclContainerAllocations.value[0]
    const containers = rate.containers?.length
      ? rate.containers
      : [{ containerTypeId: rate.containerTypeId, quantity: rate.containerQuantity }]
    return containers.some((container) => container.containerTypeId === requirement.containerTypeId)
  }

  if (shipmentModeForApi.value !== 'Lcl' && selectedEquipment.value?.id && rate.containerTypeId !== selectedEquipment.value.id) {
    return false
  }

  return true
}

async function resolveSavedManualRate(rate: RateDto) {
  if ((rate.rateDetails ?? []).length) return rate
  try {
    return await PricingService.getRate(rate.id)
  } catch {
    // Keep the browse projection visible instead of silently dropping the tariff.
    return rate
  }
}`

  code = replaceRequired(code, commentAnchor, commentReplacement, 'manual rate helpers')

  code = replaceBetween(
    code,
    `async function searchSavedManualRates() {`,
    `async function searchApprovedRates() {`,
    `async function searchSavedManualRates() {
  availableSavedManualRates.value = []
  selectedSavedManualRateId.value = ''

  if (!form.originId || !form.destinationId || !shipmentModeForApi.value) return

  try {
    const result = await PricingService.browseRates({
      pageNumber: 1,
      pageSize: 500,
      polId: form.originId,
      poeId: form.destinationId,
      quoteDate: form.loadDate,
    })

    const matchingHeaders = (result.items ?? []).filter(savedManualRateHeaderMatchesContext)
    const hydratedRates = await Promise.all(matchingHeaders.map(resolveSavedManualRate))

    availableSavedManualRates.value = hydratedRates
      .filter((rate) => {
        if (!savedManualRateHeaderMatchesContext(rate)) return false
        const details = rate.rateDetails ?? []
        if (details.some((detail) => normalizeCatalogValue(detail.name).includes('solicitud pendiente de pricing'))) {
          return false
        }
        if (details.length > 0) {
          const hasAmount = details.some((detail) => number(detail.costAmount) > 0 || number(detail.saleAmount) > 0)
          if (!hasAmount && savedManualRatePrice(rate) <= 0) return false
        }
        return true
      })
      .sort((left, right) => {
        const validityDays = remainingValidityDays(right.validTo) - remainingValidityDays(left.validTo)
        if (validityDays !== 0) return validityDays
        const validity = new Date(right.validTo).getTime() - new Date(left.validTo).getTime()
        if (validity !== 0) return validity
        const comment = rateCommentRank(savedManualRateCommentText(right)) - rateCommentRank(savedManualRateCommentText(left))
        if (comment !== 0) return comment
        const price = savedManualRatePrice(left) - savedManualRatePrice(right)
        if (price !== 0) return price
        return String(left.rateCode ?? left.id).localeCompare(String(right.rateCode ?? right.id), 'es')
      })
  } catch (error) {
    availableSavedManualRates.value = []
    toastStore.backendError(error, 'No se pudieron consultar las tarifas manuales guardadas.')
  }
}

`,
    'manual rate search',
  )

  code = replaceBetween(
    code,
    `function chooseSavedManualRate(rate: RateDto) {`,
    `function hydrateSavedManualRateLines(rate: RateDto) {`,
    `async function chooseSavedManualRate(rate: RateDto) {
  const resolvedRate = await resolveSavedManualRate(rate)
  const index = availableSavedManualRates.value.findIndex((item) => item.id === resolvedRate.id)
  if (index >= 0) availableSavedManualRates.value[index] = resolvedRate

  const freight = savedManualRateFreight(resolvedRate)
  selectedSavedManualRateId.value = resolvedRate.id
  form.selectedImportRateId = ''
  form.manualRate = false
  selectedFclBundleKey.value = ''
  fclSelectedImportRateIds.value = {}

  form.freightCost = number(freight?.costAmount ?? resolvedRate.totalCostAmount ?? 0)
  form.freightSale = number(freight?.saleAmount ?? resolvedRate.totalSaleAmount ?? freight?.costAmount ?? 0)
  form.freeDays = number(resolvedRate.freeDays)
  form.transitDays = savedManualRateTransitDays(resolvedRate)
  if (resolvedRate.validTo) form.validTo = resolvedRate.validTo.slice(0, 10)

  if (resolvedRate.agentId && catalogs.agents.some((item) => item.id === resolvedRate.agentId)) {
    form.agentId = resolvedRate.agentId
  } else if (resolvedRate.agentName) {
    const agent = catalogs.agents.find((item) => normalizeCatalogValue(displayValue(item)) === normalizeCatalogValue(resolvedRate.agentName ?? ''))
    if (agent) form.agentId = agent.id
  }

  if (resolvedRate.carrierId && catalogs.carriers.some((item) => item.id === resolvedRate.carrierId)) {
    form.carrierId = resolvedRate.carrierId
  } else if (resolvedRate.carrierName) {
    const carrier = catalogs.carriers.find((item) => normalizeCatalogValue(displayValue(item)) === normalizeCatalogValue(resolvedRate.carrierName ?? ''))
    if (carrier) form.carrierId = carrier.id
  }

  if (resolvedRate.currencyId && catalogs.currencies.some((item) => item.id === resolvedRate.currencyId)) {
    form.currencyId = resolvedRate.currencyId
  }

  step.value = 6
}

`,
    'manual rate selection',
  )

  code = replaceRequired(
    code,
    `{{ formatMoney(savedManualRateFreight(rate)?.costAmount || 0, savedManualRateCurrency(rate)) }}`,
    `{{ formatMoney(savedManualRatePrice(rate), savedManualRateCurrency(rate)) }}`,
    'manual rate card price',
  )

  code = replaceRequired(
    code,
    `{{ savedManualRateComment(rate) || 'Sin comentarios registrados' }}`,
    `{{ savedManualRateCommentText(rate) || 'Sin comentarios registrados' }}`,
    'manual rate card comment',
  )

  return code
}

export function pricingWizardManualRatesVisibilityFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-manual-rates-visibility-fix',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
