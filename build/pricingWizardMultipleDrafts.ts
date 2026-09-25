import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceExactlyOnce(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardMultipleDrafts] Expected one ${label} anchor, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceExactlyOnce(
    code,
    'function discardPricingDraft() {',
    'function discardPricingDraft(showToast = true) {',
    'discard function',
  )

  code = replaceExactlyOnce(
    code,
    "  toastStore.success('Borrador descartado', 'Se limpió la cotización y regresó a Pantalla 1.')",
    "  if (showToast) toastStore.success('Borrador descartado', 'Se limpió la cotización y regresó a Pantalla 1.')",
    'discard toast',
  )

  const scriptCloseAnchor = '\n</script>'
  const multipleDraftsScript = `

type PricingDraftLibraryItem = {
  id: string
  savedAt: string
  clientName: string
  routeLabel: string
  modality: string
  shipmentMode: string
  step: number
}

const pricingDraftLibraryOpen = ref(false)
const pricingDraftLibrary = ref<PricingDraftLibraryItem[]>([])
const pricingDraftActiveId = ref('')
const pricingDraftSupportsMultiple = computed(() => !props.rateId && !props.rateRequestId)

const pricingDraftLibraryOwnerKey = computed(() => {
  const owner = String(authStore.userId || authStore.email || 'anonymous').trim().toLocaleLowerCase()
  return encodeURIComponent(owner || 'anonymous')
})

const pricingDraftLibraryScope = computed(() =>
  props.sellerRequestMode ? 'seller:new' : 'pricing:new',
)

const pricingDraftLibraryPrefix = computed(
  () =>
    'dhole:pricing-wizard:draft-library:v1:' +
    pricingDraftLibraryOwnerKey.value +
    ':' +
    pricingDraftLibraryScope.value,
)

const pricingDraftLibraryIndexKey = computed(() => pricingDraftLibraryPrefix.value + ':index')
const pricingDraftLibraryActiveKey = computed(() => pricingDraftLibraryPrefix.value + ':active')

function pricingDraftLibraryItemKey(id: string) {
  return pricingDraftLibraryPrefix.value + ':item:' + id
}

function pricingDraftLibraryReadIndex(): PricingDraftLibraryItem[] {
  if (!pricingDraftSupportsMultiple.value) return []

  try {
    const raw = localStorage.getItem(pricingDraftLibraryIndexKey.value)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is PricingDraftLibraryItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        Boolean(item.id) &&
        typeof item.savedAt === 'string',
      )
      .map((item) => ({
        id: String(item.id),
        savedAt: String(item.savedAt),
        clientName: String(item.clientName || 'Sin cliente'),
        routeLabel: String(item.routeLabel || 'Ruta pendiente'),
        modality: String(item.modality || ''),
        shipmentMode: String(item.shipmentMode || ''),
        step: Math.max(1, Math.trunc(Number(item.step) || 1)),
      }))
  } catch {
    return []
  }
}

function pricingDraftLibraryWriteIndex(items: PricingDraftLibraryItem[]) {
  localStorage.setItem(pricingDraftLibraryIndexKey.value, JSON.stringify(items))
}

function pricingDraftLibraryLocationLabel(items: CatalogItemSelectDto[], id: unknown) {
  const normalizedId = typeof id === 'string' ? id : ''
  if (!normalizedId) return ''
  const item = findById(items, normalizedId)
  return item ? displayValue(item) || item.label || '' : ''
}

function pricingDraftLibrarySummary(id: string, raw: string): PricingDraftLibraryItem | null {
  try {
    const draft = JSON.parse(raw) as Record<string, any>
    const draftForm =
      draft.form && typeof draft.form === 'object' && !Array.isArray(draft.form)
        ? draft.form as Record<string, any>
        : {}

    const savedAt = String(draft.savedAt || new Date().toISOString())
    const parsedSavedAt = new Date(savedAt)
    if (Number.isNaN(parsedSavedAt.getTime())) return null

    const origin =
      pricingDraftLibraryLocationLabel(catalogs.pol, draftForm.originId) ||
      pricingDraftLibraryLocationLabel(catalogs.poe, draftForm.originId) ||
      'Origen pendiente'
    const destination =
      pricingDraftLibraryLocationLabel(catalogs.pod, draftForm.podId) ||
      pricingDraftLibraryLocationLabel(catalogs.poe, draftForm.destinationId) ||
      'Destino pendiente'

    return {
      id,
      savedAt,
      clientName: String(draftForm.clientName || '').trim() || 'Sin cliente',
      routeLabel: origin + ' → ' + destination,
      modality: String(draftForm.modality || ''),
      shipmentMode: String(draftForm.shipmentMode || ''),
      step: Math.max(1, Math.trunc(Number(draft.step) || 1)),
    }
  } catch {
    return null
  }
}

function refreshPricingDraftLibrary() {
  if (!pricingDraftSupportsMultiple.value) {
    pricingDraftLibrary.value = []
    return
  }

  const now = Date.now()
  const clean: PricingDraftLibraryItem[] = []

  for (const item of pricingDraftLibraryReadIndex()) {
    const savedAt = new Date(item.savedAt).getTime()
    const expired =
      Number.isNaN(savedAt) ||
      now - savedAt > PRICING_DRAFT_MAX_AGE_MS

    let raw = ''
    try {
      raw = localStorage.getItem(pricingDraftLibraryItemKey(item.id)) || ''
    } catch {
      raw = ''
    }

    if (expired || !raw) {
      try {
        localStorage.removeItem(pricingDraftLibraryItemKey(item.id))
      } catch {
        // Best-effort cleanup.
      }
      continue
    }

    clean.push(item)
  }

  clean.sort((left, right) => {
    const leftTime = new Date(left.savedAt).getTime()
    const rightTime = new Date(right.savedAt).getTime()
    return rightTime - leftTime
  })

  pricingDraftLibrary.value = clean

  try {
    pricingDraftLibraryWriteIndex(clean)
  } catch {
    // The library stays readable even if cleanup cannot be persisted.
  }
}

function initializePricingDraftLibrary() {
  if (!pricingDraftSupportsMultiple.value) return

  try {
    let activeId = localStorage.getItem(pricingDraftLibraryActiveKey.value) || ''
    if (!activeId) {
      activeId = crypto.randomUUID()
      localStorage.setItem(pricingDraftLibraryActiveKey.value, activeId)
    }
    pricingDraftActiveId.value = activeId
  } catch {
    pricingDraftActiveId.value = crypto.randomUUID()
  }

  refreshPricingDraftLibrary()
}

function archiveCurrentPricingDraft() {
  if (!pricingDraftSupportsMultiple.value || !pricingDraftHasContent()) return true

  savePricingDraftNow()

  try {
    const raw = localStorage.getItem(pricingDraftStorageKey.value) || ''
    if (!raw) return true

    const id =
      pricingDraftActiveId.value ||
      localStorage.getItem(pricingDraftLibraryActiveKey.value) ||
      crypto.randomUUID()
    const summary = pricingDraftLibrarySummary(id, raw)
    if (!summary) return false

    localStorage.setItem(pricingDraftLibraryItemKey(id), raw)

    const nextIndex = pricingDraftLibraryReadIndex()
      .filter((item) => item.id !== id)
      .concat(summary)
      .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())

    pricingDraftLibraryWriteIndex(nextIndex)
    pricingDraftActiveId.value = id
    localStorage.setItem(pricingDraftLibraryActiveKey.value, id)
    pricingDraftLibrary.value = nextIndex
    return true
  } catch {
    pricingDraftState.value = 'error'
    toastStore.error(
      'No se pudo poner la cotización en espera',
      'El navegador no pudo guardar otro borrador. El borrador actual se mantiene abierto para evitar pérdida de información.',
    )
    return false
  }
}

function removePricingDraftLibraryItem(id: string) {
  try {
    localStorage.removeItem(pricingDraftLibraryItemKey(id))
    const nextIndex = pricingDraftLibraryReadIndex().filter((item) => item.id !== id)
    pricingDraftLibraryWriteIndex(nextIndex)
    pricingDraftLibrary.value = nextIndex
  } catch {
    toastStore.error('No se pudo eliminar el borrador en espera.')
  }
}

function pricingDraftLibrarySavedLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Guardado recientemente'
  return date.toLocaleString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function startNewPricingDraft() {
  if (!pricingDraftSupportsMultiple.value) return

  const hadCurrentDraft = pricingDraftHasContent()
  if (hadCurrentDraft && !archiveCurrentPricingDraft()) return

  discardPricingDraft(false)

  const nextId = crypto.randomUUID()
  pricingDraftActiveId.value = nextId

  try {
    localStorage.setItem(pricingDraftLibraryActiveKey.value, nextId)
  } catch {
    // Autosave will still work through the canonical draft key.
  }

  pricingDraftLibraryOpen.value = false
  refreshPricingDraftLibrary()

  toastStore.success(
    hadCurrentDraft ? 'Cotización puesta en espera' : 'Nueva cotización',
    hadCurrentDraft
      ? 'El borrador anterior quedó guardado. Puede continuar con otra cotización sin perderlo.'
      : 'El formulario quedó listo para una nueva cotización.',
  )
}

async function resumePricingDraft(id: string) {
  if (!pricingDraftSupportsMultiple.value) return

  let targetRaw = ''
  try {
    targetRaw = localStorage.getItem(pricingDraftLibraryItemKey(id)) || ''
  } catch {
    targetRaw = ''
  }

  if (!targetRaw) {
    removePricingDraftLibraryItem(id)
    toastStore.warning('Borrador no disponible', 'El borrador seleccionado ya no existe en este navegador.')
    return
  }

  if (pricingDraftHasContent() && !archiveCurrentPricingDraft()) return

  discardPricingDraft(false)
  pricingDraftReady.value = false

  try {
    localStorage.setItem(pricingDraftStorageKey.value, targetRaw)
    removePricingDraftLibraryItem(id)

    pricingDraftActiveId.value = id
    localStorage.setItem(pricingDraftLibraryActiveKey.value, id)

    await restorePricingDraft()
    pricingDraftLibraryOpen.value = false
    refreshPricingDraftLibrary()
  } catch {
    toastStore.error(
      'No se pudo abrir el borrador',
      'La cotización en espera no pudo restaurarse. El borrador permanece guardado.',
    )
  } finally {
    pricingDraftReady.value = true
  }
}

function deletePricingDraftFromLibrary(id: string) {
  removePricingDraftLibraryItem(id)
  toastStore.success('Borrador eliminado', 'La cotización en espera fue eliminada.')
}

onMounted(() => {
  initializePricingDraftLibrary()
})
`
  code = replaceExactlyOnce(
    code,
    scriptCloseAnchor,
    multipleDraftsScript + scriptCloseAnchor,
    'script close',
  )

  const discardButtonAnchor = `      <DhButton
        v-if="pricingDraftSavedAt"
        variant="secondary"
        size="sm"
        @click="discardPricingDraft"
      >Descartar borrador</DhButton>`

  const draftActionsReplacement = `      <div class="flex flex-wrap items-center gap-2">
        <DhButton
          v-if="pricingDraftSupportsMultiple"
          variant="secondary"
          size="sm"
          @click="pricingDraftLibraryOpen = !pricingDraftLibraryOpen"
        >Borradores en espera ({{ pricingDraftLibrary.length }})</DhButton>
        <DhButton
          v-if="pricingDraftSupportsMultiple"
          size="sm"
          @click="startNewPricingDraft"
        >Nueva cotización</DhButton>
        <DhButton
          v-if="pricingDraftSavedAt"
          variant="secondary"
          size="sm"
          @click="discardPricingDraft()"
        >Descartar actual</DhButton>
      </div>`

  code = replaceExactlyOnce(
    code,
    discardButtonAnchor,
    draftActionsReplacement,
    'draft actions',
  )

  const nextSectionAnchor = `    <div v-if="loadingExistingRate" class="crystal-soft p-5 text-sm font-black">Cargando tarifa completa…</div>`
  const libraryPanel = `    <div
      v-if="pricingDraftSupportsMultiple && pricingDraftLibraryOpen"
      class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-black">Cotizaciones en espera</p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Puede dejar una cotización pendiente mientras espera respuesta del cliente y continuar con otra.
          </p>
        </div>
        <DhButton variant="secondary" size="sm" @click="pricingDraftLibraryOpen = false">Cerrar</DhButton>
      </div>

      <div
        v-if="!pricingDraftLibrary.length"
        class="mt-4 rounded-xl border border-dashed border-[var(--dh-border)] px-4 py-5 text-center text-xs font-semibold text-[var(--dh-text-muted)]"
      >
        No hay cotizaciones en espera. Use “Nueva cotización” para guardar la actual y comenzar otra.
      </div>

      <div v-else class="mt-4 grid gap-3 lg:grid-cols-2">
        <div
          v-for="draft in pricingDraftLibrary"
          :key="draft.id"
          class="rounded-xl border border-[var(--dh-border)] bg-[rgb(var(--dh-primary-rgb)/0.025)] p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-black" :title="draft.clientName">{{ draft.clientName }}</p>
              <p class="mt-1 truncate text-xs font-bold text-[var(--dh-text-muted)]" :title="draft.routeLabel">
                {{ draft.routeLabel }}
              </p>
              <p class="mt-2 text-[11px] font-semibold text-[var(--dh-text-muted)]">
                {{ [draft.modality, draft.shipmentMode].filter(Boolean).join(' · ') || 'Modalidad pendiente' }}
                · Pantalla {{ draft.step }}
                · {{ pricingDraftLibrarySavedLabel(draft.savedAt) }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <DhButton size="sm" @click="resumePricingDraft(draft.id)">Continuar</DhButton>
              <DhButton variant="secondary" size="sm" @click="deletePricingDraftFromLibrary(draft.id)">Eliminar</DhButton>
            </div>
          </div>
        </div>
      </div>
    </div>

${nextSectionAnchor}`

  code = replaceExactlyOnce(
    code,
    nextSectionAnchor,
    libraryPanel,
    'draft library panel',
  )

  return code
}

export function pricingWizardMultipleDrafts(): Plugin {
  return {
    name: 'dhole-pricing-wizard-multiple-drafts',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
