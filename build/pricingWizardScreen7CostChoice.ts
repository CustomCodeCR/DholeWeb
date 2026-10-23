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

function screen7CatalogRateLine(cost: CostSelectDto, previous?: RateLine): RateLine | null {
  const amount = resolvedConditionalCost(cost)
  if (!amount) return null

  // Reconcile persisted details by their stable CostId. Generated wizard rows
  // can be empty for no-freight Incoterms, edited LCL, or legacy routes even
  // when Pricing returned matching costs.
  const currency = selectedCurrency.value ?? catalogs.currencies[0]
  if (!currency) return null
  const optional = cost.costType === 'Optional'
  const line: RateLine = {
    key: previous?.key ?? 'cost:' + cost.id,
    detailId: previous?.detailId,
    section: sectionForCost(cost),
    name: cost.name,
    costDetailType: cost.costDetailType,
    costType: cost.costType,
    chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),
    costId: previous?.costId ?? cost.id,
    contextLabel: costContextLabel(cost),
    notes: cost.notes?.trim() || null,
    serviceIds: cost.services?.map((service) => service.id) ?? [],
    billToClient: previous?.billToClient,
    currencyId: cost.currencyId || currency.id,
    currencyName: cost.currencyName || displayValue(currency),
    currencyCode: cost.currencyCode || currency.code,
    amountCurrencyCode: cost.currencyCode || currency.code,
    costAmount: number(amount.costAmount),
    saleAmount: number(amount.saleAmount),
    included: previous?.included ?? !optional,
    optional,
    manual: false,
    applyDestinationTax: previous?.applyDestinationTax,
    destinationTaxRate: previous?.destinationTaxRate,
  }
  enforceLineCurrency(line)
  return line
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

    await loadApplicableCosts()
    if (requestedContext !== pricingDraftLineContextKey()) {
      throw new Error('La ruta o el proveedor cambió durante la consulta. Intente actualizar nuevamente.')
    }
    if (isOwnLclMatrixContext()) {
      throw new Error('Esta tarifa LCL propia se alimenta del consolidado. Vuelva a seleccionar el consolidado en Proveedor para actualizar su matriz.')
    }

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

    // A saved quote may reference a CostId not returned by the contextual
    // endpoint due to historical first-port or agent associations. Read the
    // active catalog for those exact IDs, never a cross-route name guess.
    const catalogById = new Map(costs.value.map((cost) => [cost.id, cost]))
    const missingCostIds = new Set(
      previous.map((line) => line.costId).filter((id): id is string =>
        Boolean(id) && !catalogById.has(id!)),
    )
    if (missingCostIds.size) {
      const activeCatalog = await PricingService.selectCosts({ isActive: true })
      activeCatalog.forEach((cost) => {
        if (missingCostIds.has(cost.id) && cost.isActive !== false) {
          catalogById.set(cost.id, cost)
        }
      })
    }
    // An all-manual or historical quotation can legitimately have no matching
    // active master costs. The safe result is to keep it intact and tell the
    // user no amounts could be refreshed, never make the quote uneditable.

    // Do NOT empty rateLines before rebuilding. LCL coloaders, manual freights
    // and saved quote snapshots depend on the previous source rows. Instead
    // disable the normal draft-price-preservation wrapper for this one
    // explicitly confirmed refresh.
    pricingDraftLastLineContext = '__explicit_catalog_refresh__'
    rebuildRateLines()
    const generated = rateLines.value.map((line) => ({ ...line }))
    const previousByKey = new Map(previous.map((line) => [screen7CostLineKey(line), line]))
    const next: RateLine[] = []
    const seenKeys = new Set<string>()
    let refreshed = 0
    let retained = 0

    const insert = (line: RateLine) => {
      const key = screen7CostLineKey(line)
      if (seenKeys.has(key)) return
      seenKeys.add(key)
      next.push(line)
    }

    // The rebuild may contain provider-specific lines, manual charges and
    // catalog costs. Update every CostId from the latest DB snapshot even if
    // a source-specific rebuilder kept the old amounts.
    for (const line of generated) {
      const original = previousByKey.get(screen7CostLineKey(line))
      const configured = line.costId ? catalogById.get(line.costId) : undefined
      const refreshedLine = configured ? screen7CatalogRateLine(configured, original ?? line) : null
      if (refreshedLine) {
        insert(refreshedLine)
        refreshed += 1
      } else {
        if (original?.detailId && !line.detailId) line.detailId = original.detailId
        insert(line)
      }
    }

    // Reconcile all original persisted details. A no-freight quote can have
    // zero rebuilt lines but still has legitimate destination/customs charges.
    // Do not mistake an empty builder output for permission to delete them.
    for (const original of previous) {
      const key = screen7CostLineKey(original)
      if (seenKeys.has(key)) continue
      const configured = original.costId ? catalogById.get(original.costId) : undefined
      const refreshedLine = configured ? screen7CatalogRateLine(configured, original) : null
      if (refreshedLine) {
        insert(refreshedLine)
        refreshed += 1
      } else {
        // Manual items and historical unmatched CostIds retain their exact
        // detail IDs and amounts until a human explicitly edits/removes them.
        insert({ ...original })
        retained += 1
      }
    }

    // The contextual Pricing response is authoritative for ADDING newly
    // applicable charges. Some legacy wizard rebuild branches produce none,
    // so materialize those items directly without an unrelated freight row.
    for (const cost of costs.value) {
      if (cost.isActive === false || cost.costDetailType === 'Freight') continue
      if (!visibleSections.value.includes(sectionForCost(cost))
          && !previous.some((line) => line.costId === cost.id)) continue
      if (seenKeys.has('cost:' + cost.id)) continue
      const existingLogical = next.some((line) =>
        normalizeCatalogValue(line.name) === normalizeCatalogValue(cost.name)
        && line.costDetailType === cost.costDetailType
        && line.section === sectionForCost(cost))
      if (existingLogical) continue
      const newLine = screen7CatalogRateLine(cost)
      if (newLine) {
        insert(newLine)
        refreshed += 1
      }
    }

    if (!next.length && previous.length) {
      throw new Error('No se recibieron líneas ni costos para esta cotización. Se conservaron los valores anteriores.')
    }
    rateLines.value = next
    pricingDraftLastLineContext = pricingDraftLineContextKey()
    screen7RefreshPromptOpen.value = false
    savePricingDraftNow()
    if (refreshed === 0) {
      toastStore.warning(
        'No hay nuevos costos aplicables',
        'Pricing no devolvió importes actualizables para esta ruta. Las ' + retained + ' líneas anteriores se conservaron sin cambios.',
      )
    } else {
      toastStore.success(
        'Líneas actualizadas',
        'Se aplicaron ' + refreshed + ' costos vigentes; ' + retained + ' líneas sin equivalencia en el catálogo se conservaron. Revise los importes antes de guardar.',
      )
    }
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
