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
    `const route = useRoute()\nconst router = useRouter()\nconst refreshingDuplicatedRate = computed(() => route.query.duplicateReview === '1')\nconst duplicateSourceRateId = computed(() => typeof route.query.duplicateFrom === 'string' ? route.query.duplicateFrom : '')\nconst duplicateValidFrom = computed(() => typeof route.query.validFrom === 'string' ? route.query.validFrom : '')\nconst duplicateValidTo = computed(() => typeof route.query.validTo === 'string' ? route.query.validTo : '')\nconst creatingFromDuplicate = computed(() =>\n  refreshingDuplicatedRate.value && Boolean(duplicateSourceRateId.value) && !props.rateId,\n)`,
    'wizard duplicate review state',
  )

  code = replaceOne(
    code,
    `async function hydrateExistingRate() {\n  if (!props.rateId) return`,
    `async function hydrateExistingRate() {\n  const rateToHydrateId = duplicateSourceRateId.value || props.rateId\n  if (!rateToHydrateId) return`,
    'duplicate source hydration entry',
  )

  code = replaceOne(
    code,
    `      PricingService.getRate(props.rateId),\n      PricingService.getRateRevisions(props.rateId).catch(() => [] as RateRevisionDto[]),`,
    `      PricingService.getRate(rateToHydrateId),\n      PricingService.getRateRevisions(rateToHydrateId).catch(() => [] as RateRevisionDto[]),`,
    'duplicate source fetch',
  )

  code = replaceOne(
    code,
    `    editingRate.value = rate\n    rateRevisions.value = revisions`,
    `    editingRate.value = creatingFromDuplicate.value ? null : rate\n    rateRevisions.value = creatingFromDuplicate.value ? [] : revisions`,
    'duplicate create hydration state',
  )

  if (code.includes(`    await loadRateComments(props.rateId)`)) {
    code = code.replace(`    await loadRateComments(props.rateId)`, `    await loadRateComments(rateToHydrateId)`)
  }

  code = replaceOne(
    code,
    `    form.loadDate = String(rate.validFrom).slice(0,10)\n    form.validTo = String(rate.validTo).slice(0,10)\n    form.selectedImportRateId = rate.sourceImportFclRateId ?? ''\n    form.manualRate = !rate.sourceImportFclRateId`,
    `    form.loadDate = creatingFromDuplicate.value\n      ? (duplicateValidFrom.value || todayIso())\n      : String(rate.validFrom).slice(0,10)\n    form.validTo = creatingFromDuplicate.value\n      ? (duplicateValidTo.value || form.loadDate)\n      : String(rate.validTo).slice(0,10)\n    form.selectedImportRateId = creatingFromDuplicate.value ? '' : (rate.sourceImportFclRateId ?? '')\n    form.manualRate = creatingFromDuplicate.value ? false : !rate.sourceImportFclRateId`,
    'duplicate SPOT validity and freight reset',
  )

  const hydrationStepAnchor = code.includes(`    step.value = props.viewOnly ? 9 : 0`)
    ? `    step.value = props.viewOnly ? 9 : 0`
    : `    step.value = props.viewOnly ? 9 : 8`

  code = replaceOne(
    code,
    hydrationStepAnchor,
    `    if (refreshingDuplicatedRate.value && rate.shipmentMode === 'Fcl') {\n      // La tarifa fuente solo sirve para prellenar la configuración previa al flete.\n      // No se conserva ningún snapshot comercial de pantalla 5 en adelante.\n      form.selectedImportRateId = ''\n      form.manualRate = false\n      form.freightCost = 0\n      form.freightSale = 0\n      form.freeDays = 0\n      form.transitDays = 0\n      form.agentId = ''\n      form.carrierId = ''\n      rateLines.value = []\n      form.manualRate = false\n      step.value = 3\n      toastStore.info(\n        'Revise los datos de la tarifa duplicada',\n        creatingFromDuplicate.value\n          ? 'Se copiaron la ruta, el equipo y los datos de carga. Revise la pantalla 3 antes de continuar; el flete marítimo se seleccionará nuevamente en pantalla 5.'\n          : 'Revise la ruta, el equipo, el Incoterm y los servicios antes de continuar. El flete marítimo deberá seleccionarse nuevamente en pantalla 5.',\n      )\n    } else {\n${hydrationStepAnchor}\n    }`,
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
    `  if (currency) form.currencyId = currency.id\n\n  if (refreshingDuplicatedRate.value) {\n    // El nuevo flete define proveedor/moneda y obliga a consultar nuevamente Costs.\n    // No se arrastra ningún cargo o recargo del snapshot de la tarifa aprobada anterior.\n    await loadApplicableCosts()\n    rebuildRateLines()\n  }`,
    'fresh duplicate charges after freight selection',
  )
  code = code.slice(0, chooseStart) + chooseBlock + code.slice(chooseEnd)

  code = replaceOne(
    code,
    `function continueManual() {`,
    `function continueManual() {\n  if (refreshingDuplicatedRate.value && shipmentModeForApi.value === 'Fcl') {\n    toastStore.warning(\n      'Flete marítimo requerido',\n      'Una tarifa FCL duplicada debe seleccionar un flete marítimo vigente en pantalla 5; no se permite continuar con flete manual ni reutilizar el anterior.',\n    )\n    step.value = 5\n    return\n  }`,
    'duplicate manual freight guard',
  )

  code = replaceOne(
    code,
    `async function saveRate() {`,
    `async function saveRate() {\n  if (refreshingDuplicatedRate.value && shipmentModeForApi.value === 'Fcl' && !form.selectedImportRateId) {\n    step.value = 5\n    toastStore.warning(\n      'Seleccione el nuevo flete marítimo',\n      'Antes de crear la nueva tarifa debe escoger un flete vigente en pantalla 5.',\n    )\n    return\n  }`,
    'duplicate save freight guard',
  )

  code = replaceOne(
    code,
    `      await PricingService.updateRate(editingRate.value.id, updatePayload)`,
    `      await PricingService.updateRate(editingRate.value.id, updatePayload)\n      if (refreshingDuplicatedRate.value) {\n        const { duplicateReview: _duplicateReview, duplicateFrom: _duplicateFrom, validFrom: _validFrom, validTo: _validTo, ...remainingQuery } = route.query\n        await router.replace({\n          name: 'pricing-rate-wizard',\n          params: { rateId: editingRate.value.id },\n          query: remainingQuery,\n        })\n      }`,
    'duplicate review query cleanup',
  )

  code = replaceOne(
    code,
    `  if (props.rateId) await hydrateExistingRate()`,
    `  if (props.rateId || duplicateSourceRateId.value) await hydrateExistingRate()`,
    'duplicate source mount hydration',
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
