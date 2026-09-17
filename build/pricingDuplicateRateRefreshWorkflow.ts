import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const RATES_VIEW_PATH = '/src/modules/pricing/views/PricingRatesView.vue'
const DETAIL_DRAWER_PATH = '/src/modules/pricing/components/PricingRateDetailDrawer.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingDuplicateRateRefreshWorkflow] Expected one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchRatesView(source: string) {
  return replaceOne(
    source,
    `    props: { rate, onSaved: load },`,
    `    props: {\n      rate,\n      onDuplicated: async (duplicatedRateId: string) => {\n        await load()\n        await router.push({\n          name: 'pricing-rate-wizard',\n          params: { rateId: duplicatedRateId },\n          query: { mode: 'edit', duplicateReview: '1' },\n        })\n      },\n    },`,
    'rates view duplicate callback',
  )
}

function patchDetailDrawer(source: string) {
  let code = source
  code = replaceOne(
    code,
    `import { computed, onMounted, ref } from 'vue'`,
    `import { computed, onMounted, ref } from 'vue'\nimport { useRouter } from 'vue-router'`,
    'detail drawer router import',
  )
  code = replaceOne(
    code,
    `const toastStore = useToastStore()`,
    `const toastStore = useToastStore()\nconst router = useRouter()`,
    'detail drawer router state',
  )

  const oldCallback = `      onDuplicated: async (duplicatedRateId: string) => {\n        const duplicatedRate = await PricingService.getRate(duplicatedRateId)\n        drawerStore.open({\n          title: 'Revisar tarifa duplicada',\n          component: PricingRateFormDrawer,\n          size: 'full',\n          props: {\n            rate: duplicatedRate,\n            onSaved: async () => {\n              await props.onSaved?.()\n            },\n          },\n        })\n        await props.onSaved?.()\n      },`
  const newCallback = `      onDuplicated: async (duplicatedRateId: string) => {\n        drawerStore.close()\n        await props.onSaved?.()\n        await router.push({\n          name: 'pricing-rate-wizard',\n          params: { rateId: duplicatedRateId },\n          query: { mode: 'edit', duplicateReview: '1' },\n        })\n      },`

  return replaceOne(code, oldCallback, newCallback, 'detail drawer duplicate callback')
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `import { useRouter } from 'vue-router'`,
    `import { useRoute, useRouter } from 'vue-router'`,
    'wizard route import',
  )
  code = replaceOne(
    code,
    `const router = useRouter()`,
    `const route = useRoute()\nconst router = useRouter()\nconst refreshingDuplicatedRate = computed(() => route.query.duplicateReview === '1')`,
    'wizard duplicate review state',
  )

  const hydrationStepAnchor = code.includes(`    step.value = props.viewOnly ? 9 : 0`)
    ? `    step.value = props.viewOnly ? 9 : 0`
    : `    step.value = props.viewOnly ? 9 : 8`

  code = replaceOne(
    code,
    hydrationStepAnchor,
    `    if (refreshingDuplicatedRate.value && rate.shipmentMode === 'Fcl') {\n      // Una tarifa duplicada conserva la ruta y la vigencia solicitada, pero no reutiliza\n      // el flete anterior. Se consulta nuevamente el pool vigente para esa fecha/ruta/equipo.\n      form.selectedImportRateId = ''\n      form.manualRate = false\n      form.freightCost = 0\n      form.freightSale = 0\n      form.freeDays = 0\n      form.transitDays = 0\n      rateLines.value = rateLines.value.filter((line) => line.costDetailType !== 'Freight')\n      await searchApprovedRates()\n      form.manualRate = false\n      step.value = 5\n      toastStore.info(\n        'Seleccione un flete marítimo actualizado',\n        'La vigencia se conserva, pero debe escoger nuevamente el flete. Los cargos y recargos se cargarán con la configuración vigente.',\n      )\n    } else {\n${hydrationStepAnchor}\n    }`,
    'wizard hydration navigation',
  )

  const chooseStart = code.indexOf(`function chooseRate(rate: ImportRateSelectDto) {`)
  const chooseEnd = code.indexOf(`function continueManual() {`, chooseStart)
  if (chooseStart < 0 || chooseEnd < 0) {
    throw new Error('[pricingDuplicateRateRefreshWorkflow] Imported freight selection block not found.')
  }

  let chooseBlock = code.slice(chooseStart, chooseEnd)
  chooseBlock = replaceOne(
    chooseBlock,
    `function chooseRate(rate: ImportRateSelectDto) {`,
    `async function chooseRate(rate: ImportRateSelectDto) {`,
    'choose rate async signature',
  )
  chooseBlock = replaceOne(
    chooseBlock,
    `  if (currency) form.currencyId = currency.id`,
    `  if (currency) form.currencyId = currency.id\n\n  if (refreshingDuplicatedRate.value) {\n    // Descartar snapshots automáticos de la copia y reconstruirlos contra Costs vigente.\n    // Los rubros manuales no relacionados al flete sí se conservan.\n    const preservedManualLines = rateLines.value.filter(\n      (line) => line.manual && line.costDetailType !== 'Freight',\n    )\n    await loadApplicableCosts()\n    rebuildRateLines()\n    for (const manualLine of preservedManualLines) {\n      const alreadyPresent = rateLines.value.some((line) =>\n        line.costDetailType === manualLine.costDetailType\n        && normalizeCatalogValue(line.name) === normalizeCatalogValue(manualLine.name),\n      )\n      if (!alreadyPresent) rateLines.value.push(manualLine)\n    }\n  }`,
    'fresh duplicate charges after freight selection',
  )
  code = code.slice(0, chooseStart) + chooseBlock + code.slice(chooseEnd)

  code = replaceOne(
    code,
    `function continueManual() {`,
    `function continueManual() {\n  if (refreshingDuplicatedRate.value && shipmentModeForApi.value === 'Fcl') {\n    toastStore.warning(\n      'Flete marítimo requerido',\n      'Una tarifa FCL duplicada debe seleccionar nuevamente un flete marítimo vigente; no se permite reutilizar ni continuar manualmente con el flete anterior.',\n    )\n    step.value = 5\n    return\n  }`,
    'duplicate manual freight guard',
  )

  code = replaceOne(
    code,
    `async function saveRate() {`,
    `async function saveRate() {\n  if (refreshingDuplicatedRate.value && shipmentModeForApi.value === 'Fcl' && !form.selectedImportRateId) {\n    step.value = 5\n    toastStore.warning(\n      'Seleccione el nuevo flete marítimo',\n      'Antes de guardar la tarifa duplicada debe escoger un flete vigente para la nueva vigencia.',\n    )\n    return\n  }`,
    'duplicate save freight guard',
  )

  code = replaceOne(
    code,
    `      await PricingService.updateRate(editingRate.value.id, updatePayload)`,
    `      await PricingService.updateRate(editingRate.value.id, updatePayload)\n      if (refreshingDuplicatedRate.value) {\n        const { duplicateReview: _duplicateReview, ...remainingQuery } = route.query\n        await router.replace({\n          name: 'pricing-rate-wizard',\n          params: { rateId: editingRate.value.id },\n          query: remainingQuery,\n        })\n      }`,
    'duplicate review query cleanup',
  )

  return code
}

export function pricingDuplicateRateRefreshWorkflow(): Plugin {
  return {
    name: 'dhole-pricing-duplicate-rate-refresh-workflow',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]

      if (normalizedId.endsWith(WIZARD_PATH)) {
        return { code: patchWizard(source), map: null }
      }
      if (normalizedId.endsWith(RATES_VIEW_PATH)) {
        return { code: patchRatesView(source), map: null }
      }
      if (normalizedId.endsWith(DETAIL_DRAWER_PATH)) {
        return { code: patchDetailDrawer(source), map: null }
      }
      return null
    },
  }
}
