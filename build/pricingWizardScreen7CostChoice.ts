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
  const previousLineContext = pricingDraftLastLineContext
  const requestedContext = pricingDraftLineContextKey()
  screen7RefreshBusy.value = true
  screen7RefreshAllowed.value = true
  try {
    if (!selectedCurrency.value && catalogs.currencies.length === 0) {
      throw new Error('No se cargó la moneda de la cotización. Recargue los catálogos antes de actualizar.')
    }

    // This is the exact same loader used when entering Screen 7. A direct
    // /costs/select call misses normalized agent/POE, import-rate, multi-port,
    // multi-carrier FCL, LTL and LCL-specific cost sources.
    await loadApplicableCosts()
    if (requestedContext !== pricingDraftLineContextKey()) {
      throw new Error('La ruta o el proveedor cambió durante la consulta. Intente actualizar nuevamente.')
    }

    // Own LCL rates come from a consolidation matrix rather than the global
    // Costs catalog. Restoring the persisted matrix is NOT a database refresh.
    if (isOwnLclMatrixContext()) {
      throw new Error('Esta tarifa LCL propia se alimenta del consolidado. Vuelva a seleccionar el consolidado en Proveedor para actualizar su matriz.')
    }

    // In addition to the contextual costs, Screen 7 normally queries the
    // complete applicable Optional catalog. Refresh it before rebuilding, but
    // do not use global optionals for a coloader's own rate.
    const isColoader = isLclColoaderAgentCostContext()
    if (!isColoader) {
      const optionalCosts = await loadAllApplicableOptionalCosts()
      const merged = new Map(costs.value.map((cost) => [cost.id, cost]))
      const contextKey = currentCostContextKey()
      optionalCosts.forEach((cost) => {
        merged.set(cost.id, { ...cost, __dholePricingContextKey: contextKey })
      })
      costs.value = [...merged.values()]
    }
    if (requestedContext !== pricingDraftLineContextKey()) {
      throw new Error('La ruta o el proveedor cambió durante la consulta. Intente actualizar nuevamente.')
    }
    if (previous.some((line) => line.costId) && !costs.value.length && !isColoader) {
      throw new Error('Pricing no devolvió costos aplicables a esta ruta y proveedor. No se reemplazaron los cargos anteriores.')
    }

    // Explicit refresh replaces catalog prices, not the user's hand-entered
    // rubrics. Clearing first also prevents the draft wrapper from retaining
    // the previous catalog's edited sale/cost amounts.
    rateLines.value = []
    rebuildRateLines()
    if (!rateLines.value.length && previous.length) {
      throw new Error('No se pudieron reconstruir los cargos para esta modalidad, ruta, proveedor e Incoterm. Se conservaron los anteriores.')
    }
    const currentLineKeys = new Set(rateLines.value.map(screen7CostLineKey))
    for (const line of previous) {
      if (line.manual && !line.costId && !currentLineKeys.has(screen7CostLineKey(line))) {
        rateLines.value.push({ ...line })
        currentLineKeys.add(screen7CostLineKey(line))
      }
    }

    // Keep existing detail IDs for the same catalog row so saving edits
    // updates RateDetails rather than creating duplicate charges.
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
    toastStore.success('Líneas actualizadas', 'Se aplicaron los costos vigentes y los cargos opcionales. Los rubros manuales se conservaron. Revise los importes antes de guardar.')
  } catch (error) {
    rateLines.value = previous
    costs.value = previousCosts
    pricingDraftLastLineContext = previousLineContext
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
              Actualizar consulta los costos y cargos opcionales vigentes para la ruta y el proveedor,
              reemplaza sus importes y puede añadir o quitar líneas automáticas. Los rubros manuales
              se conservan. No guarda la tarifa hasta que usted lo confirme.
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
