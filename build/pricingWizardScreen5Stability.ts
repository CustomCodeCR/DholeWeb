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

  // For one requested equipment type, every matching tariff must remain visible:
  // 25 API matches means 25 cards. For mixed equipment, however, an unrestricted
  // cartesian product (25 x 25 x ...) can freeze the browser and blank the wizard.
  // Keep all candidates but bound only the number of generated multi-type bundles.
  code = replaceIfPresent(
    code,
    `    let combinations: ImportRateSelectDto[][] = [[]]\n    candidateGroups.forEach((candidates) => {\n      combinations = combinations\n        .flatMap((prefix) => candidates.map((candidate) => [...prefix, candidate]))\n        .sort(compareFclCombinations)\n    })`,
    `    let combinations: ImportRateSelectDto[][] = [[]]\n    candidateGroups.forEach((candidates) => {\n      combinations = combinations\n        .flatMap((prefix) => candidates.map((candidate) => [...prefix, candidate]))\n        .sort(compareFclCombinations)\n\n      if (candidateGroups.length > 1 && combinations.length > 250) {\n        combinations = combinations.slice(0, 250)\n      }\n    })`,
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
