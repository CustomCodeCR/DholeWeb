import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOnce(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error('[pricingWizardScreen7CostChoice] ' + label + ': expected 1 anchor, got ' + count)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source
  const stateAnchor = 'const rateLines = ref<RateLine[]>([])'
  code = replaceOnce(code, stateAnchor, stateAnchor + String.raw`
const screen7RefreshPromptOpen = ref(false)
const screen7RefreshBusy = ref(false)
const screen7RefreshAllowed = ref(false)
// The confirmation is for an existing persisted quote only.
// Newly created quotations always use current catalog costs automatically.
const screen7RequiresConfirmation = computed(() => Boolean(props.rateId) && !props.viewOnly)
`, 'line state')

  // Do not silently replace edited/persisted rows when an upstream watcher
  // asks for catalog costs again. First-time generation still runs normally.
  const rebuildAnchor = 'function rebuildRateLines() {\n  if (pricingDraftRestoring.value) return'
  code = replaceOnce(code, rebuildAnchor, rebuildAnchor + String.raw`
  if (screen7RequiresConfirmation.value && rateLines.value.length > 0 && !screen7RefreshAllowed.value) {
    screen7RefreshPromptOpen.value = true
    return
  }
`, 'rebuild guard')

  // A persisted rate is the authoritative source until the user elects to
  // reapply live catalog data; preserve both amounts and line membership.
  const eagerSync = '    if (!props.viewOnly) syncPersistedLinesWithChangedConfiguredCosts()'
  if (code.includes(eagerSync)) code = code.replace(eagerSync, '    // Keep the persisted price snapshot until Pricing authorizes a catalog refresh.')
  const eagerAdd = '    rateLines.value = uniqueReleaseLines\n    mergeConfiguredOptionalCostsIntoRateLines()'
  if (code.includes(eagerAdd)) code = code.replace(eagerAdd, '    rateLines.value = uniqueReleaseLines')

  const scriptEnd = '\n</script>'
  const script = String.raw`
function screen7CostLineKey(line: RateLine) {
  // A persisted detail can have a different Vue key to an unsaved catalog row.
  return line.costId
    ? 'cost:' + line.costId
    : 'line:' + normalizeCatalogValue(line.name) + '|' + line.costDetailType + '|' + line.section
}

function keepScreen7CurrentLines() {
  screen7RefreshPromptOpen.value = false
  pricingDraftLastLineContext = pricingDraftLineContextKey()
  savePricingDraftNow()
}

async function applyScreen7DatabaseCosts() {
  if (screen7RefreshBusy.value || props.viewOnly) return
  const previous = rateLines.value.map((line) => ({ ...line }))
  const previousCosts = costs.value
  screen7RefreshBusy.value = true
  try {
    // Unlike loadApplicableCosts, this direct read propagates API errors, so
    // a failed backend request can never erase the user's current quotation.
    const latestCosts = await PricingService.selectCosts({
      carrierId: form.carrierId || undefined,
      agentId: form.agentId || undefined,
      polId: form.originId || undefined,
      poeId: form.destinationId || undefined,
      podId: form.podId || undefined,
      incotermId: form.incotermId || undefined,
      shipmentMode: shipmentModeForApi.value,
      isActive: true,
      applicableToContext: true,
      serviceIds: form.serviceIds.join(',') || undefined,
    })
    if (!Array.isArray(latestCosts)) throw new Error('No se recibió un catálogo válido.')

    costs.value = latestCosts
    screen7RefreshAllowed.value = true
    // Intentionally drop the old rows before regenerating: the refresh is
    // explicit permission to add/remove rows and replace changed cost/sales.
    rateLines.value = []
    rebuildRateLines()
    if (!rateLines.value.length && previous.length) {
      throw new Error('La actualización no generó líneas. Se conservarán las anteriores.')
    }

    // Preserve existing detail IDs for compatible rows so an edit updates
    // rather than duplicating backend details on save.
    const previousByKey = new Map(previous.map((line) => [screen7CostLineKey(line), line]))
    for (const line of rateLines.value) {
      const original = previousByKey.get(screen7CostLineKey(line))
      if (original?.detailId && original.costId === line.costId) {
        line.detailId = original.detailId
      }
    }
    pricingDraftLastLineContext = pricingDraftLineContextKey()
    screen7RefreshPromptOpen.value = false
    savePricingDraftNow()
    toastStore.success('Líneas actualizadas', 'Se aplicaron los costos vigentes de la base de datos. Revise costo, venta y totales antes de guardar.')
  } catch (error) {
    rateLines.value = previous
    costs.value = previousCosts
    screen7RefreshPromptOpen.value = true
    toastStore.backendError(error, 'No se actualizaron las líneas. Todos los valores anteriores se conservaron.')
  } finally {
    screen7RefreshAllowed.value = false
    screen7RefreshBusy.value = false
  }
}

// Only prompt while editing/reloading a saved quotation. New quotations
// load their applicable database costs without interrupting the wizard.
watch(
  () => [step.value, pricingDraftReady.value] as const,
  ([currentStep, ready]) => {
    if (currentStep !== 7) {
      screen7RefreshPromptOpen.value = false
      return
    }
    if (screen7RequiresConfirmation.value && ready && rateLines.value.length) {
      screen7RefreshPromptOpen.value = true
    }
  },
  { immediate: true, flush: 'post' },
)
`
  code = replaceOnce(code, scriptEnd, '\n' + script + scriptEnd, 'script insertion')

  // The benchmark panel may refresh its own data. It must never rehydrate the
  // entire rate and overwrite unsaved price edits as a side effect.
  code = code.replace('@refreshed="hydrateExistingRate"', '@refreshed="screen7RefreshPromptOpen = screen7RequiresConfirmation"')

  const stageAnchor = '<div v-else-if="step === 7" class="crystal-lines-stage space-y-6">'
  const prompt = String.raw`
          <div v-if="screen7RequiresConfirmation && screen7RefreshPromptOpen && rateLines.length"
            role="group" aria-label="Confirmar actualización de líneas"
            class="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 md:p-5">
            <h3 class="text-sm font-black text-[var(--dh-text)]">¿Desea mantener los valores actuales o actualizar la tarifa?</h3>
            <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
              Mantener conserva los montos y las líneas que ya tiene, incluidas las modificaciones manuales.
              Actualizar vuelve a consultar la base de datos y puede añadir o quitar líneas, reemplazar
              costos y ventas y descartar ajustes anteriores. No guarda la tarifa hasta que usted lo confirme.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <DhButton type="button" variant="secondary" size="sm" :disabled="screen7RefreshBusy"
                @click="keepScreen7CurrentLines">Mantener valores actuales</DhButton>
              <DhButton type="button" size="sm" :loading="screen7RefreshBusy" :disabled="screen7RefreshBusy"
                @click="applyScreen7DatabaseCosts">Actualizar desde la base de datos</DhButton>
            </div>
          </div>
`
  code = replaceOnce(code, stageAnchor, stageAnchor + '\n' + prompt, 'screen 7 confirmation')
  return code
}

export function pricingWizardScreen7CostChoice(): Plugin {
  return {
    name: 'dhole-pricing-screen7-cost-choice',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
