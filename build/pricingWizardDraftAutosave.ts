import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardDraftAutosave] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  const stateAnchor = `const fclSelectedImportRateIds = ref<Record<string, string>>({})`
  const draftState = `const fclSelectedImportRateIds = ref<Record<string, string>>({})

const PRICING_DRAFT_VERSION = 1
const PRICING_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const pricingDraftReady = ref(false)
const pricingDraftRestoring = ref(false)
const pricingDraftState = ref<'idle' | 'dirty' | 'saved' | 'error'>('idle')
const pricingDraftSavedAt = ref('')
let pricingDraftTimer: ReturnType<typeof setTimeout> | null = null
let pricingDraftLastSnapshot = ''

const pricingDraftEnabled = computed(() => !props.viewOnly)
const pricingDraftStorageKey = computed(() => {
  const scope = props.rateId
    ? 'rate:' + props.rateId
    : props.rateRequestId
      ? 'request:' + props.rateRequestId
      : props.sellerRequestMode
        ? 'seller:new'
        : 'pricing:new'
  return 'dhole:pricing-wizard:draft:v1:' + scope
})

const pricingDraftStatusLabel = computed(() => {
  if (pricingDraftState.value === 'error') return 'No se pudo guardar el borrador en este navegador.'
  if (pricingDraftState.value === 'dirty') return 'Guardando cambios…'
  if (!pricingDraftSavedAt.value) return 'Los cambios se guardan automáticamente mientras completa la tarifa.'
  const saved = new Date(pricingDraftSavedAt.value)
  const time = Number.isNaN(saved.getTime())
    ? ''
    : saved.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
  return time ? 'Borrador guardado a las ' + time : 'Borrador guardado.'
})

function pricingDraftHasContent() {
  return Boolean(
    form.modality ||
    form.shipmentMode ||
    form.clientName.trim() ||
    form.executiveName.trim() ||
    form.originId ||
    form.destinationId ||
    form.podId ||
    form.equipmentId ||
    form.incotermId ||
    form.serviceIds.length ||
    rateLines.value.length ||
    fclExtraContainers.value.length ||
    lclSelectedSource.value,
  )
}

function pricingDraftPayload() {
  return {
    version: PRICING_DRAFT_VERSION,
    savedAt: new Date().toISOString(),
    step: step.value,
    form: JSON.parse(JSON.stringify(form)),
    supportEntityId: supportEntityId.value,
    supportDocuments: JSON.parse(JSON.stringify(supportDocuments.value)),
    rateLines: JSON.parse(JSON.stringify(rateLines.value)),
    availableRates: JSON.parse(JSON.stringify(availableRates.value)),
    rateCarrierFilter: rateCarrierFilter.value,
    fclExtraContainers: JSON.parse(JSON.stringify(fclExtraContainers.value)),
    fclRatesByContainer: JSON.parse(JSON.stringify(fclRatesByContainer.value)),
    selectedFclBundleKey: selectedFclBundleKey.value,
    fclSelectedImportRateIds: JSON.parse(JSON.stringify(fclSelectedImportRateIds.value)),
    lclSelectedSourceKey: lclSelectedSourceKey.value,
    lclRequestedCbm: lclRequestedCbm.value,
    lclSelectedSource: lclSelectedSource.value ? JSON.parse(JSON.stringify(lclSelectedSource.value)) : null,
    draftCommercialTerms: JSON.parse(JSON.stringify(draftCommercialTerms.value)),
    rateRequestPriority: rateRequestPriority.value,
    requestedPoeName: requestedPoeName.value,
    requestedPodName: requestedPodName.value,
  }
}

function clearPricingDraft(stopAutosave = false) {
  if (pricingDraftTimer) {
    clearTimeout(pricingDraftTimer)
    pricingDraftTimer = null
  }
  try {
    localStorage.removeItem(pricingDraftStorageKey.value)
  } catch {
    // Storage can be blocked by browser privacy policies; clearing remains best-effort.
  }
  pricingDraftLastSnapshot = ''
  pricingDraftSavedAt.value = ''
  pricingDraftState.value = 'idle'
  if (stopAutosave) pricingDraftReady.value = false
}

function savePricingDraftNow() {
  if (!pricingDraftEnabled.value || !pricingDraftReady.value || pricingDraftRestoring.value) return
  if (!pricingDraftHasContent()) {
    clearPricingDraft(false)
    return
  }

  try {
    const payload = pricingDraftPayload()
    const serialized = JSON.stringify(payload)
    if (serialized === pricingDraftLastSnapshot) {
      pricingDraftState.value = 'saved'
      return
    }
    localStorage.setItem(pricingDraftStorageKey.value, serialized)
    pricingDraftLastSnapshot = serialized
    pricingDraftSavedAt.value = payload.savedAt
    pricingDraftState.value = 'saved'
  } catch {
    pricingDraftState.value = 'error'
  }
}

function schedulePricingDraftSave() {
  if (!pricingDraftEnabled.value || !pricingDraftReady.value || pricingDraftRestoring.value) return
  pricingDraftState.value = 'dirty'
  if (pricingDraftTimer) clearTimeout(pricingDraftTimer)
  pricingDraftTimer = setTimeout(() => {
    pricingDraftTimer = null
    savePricingDraftNow()
  }, 650)
}

async function restorePricingDraft() {
  if (!pricingDraftEnabled.value) return
  let raw = ''
  try {
    raw = localStorage.getItem(pricingDraftStorageKey.value) || ''
  } catch {
    pricingDraftState.value = 'error'
    return
  }
  if (!raw) return

  try {
    const draft = JSON.parse(raw) as Record<string, any>
    const savedAt = new Date(String(draft.savedAt ?? ''))
    if (
      Number(draft.version) !== PRICING_DRAFT_VERSION ||
      Number.isNaN(savedAt.getTime()) ||
      Date.now() - savedAt.getTime() > PRICING_DRAFT_MAX_AGE_MS
    ) {
      clearPricingDraft(false)
      return
    }

    pricingDraftRestoring.value = true
    if (draft.form && typeof draft.form === 'object') Object.assign(form, draft.form)
    if (Array.isArray(draft.supportDocuments)) supportDocuments.value = draft.supportDocuments
    if (typeof draft.supportEntityId === 'string' && draft.supportEntityId) supportEntityId.value = draft.supportEntityId
    if (Array.isArray(draft.rateLines)) rateLines.value = draft.rateLines
    if (Array.isArray(draft.availableRates)) availableRates.value = draft.availableRates
    if (typeof draft.rateCarrierFilter === 'string') rateCarrierFilter.value = draft.rateCarrierFilter
    if (Array.isArray(draft.fclExtraContainers)) fclExtraContainers.value = draft.fclExtraContainers
    if (draft.fclRatesByContainer && typeof draft.fclRatesByContainer === 'object') fclRatesByContainer.value = draft.fclRatesByContainer
    if (typeof draft.selectedFclBundleKey === 'string') selectedFclBundleKey.value = draft.selectedFclBundleKey
    if (draft.fclSelectedImportRateIds && typeof draft.fclSelectedImportRateIds === 'object') {
      fclSelectedImportRateIds.value = draft.fclSelectedImportRateIds
    }
    if (typeof draft.lclSelectedSourceKey === 'string') lclSelectedSourceKey.value = draft.lclSelectedSourceKey
    if (Number.isFinite(Number(draft.lclRequestedCbm))) lclRequestedCbm.value = Number(draft.lclRequestedCbm)
    if (draft.lclSelectedSource && typeof draft.lclSelectedSource === 'object') lclSelectedSource.value = draft.lclSelectedSource
    if (draft.draftCommercialTerms && typeof draft.draftCommercialTerms === 'object') {
      draftCommercialTerms.value = draft.draftCommercialTerms
      draftCommercialTermsInitialized.value = true
    }
    if (['Green', 'Yellow', 'Red'].includes(String(draft.rateRequestPriority))) {
      rateRequestPriority.value = String(draft.rateRequestPriority) as SellerRateRequestPriority
    }
    if (typeof draft.requestedPoeName === 'string') requestedPoeName.value = draft.requestedPoeName
    if (typeof draft.requestedPodName === 'string') requestedPodName.value = draft.requestedPodName

    const minimumStep = props.rateRequestId ? 5 : 1
    const maximumStep = props.sellerRequestMode ? 4 : maxStep.value
    const restoredStep = Math.trunc(Number(draft.step || minimumStep))
    step.value = Math.min(maximumStep, Math.max(minimumStep, restoredStep))

    if (availableRates.value.length) {
      await loadImportSources(availableRates.value)
    }

    pricingDraftLastSnapshot = raw
    pricingDraftSavedAt.value = String(draft.savedAt)
    pricingDraftState.value = 'saved'
    toastStore.success('Borrador recuperado', 'Se restauró automáticamente la tarifa que estaba en proceso.')
  } catch {
    clearPricingDraft(false)
  } finally {
    pricingDraftRestoring.value = false
  }
}

function discardPricingDraft() {
  clearPricingDraft(false)
  toastStore.success('Borrador descartado', 'Los cambios actuales siguen en pantalla y se volverán a guardar cuando modifique la tarifa.')
}
`
  code = replaceOne(code, stateAnchor, draftState, 'draft state')

  // Seller delegation adds its own line inside onMounted. Anchor only the stable
  // Hacienda tail so draft restore remains compatible with both normal and delegated requests.
  const mountedTailAnchor = `  } else await loadHaciendaExchangeRate(true)\n})`
  const mountedTailReplacement = `  } else await loadHaciendaExchangeRate(true)\n\n  if (!props.viewOnly) {\n    await restorePricingDraft()\n    pricingDraftReady.value = true\n  }\n})`
  code = replaceOne(code, mountedTailAnchor, mountedTailReplacement, 'mounted draft restore')

  const scriptCloseAnchor = `\n</script>`
  const watchers = `

watch(
  [
    () => step.value,
    form,
    supportDocuments,
    rateLines,
    availableRates,
    fclExtraContainers,
    fclRatesByContainer,
    fclSelectedImportRateIds,
    lclSelectedSource,
    draftCommercialTerms,
    () => rateCarrierFilter.value,
    () => selectedFclBundleKey.value,
    () => lclSelectedSourceKey.value,
    () => lclRequestedCbm.value,
    () => rateRequestPriority.value,
    () => requestedPoeName.value,
    () => requestedPodName.value,
  ],
  () => schedulePricingDraftSave(),
  { deep: true },
)

`
  code = replaceOne(code, scriptCloseAnchor, watchers + scriptCloseAnchor, 'draft watcher')

  const finalSaveAnchor = `    createdRateId.value = rateId\n    await router.push({ name: 'pricing-rates' })`
  if (code.includes(finalSaveAnchor)) {
    code = code.replace(
      finalSaveAnchor,
      `    clearPricingDraft(true)\n    createdRateId.value = rateId\n    await router.push({ name: 'pricing-rates' })`,
    )
  }

  const sellerSubmitAnchor = `    resetWizard()\n    rateRequestPriority.value = 'Green'`
  if (code.includes(sellerSubmitAnchor)) {
    code = code.replace(
      sellerSubmitAnchor,
      `    clearPricingDraft(true)\n    resetWizard()\n    rateRequestPriority.value = 'Green'`,
    )
  }

  const headerAnchor = `    <DhPageHeader\n      :title="pageTitle"\n      :description="pageDescription"\n    />`
  const headerReplacement = `    <DhPageHeader\n      :title="pageTitle"\n      :description="pageDescription"\n    />\n\n    <div\n      v-if="pricingDraftEnabled"\n      class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[rgb(var(--dh-primary-rgb)/0.035)] px-4 py-3"\n    >\n      <div class="min-w-0">\n        <div class="flex flex-wrap items-center gap-2">\n          <span class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Borrador automático</span>\n          <span\n            v-if="pricingDraftState === 'saved'"\n            class="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-300"\n          >Guardado</span>\n          <span\n            v-else-if="pricingDraftState === 'dirty'"\n            class="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-600 dark:text-amber-300"\n          >Guardando</span>\n        </div>\n        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ pricingDraftStatusLabel }}</p>\n      </div>\n      <DhButton\n        v-if="pricingDraftSavedAt"\n        variant="secondary"\n        size="sm"\n        @click="discardPricingDraft"\n      >Descartar borrador</DhButton>\n    </div>`
  code = replaceOne(code, headerAnchor, headerReplacement, 'draft status UI')

  return code
}

export function pricingWizardDraftAutosave(): Plugin {
  return {
    name: 'dhole-pricing-wizard-draft-autosave',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
