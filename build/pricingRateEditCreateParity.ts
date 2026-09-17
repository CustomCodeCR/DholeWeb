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

  // Editing starts behind the mandatory update-reason gate. Once the reason is confirmed,
  // the user enters Screen 3 to review route/POE/equipment before selecting a tariff.
  // View-only keeps the persisted full-view screen.
  code = replaceOne(
    code,
    `    step.value = props.viewOnly ? 9 : 8`,
    `    step.value = props.viewOnly ? 9 : 0`,
    'edit initial step',
  )

  code = replaceOne(
    code,
    `  if (props.rateId) {\n    if (step.value < maxStep.value) step.value += 1\n    return\n  }`,
    `  if (props.rateId && props.viewOnly) {\n    if (step.value < maxStep.value) step.value += 1\n    return\n  }`,
    'edit next shortcut',
  )

  // pricingRequirements20260908 creates updateReason before this compatibility layer runs.
  // Keep an explicit confirmation state so the wizard cannot be used before the reason exists.
  code = replaceOne(
    code,
    `const updateReason = ref('')`,
    `const updateReason = ref('')\nconst editReasonConfirmed = ref(false)`,
    'edit reason gate state',
  )

  // Existing-rate drafts must never overwrite the persisted tariff after hydration.
  // A previous browser draft can contain stale booleans and even an invalid step (9/8).
  if (code.includes(`const pricingDraftEnabled = computed(() => !props.viewOnly)`)) {
    code = replaceOne(
      code,
      `const pricingDraftEnabled = computed(() => !props.viewOnly)`,
      `const pricingDraftEnabled = computed(() => !props.viewOnly && !props.rateId)`,
      'edit draft disable',
    )
  }

  // Several earlier compatibility plugins may adjust the comment/body around this helper.
  // Replace the complete function rather than depending on its historical exact text.
  code = replaceRegexOne(
    code,
    /function goToStep\(target: number\) \{[\s\S]*?\n\}/,
    `function goToStep(target: number) {\n  if (target < 1 || target > maxStep.value) return\n  // Visualizar puede recorrer libremente. Crear y Editar usan el mismo flujo guiado.\n  if (props.viewOnly && props.rateId) {\n    step.value = target\n    return\n  }\n  if (target <= step.value) step.value = target\n}`,
    'guided edit step navigation',
  )

  // pricingRequirements20260908 injects the mandatory update-reason field, guard and
  // payload. Turn that field into the entry gate for the edit wizard.
  code = replaceOne(
    code,
    `      <div v-if="!viewOnly" class="mt-4">\n        <label class="block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Motivo de actualización *</label>\n        <textarea v-model="updateReason" rows="3" class="mt-2 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--dh-primary)]" placeholder="Explique por qué se actualiza esta tarifa. El motivo quedará auditado." />\n      </div>`,
    `      <div v-if="!viewOnly && !editReasonConfirmed" class="mt-4">\n        <label class="block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Motivo de actualización *</label>\n        <textarea v-model="updateReason" rows="3" class="mt-2 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--dh-primary)]" placeholder="Explique por qué se actualiza esta tarifa. El motivo quedará auditado." />\n        <div class="mt-3 flex justify-end">\n          <DhButton :disabled="!updateReason.trim()" @click="confirmEditReason">Continuar a Pantalla 3 <ChevronRight class="h-4 w-4" /></DhButton>\n        </div>\n      </div>\n      <div v-else-if="!viewOnly" class="mt-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">\n        <div class="flex flex-wrap items-center justify-between gap-3">\n          <div class="min-w-0">\n            <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Motivo de actualización</p>\n            <p class="mt-1 whitespace-pre-wrap text-sm font-bold">{{ updateReason }}</p>\n          </div>\n          <DhButton variant="secondary" @click="reopenEditReason">Cambiar motivo</DhButton>\n        </div>\n      </div>`,
    'edit reason gate UI',
  )

  code = replaceOne(
    code,
    `    <div class="crystal-stepbar grid grid-cols-2 gap-2 p-2 sm:grid-cols-4" :class="viewOnly ? 'xl:grid-cols-9' : 'xl:grid-cols-8'">`,
    `    <div v-if="!isEditing || viewOnly || editReasonConfirmed" class="crystal-stepbar grid grid-cols-2 gap-2 p-2 sm:grid-cols-4" :class="viewOnly ? 'xl:grid-cols-9' : 'xl:grid-cols-8'">`,
    'edit reason stepbar gate',
  )

  code = replaceOne(
    code,
    `    <div class="crystal-footer flex items-center justify-between gap-3 p-3">`,
    `    <div v-if="!isEditing || viewOnly || editReasonConfirmed" class="crystal-footer flex items-center justify-between gap-3 p-3">`,
    'edit reason footer gate',
  )

  const hydrateAnchor = `async function hydrateExistingRate() {`
  const hydrateHelpers = `function confirmEditReason() {\n  const reason = updateReason.value.trim()\n  if (!reason) {\n    toastStore.warning('Motivo requerido', 'Indique el motivo de la actualización antes de continuar.')\n    return\n  }\n  updateReason.value = reason\n  editReasonConfirmed.value = true\n  step.value = 3\n}\n\nfunction reopenEditReason() {\n  if (props.viewOnly) return\n  editReasonConfirmed.value = false\n  step.value = 0\n}\n\nfunction persistedEditTermLines(value?: string | null) {\n  return String(value ?? '')\n    .split(/\\r?\\n/)\n    .map((line) => normalizeCatalogValue(line))\n    .filter(Boolean)\n}\n\nfunction persistedEditTermContains(lines: string[], ...terms: string[]) {\n  const normalizedTerms = terms.map((term) => normalizeCatalogValue(term)).filter(Boolean)\n  return lines.some((line) => normalizedTerms.some((term) => line.includes(term)))\n}\n\nfunction hydrateEditSelectionsFromRate(rate: RateDto) {\n  // Only persisted commercial selections are authoritative here. Never infer Screen 4\n  // toggles from every RateDetail: configured optional costs can exist in the snapshot\n  // without having been selected by the user.\n  const subjectLines = persistedEditTermLines(rate.subjectTo)\n  const includeLines = persistedEditTermLines(rate.includes)\n\n  form.dangerousCargo = persistedEditTermContains(subjectLines, 'carga peligrosa', 'dangerous cargo', 'hazmat')\n  form.nonStackable = persistedEditTermContains(subjectLines, 'carga no estibable', 'non stackable', 'nonstackable')\n  form.overweight = persistedEditTermContains(subjectLines, 'sobrepeso', 'sobre peso', 'overweight', 'over weight')\n\n  const merchantSelected = persistedEditTermContains(includeLines, 'merchant haulage', 'inland gam merchant')\n  const carrierSelected = persistedEditTermContains(includeLines, 'carrier haulage', 'inland gam naviera')\n\n  // These controls are mutually exclusive. If legacy data contains both labels, do not\n  // invent a selection; let Pricing choose explicitly during the edit.\n  form.merchantHaulage = merchantSelected && !carrierSelected\n  form.carrierHaulage = carrierSelected && !merchantSelected\n\n  const hasAnticipado = persistedEditTermContains(includeLines, 'anticipado')\n  const hasRedestino = persistedEditTermContains(includeLines, 'redestino')\n  form.portHandlingMode = hasAnticipado === hasRedestino\n    ? ''\n    : hasAnticipado\n      ? 'Anticipado'\n      : 'Redestino'\n}\n\nfunction relinkExistingDetailIdsForEdit() {\n  if (!editingRate.value || props.viewOnly) return\n\n  const remaining = [...editingRate.value.rateDetails]\n  const takeMatch = (line: RateLine) => {\n    let index = -1\n    if (line.costId) {\n      index = remaining.findIndex((detail) => detail.costId === line.costId)\n    }\n    if (index < 0) {\n      index = remaining.findIndex((detail) =>\n        detail.costDetailType === line.costDetailType\n        && normalizeCatalogValue(detail.name) === normalizeCatalogValue(line.name),\n      )\n    }\n    if (index < 0 && line.costDetailType === 'Freight') {\n      index = remaining.findIndex((detail) => detail.costDetailType === 'Freight')\n    }\n    if (index < 0) return null\n    const [match] = remaining.splice(index, 1)\n    return match\n  }\n\n  rateLines.value.forEach((line) => {\n    if (line.detailId) return\n    const match = takeMatch(line)\n    if (match) line.detailId = match.id\n  })\n}\n\n${hydrateAnchor}`
  code = replaceOne(code, hydrateAnchor, hydrateHelpers, 'edit hydration helpers')

  code = replaceOne(
    code,
    `    form.cargoHeightCm = Number(rate.cargoLines?.[0]?.heightCm ?? 0)\n\n    rateLines.value = rate.rateDetails.map((detail) => {`,
    `    form.cargoHeightCm = Number(rate.cargoLines?.[0]?.heightCm ?? 0)\n    hydrateEditSelectionsFromRate(rate)\n\n    rateLines.value = rate.rateDetails.map((detail) => {`,
    'screen 4 selection hydration',
  )

  // The commercial-terms plugin expands the original step watcher. Insert dedicated edit
  // guards before it: one keeps persisted detail IDs, the other guarantees that hydration
  // finishes behind the reason gate even if older runtime/draft code restored another step.
  const stepWatchAnchor = `watch(step, (value) => {`
  code = replaceOne(
    code,
    stepWatchAnchor,
    `watch(loadingExistingRate, (loading) => {\n  if (!loading && props.rateId && !props.viewOnly && editingRate.value && !editReasonConfirmed.value) {\n    step.value = 0\n  }\n})\n\nwatch(step, (value) => {\n  if (value === 7 && props.rateId && !props.viewOnly) {\n    relinkExistingDetailIdsForEdit()\n  }\n})\n\n${stepWatchAnchor}`,
    'edit hydration and screen 7 guards',
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
    `function openEdit(rate: RateDto) {\n  if (!canUpdateRate(rate)) {\n    toastStore.warning('Permiso requerido', 'Necesita permiso para actualizar tarifas.')\n    return\n  }\n  toastStore.info('Actualización de tarifa', 'Indique el motivo del cambio para continuar a la Pantalla 3.')\n  router.push({ name: 'pricing-rate-wizard', params: { rateId: rate.id }, query: { mode: 'edit' } })\n}`,
    'rate edit action',
  )

  return code
}

export function pricingRateEditCreateParity(): Plugin {
  return {
    name: 'dhole-pricing-rate-edit-create-parity',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(RATES_VIEW_PATH)) return { code: patchRatesView(source), map: null }
      return null
    },
  }
}
