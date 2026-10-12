import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(code: string, before: string, after: string, label: string): string {
  const occurrences = code.split(before).length - 1
  if (occurrences !== 1) {
    throw new Error('[pricingCustomsOnlyWizard] ' + label + ': expected 1 anchor, found ' + occurrences)
  }
  return code.replace(before, after)
}

function hideFreightInput(tag: string): string {
  const conditional = /\bv-(?:else-)?if="([^"]+)"/
  if (conditional.test(tag)) {
    return tag.replace(conditional, (_match, expression: string) =>
      'v-if="hasInternationalTransportService && (' + expression + ')"')
  }
  return tag.replace('<DhInput', '<DhInput v-if="hasInternationalTransportService"')
}

function patchWizard(source: string): string {
  let code = source

  const serviceAnchor =
    'const selectedServices = computed(() => catalogs.services.filter((item) => form.serviceIds.includes(item.id)))'
  code = replaceRequired(code, serviceAnchor, serviceAnchor + [
    '',
    'const hasInternationalTransportService = computed(() => selectedServices.value.some((item) => {',
    "  const label = normalizeCatalogValue(displayValue(item))",
    "  const code = String(item.code ?? '').trim().toUpperCase()",
    "  return label.includes('transporte internacional') || code === 'INT_TRANSPORT'",
    '}))',
    '',
    'watch([hasInternationalTransportService, step], () => {',
    '  if (!hasInternationalTransportService.value && step.value === 5) step.value = 6',
    '  if (!hasInternationalTransportService.value && step.value === 7) {',
    "    rateLines.value = rateLines.value.filter((line) => line.costDetailType !== 'Freight' && line.section !== 'international_freight')",
    '  }',
    '})',
    '',
  ].join('\n'), 'service detection')

  code = replaceRequired(
    code,
    "const visibleStepTitles = computed(() => props.viewOnly ? [...stepTitles, 'Vista completa'] : stepTitles)\nconst maxStep = computed(() => visibleStepTitles.value.length)",
    [
      'const visibleWizardSteps = computed(() => {',
      '  const steps = hasInternationalTransportService.value',
      '    ? [1, 2, 3, 4, 5, 6, 7, 8]',
      '    : [1, 2, 3, 4, 6, 7, 8]',
      '  return props.viewOnly ? [...steps, 9] : steps',
      '})',
      "const visibleStepTitles = computed(() => visibleWizardSteps.value.map((stepNumber) => stepNumber === 9 ? 'Vista completa' : stepTitles[stepNumber - 1]))",
      'const maxStep = computed(() => props.viewOnly ? 9 : 8)',
    ].join('\n'),
    'visible wizard steps',
  )

  code = replaceRequired(
    code,
    "'crystal-step--active': index + 1 === step,",
    "'crystal-step--active': visibleWizardSteps[index] === step,",
    'step bar active',
  )
  code = replaceRequired(
    code,
    "'crystal-step--done': index + 1 < step,",
    "'crystal-step--done': visibleWizardSteps[index] < step,",
    'step bar completed',
  )
  code = replaceRequired(
    code,
    '@click="goToStep(index + 1)"',
    '@click="goToStep(visibleWizardSteps[index])"',
    'step bar navigation',
  )
  code = replaceRequired(
    code,
    '{{ step }} / {{ maxStep }}',
    '{{ visibleWizardSteps.indexOf(step) + 1 }} / {{ visibleWizardSteps.length }}',
    'visible step counter',
  )
  code = replaceRequired(
    code,
    ':class="viewOnly ? \'xl:grid-cols-9\' : \'xl:grid-cols-8\'"',
    ':class="hasInternationalTransportService ? (viewOnly ? \'xl:grid-cols-9\' : \'xl:grid-cols-8\') : (viewOnly ? \'xl:grid-cols-8\' : \'xl:grid-cols-7\')"',
    'step bar columns',
  )

  code = replaceRequired(
    code,
    'function goToStep(target: number) {',
    'function goToStep(target: number) {\n  if (!visibleWizardSteps.value.includes(target)) return',
    'direct navigation guard',
  )
  code = replaceRequired(
    code,
    'async function next() {',
    [
      'async function next() {',
      '  if (step.value === 4 && !hasInternationalTransportService.value) {',
      '    if (!canNext.value) return',
      "    form.selectedImportRateId = ''",
      '    form.manualRate = true',
      '    form.freightCost = 0',
      '    form.freightSale = 0',
      '    form.freeDays = 0',
      '    form.transitDays = 0',
      '    step.value = 6',
      '    return',
      '  }',
    ].join('\n'),
    'skip international rate selection',
  )
  code = replaceRequired(
    code,
    'function previous() {',
    'function previous() {\n  if (step.value === 6 && !hasInternationalTransportService.value) {\n    step.value = 4\n    return\n  }',
    'return to cargo',
  )
  code = replaceRequired(
    code,
    'const canNext = computed(() => {',
    [
      'const canNext = computed(() => {',
      '  if (step.value === 6 && !hasInternationalTransportService.value) {',
      "    if (form.modality === 'Land') return Boolean(form.currencyId)",
      '    return Boolean(form.agentId && form.carrierId && form.currencyId)',
      '  }',
    ].join('\n'),
    'customs provider validation',
  )

  code = replaceRequired(
    code,
    'const includedLines = computed(() => rateLines.value.filter((line) => line.included && lineMatchesPickupCargoCondition(line)))',
    "const includedLines = computed(() => rateLines.value.filter((line) => (hasInternationalTransportService.value || (line.costDetailType !== 'Freight' && line.section !== 'international_freight')) && line.included && lineMatchesPickupCargoCondition(line)))",
    'exclude freight from customs rate payload',
  )

  // Other pricing plugins can insert freight rows during rebuilding; remove them
  // at the final assignment rather than relying on a particular freight source.
  const rebuildStart = code.indexOf('function rebuildRateLines() {')
  const rebuildAssignment = code.indexOf('  rateLines.value = lines', rebuildStart)
  if (rebuildStart < 0 || rebuildAssignment < 0) {
    throw new Error('[pricingCustomsOnlyWizard] Cannot locate rebuilt rate lines')
  }
  code = code.slice(0, rebuildAssignment) + [
    '  if (!hasInternationalTransportService.value) {',
    '    for (let i = lines.length - 1; i >= 0; i -= 1) {',
    "      if (lines[i]?.costDetailType === 'Freight' || lines[i]?.section === 'international_freight') lines.splice(i, 1)",
    '    }',
    '  }',
    '',
  ].join('\n') + code.slice(rebuildAssignment)

  const screenSixStart = code.indexOf('<div v-else-if="step === 6" class="space-y-6">')
  const screenSixEnd = code.indexOf('<div v-else-if="step === 4" class="space-y-6">', screenSixStart)
  if (screenSixStart < 0 || screenSixEnd <= screenSixStart) {
    throw new Error('[pricingCustomsOnlyWizard] Screen 6 provider panel not found')
  }
  let six = code.slice(screenSixStart, screenSixEnd)
  six = six.replace(
    /<h2 class="crystal-title">[\s\S]*?<\/h2>/,
    "<h2 class=\"crystal-title\">{{ !hasInternationalTransportService ? 'Agente y naviera' : form.modality === 'Land' ? 'Flete terrestre' : 'Proveedor y flete internacional' }}</h2>",
  )

  let freightInputs = 0
  six = six.replace(
    /<DhInput\b[^>]*v-model\.number="form\.(?:freightCost|freightSale|freeDays|transitDays)"[^>]*\/>/g,
    (tag) => { freightInputs += 1; return hideFreightInput(tag) },
  )
  if (freightInputs < 3) {
    throw new Error('[pricingCustomsOnlyWizard] Missing freight, free days or transit controls')
  }
  six = six.replace(
    'v-else-if="form.modality !== \'Land\'"',
    'v-else-if="hasInternationalTransportService && form.modality !== \'Land\'"',
  )
  six = six.replace(
    '<div class="crystal-route-summary grid gap-3 md:grid-cols-4">',
    '<div v-if="hasInternationalTransportService" class="crystal-route-summary grid gap-3 md:grid-cols-4">',
  )
  six = six.replace(
    'v-if="shipmentModeForApi === \'Fcl\' && (form.modality === \'Maritime\'',
    'v-if="hasInternationalTransportService && shipmentModeForApi === \'Fcl\' && (form.modality === \'Maritime\'',
  )

  // Customs-only quotes still choose a carrier and agent in non-land modalities,
  // even if an LCL-specific freight selector would otherwise hide the carrier.
  six = six.replace(
    /<DhSelect\b[^>]*v-model="form\.carrierId"[^>]*\/>/g,
    (tag) => tag.replace(
      /v-if="([^"]+)"/,
      (_match, condition: string) =>
        'v-if="form.modality !== \'Land\' && (!hasInternationalTransportService || (' + condition + '))"',
    ),
  )
  code = code.slice(0, screenSixStart) + six + code.slice(screenSixEnd)

  // No international-freight metadata should survive in a customs-only quote.
  code = code.replace(
    "freeDays: (form.modality === 'Land' || shipmentModeForApi.value === 'Lcl') ? 0 : number(form.freeDays),",
    "freeDays: (!hasInternationalTransportService.value || form.modality === 'Land' || shipmentModeForApi.value === 'Lcl') ? 0 : number(form.freeDays),",
  )
  code = code.replace(
    'transitTime: form.transitDays > 0 ?',
    'transitTime: hasInternationalTransportService.value && form.transitDays > 0 ?',
  )
  code = code.replace(
    'v-if="editingRate.shipmentMode !== \'Lcl\'"',
    'v-if="hasInternationalTransportService && editingRate.shipmentMode !== \'Lcl\'"',
  )
  code = code.replace(
    '<p class="mt-1 text-sm font-bold">Tránsito: {{ editingRate.transitTime || \'Por confirmar\' }}</p>',
    '<p v-if="hasInternationalTransportService" class="mt-1 text-sm font-bold">Tránsito: {{ editingRate.transitTime || \'Por confirmar\' }}</p>',
  )
  return code
}

export function pricingCustomsOnlyWizard(): Plugin {
  return {
    name: 'dhole-pricing-customs-only-wizard',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
