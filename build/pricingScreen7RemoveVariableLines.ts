import type { Plugin } from 'vite'

const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-screen7-remove-variable-manual-20261013'
const RUNTIME = MARKER + "\nconst removedScreen7LineKeys = ref<string[]>([])\n\nfunction screen7LineIdentityKeys(line: RateLine): string[] {\n  const result = ['key:' + line.key]\n  // Protect different saved lines sharing one CostId: use the persisted row ID.\n  if (line.detailId) result.push('detail:' + line.detailId)\n  else if (line.costId) result.push('cost:' + line.costId)\n  return result\n}\n\nfunction screen7LineWasRemoved(line: RateLine): boolean {\n  return screen7LineIdentityKeys(line).some((key) => removedScreen7LineKeys.value.includes(key))\n}\n\nfunction canRemoveScreen7Line(line: RateLine): boolean {\n  // Include fixed charges in explicit quotation deletions (never modify master).\n  return !props.viewOnly && line.costDetailType !== 'Freight'\n}\n\nfunction removeScreen7Line(line: RateLine) {\n  if (!canRemoveScreen7Line(line)) return\n  removedScreen7LineKeys.value = Array.from(new Set([\n    ...removedScreen7LineKeys.value,\n    ...screen7LineIdentityKeys(line),\n  ]))\n  line.included = false\n}\n\nwatch(\n  [rateLines, removedScreen7LineKeys],\n  () => {\n    rateLines.value.forEach((line) => {\n      if (screen7LineWasRemoved(line) && line.included) line.included = false\n    })\n  },\n  { deep: true, immediate: true, flush: 'sync' },\n)\n"

function replaceOnce(source: string, before: string, after: string, label: string) {
  if (source.split(before).length !== 2)
    throw new Error('[pricingScreen7RemoveVariableLines] Expected one ' + label)
  return source.replace(before, after)
}

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  let code = replaceOnce(source, 'function addManualCharge() {',
    RUNTIME + '\nfunction addManualCharge() {', 'runtime insertion')

  const variableBadge = '<DhBadge v-if="line.costType === \'Variable\'" variant="warning">Variable</DhBadge>'
  const groupButton = variableBadge + '\n                  <button v-if="canRemoveScreen7Line(line)" type="button" class="ml-auto rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-black text-red-500 hover:bg-red-500/10" :aria-label="\'Eliminar línea \' + line.name" @click="removeScreen7Line(line)">Eliminar</button>'
  if (!code.includes(variableBadge)) throw new Error('[pricingScreen7RemoveVariableLines] Group variable badge missing')
  code = code.replace(variableBadge, groupButton)

  const manualButton = '<button v-if="line.manual" type="button" class="h-10 px-2 text-xs font-black text-red-500" @click="rateLines = rateLines.filter((item) => item.key !== line.key)">Eliminar</button>'
  const deleteButton = '<button v-if="canRemoveScreen7Line(line)" type="button" class="h-10 px-2 text-xs font-black text-red-500" :aria-label="\'Eliminar línea \' + line.name" @click="removeScreen7Line(line)">Eliminar</button>'
  if (code.includes(manualButton)) {
    code = code.replace(manualButton, deleteButton)
  } else {
    const manualBadge = '<DhBadge v-if="line.manual" variant="primary">Manual</DhBadge>'
    if (!code.includes(manualBadge)) throw new Error('[pricingScreen7RemoveVariableLines] Manual line badge missing')
    code = code.replace(manualBadge, manualBadge + '\n                  ' + deleteButton)
  }

  code = replaceOnce(code,
    '    rateLines: JSON.parse(JSON.stringify(rateLines.value)),',
    '    rateLines: JSON.parse(JSON.stringify(rateLines.value)),\n    removedScreen7LineKeys: [...removedScreen7LineKeys.value],',
    'draft snapshot')
  code = replaceOnce(code,
    '    if (Array.isArray(draft.rateLines)) rateLines.value = draft.rateLines',
    "    if (Array.isArray(draft.rateLines)) rateLines.value = draft.rateLines\n    removedScreen7LineKeys.value = Array.isArray(draft.removedScreen7LineKeys) ? draft.removedScreen7LineKeys.filter((key: unknown): key is string => typeof key === 'string') : []",
    'draft restoration')
  const draftWatcherAnchor = code.includes('    rateLines,\n    availableRates,')
    ? '    rateLines,\n    availableRates,'
    : '    rateLines,\n    pickupLocations,'
  code = replaceOnce(code,
    draftWatcherAnchor,
    draftWatcherAnchor.replace('    rateLines,\n', '    rateLines,\n    removedScreen7LineKeys,\n'),
    'draft change watcher')
  code = replaceOnce(code,
    'function resetWizard() {\n',
    'function resetWizard() {\n  removedScreen7LineKeys.value = []\n',
    'reset wizard')
  return code
}

export function pricingScreen7RemoveVariableLines(): Plugin {
  return {
    name: 'dhole-pricing-screen7-remove-variable-manual-lines',
    transform(source, id) {
      if (id.includes('?')) return null
      if (!id.replaceAll('\\', '/').endsWith(WIZARD)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
