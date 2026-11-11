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
  return source
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
    `import { useRoute, useRouter } from 'vue-router'\nimport { validateDuplicatedFclFreight } from '@/modules/pricing/utils/pricingDuplicatedFclFreightValidation'`,
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
    `async function hydrateExistingRate() {`,
    `async function hydrateExistingRate() {\n  const rateToHydrateId = duplicateSourceRateId.value || props.rateId`,
    'duplicate source hydration state',
  )
  code = replaceOne(
    code,
    `  if (!props.rateId) return`,
    `  if (!rateToHydrateId) return`,
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
    `    if (refreshingDuplicatedRate.value && rate.shipmentMode === 'Fcl') {\n      // La tarifa fuente solo sirve para prellenar la configuración previa al flete.\n      // No se conserva ningún snapshot comercial de pantalla 5 en adelante.\n      form.selectedImportRateId = ''\n      form.manualRate = false\n      form.freightCost = 0\n      form.freightSale = 0\n      form.freeDays = 0\n      form.transitDays = 0\n      form.agentId = ''\n      form.carrierId = ''\n      rateLines.value = []\n      // Extra container freight belongs to the previous quote, not the duplicate.\n      fclExtraContainers.value.forEach((row) => {\n        row.freightCostAmount = 0\n        row.freightSaleAmount = 0\n        row.freightTouched = false\n      })\n      form.manualRate = false\n      step.value = 3\n      toastStore.info(\n        'Revise los datos de la tarifa duplicada',\n        creatingFromDuplicate.value\n          ? 'Se copiaron la ruta, el equipo y los datos de carga. Revise la pantalla 3 antes de continuar; el flete marítimo se seleccionará nuevamente en pantalla 5.'\n          : 'Revise la ruta, el equipo, el Incoterm y los servicios antes de continuar. El flete marítimo deberá seleccionarse nuevamente en pantalla 5.',\n      )\n    } else {\n${hydrationStepAnchor}\n    }`,
    'wizard hydration navigation',
  )

  const plainChooseSignature = `function chooseRate(rate: ImportRateSelectDto) {`
  const asyncChooseSignature = `async function chooseRate(rate: ImportRateSelectDto) {`
  const asyncChooseStart = code.indexOf(asyncChooseSignature)
  const chooseStart = asyncChooseStart >= 0 ? asyncChooseStart : code.indexOf(plainChooseSignature)
  const chooseEnd = code.indexOf(`function continueManual() {`, chooseStart)
  if (chooseStart < 0 || chooseEnd < 0) {
    throw new Error('[pricingDuplicateRateRefreshWorkflow] Imported freight selection block not found.')
  }

  let chooseBlock = code.slice(chooseStart, chooseEnd)
  if (chooseBlock.startsWith(plainChooseSignature)) {
    chooseBlock = replaceOne(
      chooseBlock,
      plainChooseSignature,
      asyncChooseSignature,
      'choose rate async signature',
    )
  }
  chooseBlock = replaceOne(
    chooseBlock,
    `  if (currency) form.currencyId = currency.id`,
    `  if (currency) form.currencyId = currency.id\n\n  if (refreshingDuplicatedRate.value) {\n    // El nuevo flete define proveedor/moneda y obliga a consultar nuevamente Costs.\n    // No se arrastra ningún cargo o recargo del snapshot de la tarifa aprobada anterior.\n    await loadApplicableCosts()\n    rebuildRateLines()\n  }`,
    'fresh duplicate charges after freight selection',
  )
  code = code.slice(0, chooseStart) + chooseBlock + code.slice(chooseEnd)

  // A different container can have no compatible imported FCL tariff.
  // Preserve continueManual(): manual freight is valid when fully priced.

  code = replaceOne(
    code,
    `async function saveRate() {`,
    `function hasNewDuplicatedFclFreight(): boolean {
  const ready = (
    fields: Pick<typeof form, 'selectedImportRateId' | 'manualRate' | 'agentId' | 'carrierId' | 'currencyId' | 'freightCost' | 'freightSale'>,
    lines: RateLine[],
  ) => validateDuplicatedFclFreight({
    sourceRateId: fields.selectedImportRateId,
    manual: fields.manualRate,
    agentId: fields.agentId,
    carrierId: fields.carrierId,
    currencyId: fields.currencyId,
    freightCost: fields.freightCost,
    freightSale: fields.freightSale,
    lines: lines.map((line) => ({
      type: line.costDetailType,
      included: line.included,
      saleAmount: line.saleAmount,
    })),
  })

  if (multiCarrierSelectionMode.value) {
    // Persist the visible option before checking every selected POE/naviera.
    rememberCurrentCarrierDraft()
    return selectedCarrierRoutes.value.length > 0 && selectedCarrierRoutes.value.every((route) => {
      const draft = optionDrafts.value[carrierRouteKey(route.poeId, route.carrierId)]
      return Boolean(draft && ready(draft.fields, draft.lines))
    })
  }
  return ready(form, rateLines.value)
}

async function saveRate() {
  if (refreshingDuplicatedRate.value && shipmentModeForApi.value === 'Fcl' && !hasNewDuplicatedFclFreight()) {
    step.value = multiCarrierSelectionMode.value && !selectedCarrierRoutes.value.length ? 5 : 6
    toastStore.warning(
      'Complete el nuevo flete marítimo',
      'Seleccione un flete vigente o configure uno manual con agente, naviera, moneda, costo, venta y su línea de flete para cada alternativa. No se reutilizará el anterior.',
    )
    return
  }`,
    'duplicate save freight validation',
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
