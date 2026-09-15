import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceIfPresent(source: string, anchor: string, replacement: string) {
  return source.includes(anchor) ? source.replace(anchor, replacement) : source
}

function patchWizard(source: string) {
  let code = source

  // browseRates can return list projections without details. Screen 5 must never
  // crash while evaluating or rendering a saved/manual rate card.
  code = replaceIfPresent(
    code,
    `function savedManualRateFreight(rate: RateDto) {\n  return rate.rateDetails.find((detail) => detail.costDetailType === 'Freight') ?? null\n}`,
    `function savedManualRateFreight(rate: RateDto) {\n  return (rate.rateDetails ?? []).find((detail) => detail.costDetailType === 'Freight') ?? null\n}`,
  )

  code = replaceIfPresent(
    code,
    `function savedManualRateComment(rate: RateDto) {\n  const comments = rate.rateDetails\n    .map((detail) => String(detail.notes ?? '').trim())`,
    `function savedManualRateComment(rate: RateDto) {\n  const comments = (rate.rateDetails ?? [])\n    .map((detail) => String(detail.notes ?? '').trim())`,
  )

  code = code.replaceAll(
    `rate.rateDetails.some((detail) =>`,
    `(rate.rateDetails ?? []).some((detail) =>`,
  )

  code = replaceIfPresent(
    code,
    `availableSavedManualRates.value = result.items\n      .filter(savedManualRateMatchesContext)`,
    `availableSavedManualRates.value = (result.items ?? [])\n      .filter(savedManualRateMatchesContext)`,
  )

  // Source metadata is helpful for the card, but it is not required to decide
  // which rates are available. Historical imports can legitimately return 404 on
  // /source, so do not keep Screen 4 blocked while those lookups finish.
  code = replaceIfPresent(
    code,
    `const batchIds = [...new Set(rates.map((rate) => rate.importBatchId).filter(Boolean))]`,
    `const batchIds = [...new Set(rates.flatMap((rate) => rate?.importBatchId ? [rate.importBatchId] : []))]`,
  )
  code = code.replaceAll(
    `await loadImportSources(availableRates.value)`,
    `void loadImportSources(availableRates.value)`,
  )

  // Screen 4 must transition to Screen 5 immediately. The API lookup can continue
  // while Screen 5 shows its loading state; a secondary lookup/render failure must
  // never leave the user apparently stuck on Screen 4.
  code = replaceIfPresent(
    code,
    `  if (!canNext.value) return\n  if (step.value === 4) await searchApprovedRates()\n  if (step.value === 6) {`,
    `  if (!canNext.value) return\n  if (step.value === 4) {\n    step.value = 5\n    try {\n      await searchApprovedRates()\n    } catch (error) {\n      toastStore.backendError(error, 'No se pudieron cargar las tarifas disponibles.')\n    }\n    return\n  }\n  if (step.value === 6) {`,
  )

  // A single requested equipment type (for example 1 x 40HC) must map one API
  // rate to one visible card. It does not need the mixed-equipment cartesian
  // combination engine. Besides being simpler, this isolates malformed legacy
  // rows so one bad entry cannot prevent every valid tariff from being displayed.
  const singleEquipmentBundleAnchor = `const fclRateBundles = computed<FclRateBundle[]>(() => {\n  const requirements = fclRateRequirements.value\n  if (!requirements.length || requirements.some((requirement) => !requirement.rates.length)) return []`
  const singleEquipmentBundleReplacement = `${singleEquipmentBundleAnchor}\n\n  if (requirements.length === 1) {\n    const requirement = requirements[0]\n    return [...requirement.rates]\n      .filter((rate): rate is ImportRateSelectDto => Boolean(rate?.id))\n      .sort(compareFclCandidateRates)\n      .map((rate, index) => {\n        const unitCost = number(rate.freight)\n        const unitSale = number(rate.totalSale ?? rate.freight)\n        const totalCost = unitCost * requirement.quantity\n        const totalSale = unitSale * requirement.quantity\n\n        return {\n          key: 'single:' + String(rate.id) + ':' + index,\n          carrierFilterKey: fclRateCarrierFilterKey(rate),\n          carrierId: String(rate.carrierId ?? ''),\n          carrier: String(rate.carrier ?? 'Naviera'),\n          agentId: String(rate.agentId ?? ''),\n          agent: String(rate.agent ?? ''),\n          currencyId: String(rate.currencyId ?? ''),\n          currency: String(rate.currency ?? rate.currencyCode ?? 'USD'),\n          lines: [{\n            containerTypeId: requirement.containerTypeId,\n            containerTypeName: requirement.containerTypeName,\n            containerTypeCode: requirement.containerTypeCode,\n            quantity: requirement.quantity,\n            rate,\n            unitCost,\n            unitSale,\n            totalCost,\n            totalSale,\n          }],\n          totalCost,\n          totalSale,\n          validFrom: String(rate.validFrom ?? ''),\n          validTo: String(rate.validTo ?? ''),\n          freeDays: Math.max(0, number(rate.freeDays)),\n          transitDays: Math.max(0, number(rate.transitDays)),\n          sourceCount: rate.importBatchId ? 1 : 0,\n          preAuthorized: rate.status === 'PreAuthorized',\n        } satisfies FclRateBundle\n      })\n  }`
  code = replaceIfPresent(code, singleEquipmentBundleAnchor, singleEquipmentBundleReplacement)

  // Mixed-equipment requests still use combinations, but ignore malformed rows
  // before grouping and cap the generated cartesian result set.
  code = code.replaceAll(
    `new Set(requirement.rates.map(fclRateBundleGroupKey))`,
    `new Set(requirement.rates.filter((rate): rate is ImportRateSelectDto => Boolean(rate?.id)).map(fclRateBundleGroupKey))`,
  )

  // For one requested equipment type, every matching tariff must remain visible:
  // 25 API matches means 25 cards. For mixed equipment, however, an unrestricted
  // cartesian product (25 x 25 x ...) can freeze the browser and blank the wizard.
  // Keep all candidates but bound only the number of generated multi-type bundles.
  code = replaceIfPresent(
    code,
    `    let combinations: ImportRateSelectDto[][] = [[]]\n    candidateGroups.forEach((candidates) => {\n      combinations = combinations\n        .flatMap((prefix) => candidates.map((candidate) => [...prefix, candidate]))\n        .sort(compareFclCombinations)\n    })`,
    `    let combinations: ImportRateSelectDto[][] = [[]]\n    candidateGroups.forEach((candidates) => {\n      combinations = combinations\n        .flatMap((prefix) => candidates.filter((candidate): candidate is ImportRateSelectDto => Boolean(candidate?.id)).map((candidate) => [...prefix, candidate]))\n        .sort(compareFclCombinations)\n\n      if (candidateGroups.length > 1 && combinations.length > 250) {\n        combinations = combinations.slice(0, 250)\n      }\n    })`,
  )

  return code
}

export function pricingWizardScreen5Stability(): Plugin {
  return {
    name: 'dhole-pricing-wizard-screen5-stability',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
