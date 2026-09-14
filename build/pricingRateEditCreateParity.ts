import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const RATES_VIEW_PATH = '/src/modules/pricing/views/PricingRatesView.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingRateEditCreateParity] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function replaceRegexOne(source: string, pattern: RegExp, replacement: string, label: string) {
  const matches = source.match(pattern)
  if (!matches) {
    throw new Error(`[pricingRateEditCreateParity] Missing ${label}.`)
  }
  return source.replace(pattern, replacement)
}

function patchWizard(source: string) {
  let code = source

  // Editing must enter the same guided flow as creation. Viewing remains freely navigable.
  code = replaceOne(
    code,
    `    step.value = props.viewOnly ? 9 : 8`,
    `    step.value = props.viewOnly ? 9 : 1`,
    'edit initial step',
  )

  code = replaceOne(
    code,
    `  if (props.rateId) {\n    if (step.value < maxStep.value) step.value += 1\n    return\n  }`,
    `  if (props.rateId && props.viewOnly) {\n    if (step.value < maxStep.value) step.value += 1\n    return\n  }`,
    'edit next shortcut',
  )

  code = replaceOne(
    code,
    `function goToStep(target: number) {\n  if (target < 1 || target > maxStep.value) return\n  // Crear mantiene el flujo guiado; Ver y Editar pueden recorrer libremente toda la tarifa.\n  if (props.rateId || target <= step.value) step.value = target\n}`,
    `function goToStep(target: number) {\n  if (target < 1 || target > maxStep.value) return\n  // Visualizar puede recorrer libremente. Crear y Editar usan el mismo flujo guiado.\n  if (props.viewOnly && props.rateId) {\n    step.value = target\n    return\n  }\n  if (target <= step.value) step.value = target\n}`,
    'guided edit step navigation',
  )

  // Another historical patch still injected a mandatory update reason. It is update-only
  // behavior, so remove both the save guard and its UI while keeping the API-compatible field.
  code = replaceOne(
    code,
    `      if (!updateReason.value.trim()) {\n        toastStore.error('Indique el motivo de la actualización de la tarifa.')\n        return\n      }\n`,
    '',
    'update reason save guard',
  )

  code = replaceRegexOne(
    code,
    /      <div v-if="!viewOnly" class="mt-4">\n\s*<label[^>]*>Motivo de actualización \*<\/label>\n\s*<textarea v-model="updateReason"[\s\S]*?<\/div>\n(?=\s*<div v-if="editingRate\.status === 'AcceptedByClient' && !viewOnly")/,
    '',
    'update reason panel',
  )

  const hydrateAnchor = `async function hydrateExistingRate() {`
  const hydrateHelpers = `function hydrateEditSelectionsFromRate(rate: RateDto) {\n  const subjectText = normalizeCatalogValue(rate.subjectTo ?? '')\n  const includesText = normalizeCatalogValue(rate.includes ?? '')\n  const details = rate.rateDetails ?? []\n  const detailTexts = details.map((detail) => normalizeCatalogValue(\`${'${detail.name} ${detail.notes ?? \'\'}'}\`))\n\n  form.dangerousCargo = detailTexts.some((text) =>\n    text.includes('carga peligrosa') || text.includes('dangerous') || text.includes('hazmat'),\n  ) || subjectText.includes('carga peligrosa') || subjectText.includes('dangerous') || subjectText.includes('hazmat')\n\n  form.nonStackable = subjectText.includes('no estibable')\n    || subjectText.includes('non stackable')\n    || subjectText.includes('nonstackable')\n\n  form.overweight = detailTexts.some((text) =>\n    text.includes('sobrepeso') || text.includes('sobre peso') || text.includes('overweight') || text.includes('over weight'),\n  ) || subjectText.includes('sobrepeso') || subjectText.includes('sobre peso') || subjectText.includes('overweight')\n\n  form.merchantHaulage = details.some((detail) => haulageAssociation({ name: detail.name }) === 'merchant')\n    || includesText.includes('merchant haulage')\n    || includesText.includes('inland gam merchant')\n\n  form.carrierHaulage = details.some((detail) => haulageAssociation({ name: detail.name }) === 'carrier')\n    || includesText.includes('carrier haulage')\n    || includesText.includes('inland gam naviera')\n\n  const hasAnticipado = detailTexts.some((text) => text.includes('anticipado') && !text.includes('redestino'))\n  const hasRedestino = detailTexts.some((text) => text.includes('redestino') && !text.includes('anticipado'))\n  form.portHandlingMode = hasAnticipado ? 'Anticipado' : hasRedestino ? 'Redestino' : ''\n}\n\nfunction relinkExistingDetailIdsForEdit() {\n  if (!editingRate.value || props.viewOnly) return\n\n  const remaining = [...editingRate.value.rateDetails]\n  const takeMatch = (line: RateLine) => {\n    let index = -1\n    if (line.costId) {\n      index = remaining.findIndex((detail) => detail.costId === line.costId)\n    }\n    if (index < 0) {\n      index = remaining.findIndex((detail) =>\n        detail.costDetailType === line.costDetailType\n        && normalizeCatalogValue(detail.name) === normalizeCatalogValue(line.name),\n      )\n    }\n    if (index < 0 && line.costDetailType === 'Freight') {\n      index = remaining.findIndex((detail) => detail.costDetailType === 'Freight')\n    }\n    if (index < 0) return null\n    const [match] = remaining.splice(index, 1)\n    return match\n  }\n\n  rateLines.value.forEach((line) => {\n    if (line.detailId) return\n    const match = takeMatch(line)\n    if (match) line.detailId = match.id\n  })\n}\n\n${hydrateAnchor}`
  code = replaceOne(code, hydrateAnchor, hydrateHelpers, 'edit hydration helpers')

  code = replaceOne(
    code,
    `    form.cargoHeightCm = Number(rate.cargoLines?.[0]?.heightCm ?? 0)\n\n    rateLines.value = rate.rateDetails.map((detail) => {`,
    `    form.cargoHeightCm = Number(rate.cargoLines?.[0]?.heightCm ?? 0)\n    hydrateEditSelectionsFromRate(rate)\n\n    rateLines.value = rate.rateDetails.map((detail) => {`,
    'screen 4 selection hydration',
  )

  // Once the normal create flow builds Screen 7, reconnect equivalent rows to persisted
  // detail IDs. This updates/replaces existing rows instead of duplicating them.
  code = replaceOne(
    code,
    `watch(step, (value) => {\n  if (value === 7) void loadHaciendaExchangeRate(false)\n})`,
    `watch(step, (value) => {\n  if (value === 7) {\n    void loadHaciendaExchangeRate(false)\n    if (props.rateId && !props.viewOnly) relinkExistingDetailIdsForEdit()\n  }\n})`,
    'screen 7 detail relinking',
  )

  return code
}

