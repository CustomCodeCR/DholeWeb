import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) throw new Error(`[pricingWizardStep5RateFilter] Expected one ${label}, found ${count}.`)
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `const availableRates = ref<ImportRateSelectDto[]>([])`,
    `const availableRates = ref<ImportRateSelectDto[]>([])\nconst rateCarrierFilter = ref('')`,
    'rate carrier filter state',
  )

  code = replaceOne(
    code,
    `const sortedAvailableRates = computed(() =>\n  [...availableRates.value].sort((left, right) => {\n    const price = number(left.freight) - number(right.freight)\n    if (price !== 0) return price\n    const comment = rateCommentRank(right.spaceComment) - rateCommentRank(left.spaceComment)\n    if (comment !== 0) return comment\n    return new Date(right.validTo).getTime() - new Date(left.validTo).getTime()\n  }),\n)`,
    `const rateCarrierFilterOptions = computed(() => {\n  const carriers = new Map<string, string>()\n  availableRates.value.forEach((rate) => {\n    const value = String(rate.carrierId ?? '').trim()\n    const label = String(rate.carrier ?? '').trim()\n    if (value && label && !carriers.has(value)) carriers.set(value, label)\n  })\n\n  return [\n    { value: '', label: 'Todas las navieras' },\n    ...[...carriers.entries()]\n      .sort((left, right) => left[1].localeCompare(right[1], 'es'))\n      .map(([value, label]) => ({ value, label })),\n  ]\n})\n\nconst sortedAvailableRates = computed(() =>\n  [...availableRates.value]\n    .filter((rate) => !rateCarrierFilter.value || rate.carrierId === rateCarrierFilter.value)\n    .sort((left, right) => {\n      const validityDays = remainingValidityDays(right.validTo) - remainingValidityDays(left.validTo)\n      if (validityDays !== 0) return validityDays\n      const validityDate = new Date(right.validTo).getTime() - new Date(left.validTo).getTime()\n      if (validityDate !== 0) return validityDate\n      const comment = rateCommentRank(right.spaceComment) - rateCommentRank(left.spaceComment)\n      if (comment !== 0) return comment\n      const price = number(left.freight) - number(right.freight)\n      if (price !== 0) return price\n      return String(left.carrier ?? '').localeCompare(String(right.carrier ?? ''), 'es')\n    }),\n)`,
    'available rate sorting',
  )

  code = replaceOne(
    code,
    `async function searchApprovedRates() {\n  availableRates.value = []\n  form.selectedImportRateId = ''`,
    `async function searchApprovedRates() {\n  availableRates.value = []\n  rateCarrierFilter.value = ''\n  form.selectedImportRateId = ''`,
    'approved rate search reset',
  )

  code = replaceOne(
    code,
    `  availableRates.value = []\n  rateLines.value = []`,
    `  availableRates.value = []\n  rateCarrierFilter.value = ''\n  rateLines.value = []`,
    'wizard reset',
  )

  code = replaceOne(
    code,
    `          <template v-else-if="availableRates.length">\n            <div class="grid gap-4 lg:grid-cols-2">`,
    `          <template v-else-if="availableRates.length">\n            <div class="crystal-soft flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">\n              <div>\n                <p class="text-sm font-black">Orden y filtro de tarifas</p>\n                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Mayor vigencia primero · {{ sortedAvailableRates.length }} de {{ availableRates.length }} tarifa{{ availableRates.length === 1 ? '' : 's' }}</p>\n              </div>\n              <div class="w-full md:max-w-xs">\n                <DhSelect v-model="rateCarrierFilter" label="Naviera" :options="rateCarrierFilterOptions" />\n              </div>\n            </div>\n\n            <div v-if="!sortedAvailableRates.length" class="crystal-empty p-7 text-center">\n              <p class="font-black">No hay tarifas para la naviera seleccionada</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Seleccione “Todas las navieras” para volver a mostrar todas las opciones.</p>\n            </div>\n\n            <div v-else class="grid gap-4 lg:grid-cols-2">`,
    'screen 5 carrier filter',
  )

  return code
}

export function pricingWizardStep5RateFilter(): Plugin {
  return {
    name: 'dhole-pricing-wizard-step5-rate-filter',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (id.includes('?')) return null
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