function patchRatesView(source: string) {
  let code = source

  code = replaceOne(
    code,
    `import type { RateDto, RateStatus } from '@/core/interfaces/pricing'`,
    `import type { RateDto } from '@/core/interfaces/pricing'`,
    'rate view type import',
  )

  code = replaceRegexOne(
    code,
    /const requestedRateUpdateStatuses = new Set<RateStatus>\(\[[\s\S]*?\]\)\n\nfunction canUpdateRate\(rate: RateDto\) \{[\s\S]*?\n\}\n\nfunction rateUpdateWindowMessage\(rate: RateDto\) \{[\s\S]*?\n\}\n/,
    `function canUpdateRate(_rate: RateDto) {\n  return canUpdate.value\n}\n`,
    'rate update status window',
  )

  code = replaceRegexOne(
    code,
    /function openEdit\(rate: RateDto\) \{[\s\S]*?router\.push\(\{ name: 'pricing-rate-wizard', params: \{ rateId: rate\.id \}, query: \{ mode: 'edit' \} \}\)\n\}/,
    `function openEdit(rate: RateDto) {\n  if (!canUpdateRate(rate)) {\n    toastStore.warning('Permiso requerido', 'Necesita permiso para actualizar tarifas.')\n    return\n  }\n  router.push({ name: 'pricing-rate-wizard', params: { rateId: rate.id }, query: { mode: 'edit' } })\n}`,
    'rate edit action',
  )

  return code
}

export function pricingRateEditCreateParity(): Plugin {
  return {
    name: 'dhole-pricing-rate-edit-create-parity',
    // Intentionally normal (not pre): all historical Pricing patches run first, then this
    // final compatibility layer removes edit-only behavior before Vue compiles the SFC.
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(RATES_VIEW_PATH)) return { code: patchRatesView(source), map: null }
      return null
    },
  }
}
