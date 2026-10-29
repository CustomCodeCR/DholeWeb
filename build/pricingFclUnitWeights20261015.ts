import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceDivBlock(source: string, needle: string, replacement: string): string {
  const marker = source.indexOf(needle)
  if (marker < 0) throw new Error('[pricingFclUnitWeights] No se encontró el flete agrupado.')
  const start = source.lastIndexOf('<div v-if="shipmentModeForApi === \'Fcl\' && fclExtraContainers.length"', marker)
  if (start < 0) throw new Error('[pricingFclUnitWeights] No se encontró el contenedor del flete.')
  const tags = /<\/?div\b[^>]*>/g
  tags.lastIndex = start
  let depth = 0
  let match: RegExpExecArray | null
  while ((match = tags.exec(source)) !== null) {
    depth += match[0].startsWith('</') ? -1 : 1
    if (depth === 0) return source.slice(0, start) + replacement + source.slice(tags.lastIndex)
  }
  throw new Error('[pricingFclUnitWeights] Faltó el cierre del panel de fletes.')
}

function patchWizard(source: string): string {
  if (!source.includes('const fclContainerAllocations = computed(')) return source
  if (source.includes('const fclUnitWeightsKg = ref<')) return source
  let code = source
  // This ref must exist before the draft autosave watch([...]) source list is evaluated.
  // Injecting it at the end of <script setup> produces a TDZ ReferenceError and a blank wizard.
  const stateAnchor = 'const fclContainerAllocations = computed('
  if (!code.includes(stateAnchor)) throw new Error('[pricingFclUnitWeights] No se encontró la distribución FCL.')
  code = code.replace(stateAnchor,
    'const fclUnitWeightsKg = ref<Record<string, number[]>>({})\nconst fclWeightEditorOpen = ref<Record<string, boolean>>({})\n\n' + stateAnchor)


  const script = `
function fclUnitWeight(typeId: string, index: number) {
  const saved = fclUnitWeightsKg.value[typeId]?.[index]
  if (saved !== undefined) return Math.max(0, number(saved))
  // Una QUO FCL/FTL anterior puede tener TotalWeightKg = 0 aunque el
  // detalle del contenedor conserve UnitWeightsKg. La unidad tiene prioridad.
  const persistedContainer = editingRate.value?.containers?.find((row) => row.containerTypeId === typeId)
  const persistedWeight = persistedContainer?.unitWeightsKg?.[index]
  if (persistedWeight !== undefined && number(persistedWeight) > 0)
    return Math.max(0, number(persistedWeight))
  // Las cotizaciones anteriores de una sola unidad tenían solo peso total.
  if (form.equipmentId === typeId && Math.trunc(number(form.equipmentQuantity)) === 1
    && (shipmentModeForApi.value === 'Ftl' || fclContainerTotal.value === 1))
    return Math.max(0, number(form.cargoWeightKg))
  return 0
}

function fclWeightCompleted(typeId: string, quantity: number) {
  return fclUnitWeightsFor(typeId, quantity).filter((kg) => kg > 0).length
}

function fclWeightTotal(typeId: string, quantity: number) {
  return fclUnitWeightsFor(typeId, quantity).reduce((sum, kg) => sum + kg, 0)
}

function toggleFclWeightEditor(typeId: string) {
  if (!typeId) return
  fclWeightEditorOpen.value = {
    ...fclWeightEditorOpen.value,
    [typeId]: !fclWeightEditorOpen.value[typeId],
  }
}

function copyFirstFclUnitWeight(typeId: string, quantity: number) {
  const first = fclUnitWeight(typeId, 0)
  if (!typeId || first <= 0) return
  const count = Math.max(1, Math.min(100, Math.trunc(number(quantity))))
  fclUnitWeightsKg.value = {
    ...fclUnitWeightsKg.value,
    [typeId]: Array.from({ length: count }, () => first),
  }
}

function fclUnitWeightsFor(typeId: string, quantity: number): number[] {
  return Array.from({ length: Math.max(1, Math.min(100, Math.trunc(number(quantity)))) },
    (_, index) => fclUnitWeight(typeId, index))
}

function setFclUnitWeight(typeId: string, index: number, rawValue: number) {
  const weights = [...(fclUnitWeightsKg.value[typeId] ?? [])]
  weights[index] = Math.min(100000, Math.max(0, Number.isFinite(rawValue) ? rawValue : 0))
  fclUnitWeightsKg.value = { ...fclUnitWeightsKg.value, [typeId]: weights }
}

const fclRegionalOverweight = computed(() => {
  const destination = selectedDestination.value
  const poe = normalizeCatalogValue(destination ? displayValue(destination) : '')
  if (poe.includes('panama')) return false
  return ['costa rica', 'nicaragua', 'guatemala', 'honduras',
    'el salvador', 'belice', 'belize'].some((name) => poe.includes(name))
})

function fclUnitIsOverweight(kg: number) {
  return fclRegionalOverweight.value && Number(kg) > 21500
}

function fclGroupOverweightUnits(typeId: string, quantity: number) {
  return fclUnitWeightsFor(typeId, quantity).filter(fclUnitIsOverweight).length
}

const fclOverweightUnitCount = computed(() => {
  if (shipmentModeForApi.value === 'Fcl')
    return fclContainerAllocations.value.reduce((total, row) =>
      total + fclGroupOverweightUnits(row.containerTypeId, row.quantity), 0)
  if (shipmentModeForApi.value === 'Ftl')
    return landEquipmentAllocations.value.reduce((sum, row) =>
      sum + fclGroupOverweightUnits(row.containerTypeId, row.quantity), 0)
  return 0
})

const fclMissingUnitCount = computed(() => {
  if (shipmentModeForApi.value === 'Fcl')
    return fclContainerAllocations.value.reduce((total, row) =>
      total + fclUnitWeightsFor(row.containerTypeId, row.quantity).filter((kg) => kg <= 0).length, 0)
  if (shipmentModeForApi.value === 'Ftl')
    return landEquipmentAllocations.value.reduce((sum, row) =>
      sum + fclUnitWeightsFor(row.containerTypeId, row.quantity).filter((kg) => kg <= 0).length, 0)
  return 0
})

function restoreFclUnitWeights(
  value: Array<{ containerTypeId: string; quantity?: number; unitWeightsKg?: number[] | null }>,
  aggregateWeightKg = 0,
) {
  const restored = Object.fromEntries(value.map((row) => [
    row.containerTypeId, Array.isArray(row.unitWeightsKg)
      ? row.unitWeightsKg.map((kg) => Math.max(0, number(kg)))
      : [],
  ])) as Record<string, number[]>
  // Historical seller requests and quotes stored the 15,000-kg aggregate but
  // zero in UnitWeightsKg. A single physical unit has an unambiguous weight.
  // Never guess the distribution across multiple physical containers.
  const totalUnits = value.reduce((sum, row) =>
    sum + Math.max(1, Math.trunc(number(row.quantity) || 1)), 0)
  if (totalUnits === 1 && value.length === 1 && number(aggregateWeightKg) > 0
    && !(restored[value[0]!.containerTypeId] ?? []).some((kg) => kg > 0)) {
    restored[value[0]!.containerTypeId] = [Math.max(0, number(aggregateWeightKg))]
  }
  fclUnitWeightsKg.value = restored
  const totalUnitWeight = Object.values(restored).flat().reduce((sum, kg) => sum + number(kg), 0)
  if (totalUnitWeight > 0 && (shipmentModeForApi.value === 'Fcl' || shipmentModeForApi.value === 'Ftl'))
    form.cargoWeightKg = totalUnitWeight
}

// Use the individual unit weights as the single source of truth for FCL/FTL.
// Draft hydration and rate revisions may assign form.overweight after this watch
// has run. Observing the stored flag too prevents stale manual/legacy selections
// from enabling "Sobrepeso · 3 ejes" when no single unit is overweight.
watch(
  () => [shipmentModeForApi.value, fclOverweightUnitCount.value, form.overweight] as const,
  ([mode, count, selected]) => {
    if (mode !== 'Fcl' && mode !== 'Ftl') return
    const shouldApply = count > 0
    if (selected !== shouldApply) form.overweight = shouldApply
  },
  { immediate: true, flush: 'sync' },
)

watch(
   () => [shipmentModeForApi.value, form.equipmentId, form.equipmentQuantity,
    fclContainerAllocations.value.map((row) => row.containerTypeId + ':' + row.quantity).join('|'),
    landEquipmentAllocations.value.map((row) => row.containerTypeId + ':' + row.quantity).join('|'),
    JSON.stringify(fclUnitWeightsKg.value)] as const,
  ([mode]) => {
    if (mode !== 'Fcl' && mode !== 'Ftl') return
    const weights = mode === 'Fcl'
      ? fclContainerAllocations.value.flatMap((row) => fclUnitWeightsFor(row.containerTypeId, row.quantity))
      : landEquipmentAllocations.value.flatMap((row) => fclUnitWeightsFor(row.containerTypeId, row.quantity))
    // No sobrescribir el dato agregado de un registro antiguo mientras no se indiquen pesos por unidad.
    // Once per-unit values were explicitly entered, even clearing the last
    // weight to zero must update the aggregate instead of retaining stale kg.
    if (Object.values(fclUnitWeightsKg.value).some((values) => values.length > 0))
      form.cargoWeightKg = weights.reduce((sum, kg) => sum + kg, 0)
  },
)
`
  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd < 0) throw new Error('[pricingFclUnitWeights] No se encontró script setup.')
  code = code.slice(0, scriptEnd) + script + '\n' + code.slice(scriptEnd)

  // En la creación, modificación y solicitud de tarifas viajan los pesos por tipo.
  let mapped = 0
  code = code.replace(
    /(containerTypeCode:\s*row\.containerTypeCode,\s*\n\s*quantity:\s*row\.quantity,)/g,
    (match) => {
      mapped++
      return match + '\n              unitWeightsKg: fclUnitWeightsFor(row.containerTypeId, row.quantity),'
    },
  )
  if (!mapped) throw new Error('[pricingFclUnitWeights] Falta mapear pesos al payload FCL.')
  code = code.replace(
    /(containerTypeCode:\s*equipment!?\.code,\s*\n\s*quantity:\s*form\.equipmentQuantity,)/g,
    (match) => match + '\n                unitWeightsKg: shipmentModeForApi.value === "Ftl" ? fclUnitWeightsFor(form.equipmentId, form.equipmentQuantity) : [],',
  )

  // La edición de una tarifa existente debe recuperar incluso un solo contenedor.
  const persistedFn = 'function restorePersistedFclDistribution(rate: RateDto) {'
  const persistedAt = code.indexOf(persistedFn)
  if (persistedAt >= 0) {
    const line = '  const allocations = (rate.containers ?? []).filter((container) => number(container.quantity) > 0)'
    const at = code.indexOf(line, persistedAt)
    if (at >= 0)
      code = code.slice(0, at + line.length) + '\n  restoreFclUnitWeights(allocations, number(rate.totalWeightKg))' + code.slice(at + line.length)
  }
  // La hidratación de una tarifa FTL también debe restaurar sus pesos por equipo.
  const hydrate = '    const restoredMixedFclFreight = restorePersistedFclDistribution(rate)'
  if (code.includes(hydrate))
    code = code.replace(hydrate, '    restoreFclUnitWeights((rate.containers ?? []).filter((container) => number(container.quantity) > 0), number(rate.totalWeightKg))\n' + hydrate)

  const requestRows = '  const rows = value as Array<Record<string, unknown>>'
  if (code.includes(requestRows))
    code = code.replace(requestRows, requestRows + '\n  restoreFclUnitWeights(rows.map((row) => ({ containerTypeId: String(row.containerTypeId ?? ""), quantity: number(row.quantity), unitWeightsKg: Array.isArray(row.unitWeightsKg) ? row.unitWeightsKg.map((kg) => number(kg)) : [] })), number(form.cargoWeightKg))')

  if (code.includes('function resetWizard() {'))
    code = code.replace('function resetWizard() {', 'function resetWizard() {\n  fclUnitWeightsKg.value = {}\n  fclWeightEditorOpen.value = {}')

  // Pantalla 8 puede guardar directamente una revisión: no admitir unidades sin peso.
  const saveRateAnchor = 'async function saveRate() {'
  if (code.includes(saveRateAnchor))
    code = code.replace(saveRateAnchor, saveRateAnchor + '\n  if (fclMissingUnitCount.value > 0) {\n    step.value = 3\n    toastStore.error("Indique el peso en kg de cada contenedor o furgón antes de guardar la tarifa.")\n    return\n  }')

  // Validación también cuando se edita, ruta que tradicionalmente omitía canNext.
  const next = 'async function next() {'
  if (code.includes(next))
    code = code.replace(next, next + '\n  if (step.value === 3 && fclMissingUnitCount.value > 0) {\n    toastStore.error("Indique el peso en kg de cada contenedor o furgón antes de continuar.")\n    return\n  }')

  // Todos los importes de sobrepeso se multiplican solo por los equipos afectados.
  const quantity = 'function quantityForRateLine(line: RateLine) {'
  if (code.includes(quantity))
    code = code.replace(quantity, quantity + '\n  if ((shipmentModeForApi.value === "Fcl" || shipmentModeForApi.value === "Ftl")\n    && /sobrepeso|overweight/.test(normalizeCatalogValue(line.name)))\n    return Math.max(1, fclOverweightUnitCount.value)')

  // El indicador de pantalla 4 ya no es una opción global editable.
  code = code.replace(
    '@click="form.overweight = !form.overweight"',
    ':disabled="shipmentModeForApi === \'Fcl\' || shipmentModeForApi === \'Ftl\'" @click="form.overweight = !form.overweight"',
  )

  const primaryFclWeights = "<div class=\"min-w-0\">\n  <div v-if=\"Math.trunc(Number(form.equipmentQuantity)) <= 1\">\n    <DhInput :model-value=\"fclUnitWeight(form.equipmentId, 0)\" type=\"number\" min=\"0\" step=\"1\"\n      label=\"Peso (kg) *\" @update:model-value=\"(value) => setFclUnitWeight(form.equipmentId, 0, Number(value))\" />\n  </div>\n  <div v-else class=\"rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2\">\n    <span class=\"block text-[10px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]\">Pesos individuales</span>\n    <div class=\"mt-1 flex items-center justify-between gap-2\">\n      <span class=\"text-xs font-black text-[var(--dh-text)]\">{{ fclWeightCompleted(form.equipmentId, form.equipmentQuantity) }}/{{ Math.trunc(Number(form.equipmentQuantity)) }} listos</span>\n      <button type=\"button\" class=\"rounded-lg border border-[rgb(var(--dh-primary-rgb)/0.30)] px-2 py-1 text-xs font-black text-[var(--dh-primary)] hover:bg-[rgb(var(--dh-primary-rgb)/0.08)]\"\n        :aria-expanded=\"Boolean(fclWeightEditorOpen[form.equipmentId])\" @click=\"toggleFclWeightEditor(form.equipmentId)\">\n        {{ fclWeightEditorOpen[form.equipmentId] ? 'Cerrar' : 'Editar' }}\n      </button>\n    </div>\n    <span class=\"mt-1 block text-[11px] font-semibold text-[var(--dh-text-muted)]\">{{ fclWeightTotal(form.equipmentId, form.equipmentQuantity).toLocaleString('es-CR') }} kg total</span>\n  </div>\n</div>"
  const additionalFclWeights = "<div class=\"min-w-0\">\n  <div v-if=\"Math.trunc(Number(row.quantity)) <= 1\">\n    <DhInput :model-value=\"fclUnitWeight(row.containerTypeId, 0)\" type=\"number\" min=\"0\" step=\"1\"\n      label=\"Peso (kg) *\" @update:model-value=\"(value) => setFclUnitWeight(row.containerTypeId, 0, Number(value))\" />\n  </div>\n  <div v-else class=\"rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2\">\n    <span class=\"block text-[10px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]\">Pesos individuales</span>\n    <div class=\"mt-1 flex items-center justify-between gap-2\">\n      <span class=\"text-xs font-black text-[var(--dh-text)]\">{{ fclWeightCompleted(row.containerTypeId, row.quantity) }}/{{ Math.trunc(Number(row.quantity)) }} listos</span>\n      <button type=\"button\" class=\"rounded-lg border border-[rgb(var(--dh-primary-rgb)/0.30)] px-2 py-1 text-xs font-black text-[var(--dh-primary)] hover:bg-[rgb(var(--dh-primary-rgb)/0.08)]\"\n        :aria-expanded=\"Boolean(fclWeightEditorOpen[row.containerTypeId])\" @click=\"toggleFclWeightEditor(row.containerTypeId)\">\n        {{ fclWeightEditorOpen[row.containerTypeId] ? 'Cerrar' : 'Editar' }}\n      </button>\n    </div>\n    <span class=\"mt-1 block text-[11px] font-semibold text-[var(--dh-text-muted)]\">{{ fclWeightTotal(row.containerTypeId, row.quantity).toLocaleString('es-CR') }} kg total</span>\n  </div>\n</div>"
  const primaryFclPanel = "<div v-if=\"Math.trunc(Number(form.equipmentQuantity)) > 1 && fclWeightEditorOpen[form.equipmentId]\"\n  class=\"mt-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3\">\n  <div class=\"flex flex-wrap items-center justify-between gap-3\">\n    <div>\n      <p class=\"text-xs font-black text-[var(--dh-text)]\">Pesos por unidad (kg)</p>\n      <p class=\"mt-1 text-[11px] text-[var(--dh-text-muted)]\">Edite cada peso individualmente o repita el primero.</p>\n    </div>\n    <DhButton type=\"button\" variant=\"secondary\" size=\"sm\"\n      :disabled=\"fclUnitWeight(form.equipmentId, 0) <= 0\" @click=\"copyFirstFclUnitWeight(form.equipmentId, form.equipmentQuantity)\">\n      Repetir peso del primero\n    </DhButton>\n  </div>\n  <div class=\"mt-3 grid max-h-56 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4\">\n    <div v-for=\"unitNumber in Math.max(1, Math.min(100, Math.trunc(Number(form.equipmentQuantity))))\"\n      :key=\"'primary-weight:' + unitNumber\" class=\"min-w-0\">\n      <DhInput :model-value=\"fclUnitWeight(form.equipmentId, unitNumber - 1)\" type=\"number\" min=\"0\" step=\"1\"\n        :label=\"'Unidad ' + unitNumber + ' · kg *'\"\n        @update:model-value=\"(value) => setFclUnitWeight(form.equipmentId, unitNumber - 1, Number(value))\" />\n      <p v-if=\"fclUnitIsOverweight(fclUnitWeight(form.equipmentId, unitNumber - 1))\"\n        class=\"mt-1 text-[11px] font-semibold text-[var(--dh-primary)]\">Sobrepeso</p>\n    </div>\n  </div>\n</div>"
  const additionalFclPanel = "<div v-if=\"Math.trunc(Number(row.quantity)) > 1 && fclWeightEditorOpen[row.containerTypeId]\"\n  class=\"mt-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3\">\n  <div class=\"flex flex-wrap items-center justify-between gap-3\">\n    <div>\n      <p class=\"text-xs font-black text-[var(--dh-text)]\">Pesos por unidad (kg)</p>\n      <p class=\"mt-1 text-[11px] text-[var(--dh-text-muted)]\">Edite cada peso individualmente o repita el primero.</p>\n    </div>\n    <DhButton type=\"button\" variant=\"secondary\" size=\"sm\"\n      :disabled=\"fclUnitWeight(row.containerTypeId, 0) <= 0\" @click=\"copyFirstFclUnitWeight(row.containerTypeId, row.quantity)\">\n      Repetir peso del primero\n    </DhButton>\n  </div>\n  <div class=\"mt-3 grid max-h-56 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4\">\n    <div v-for=\"unitNumber in Math.max(1, Math.min(100, Math.trunc(Number(row.quantity))))\"\n      :key=\"'additional-weight:' + unitNumber\" class=\"min-w-0\">\n      <DhInput :model-value=\"fclUnitWeight(row.containerTypeId, unitNumber - 1)\" type=\"number\" min=\"0\" step=\"1\"\n        :label=\"'Unidad ' + unitNumber + ' · kg *'\"\n        @update:model-value=\"(value) => setFclUnitWeight(row.containerTypeId, unitNumber - 1, Number(value))\" />\n      <p v-if=\"fclUnitIsOverweight(fclUnitWeight(row.containerTypeId, unitNumber - 1))\"\n        class=\"mt-1 text-[11px] font-semibold text-[var(--dh-primary)]\">Sobrepeso</p>\n    </div>\n  </div>\n</div>"

  // Pesos FCL y FTL integrados en sus respectivas tarjetas de equipo.
  const row4 = '<!-- Fila 4: Incoterm y fecha de carga lista. -->'
  if (!code.includes(row4)) throw new Error('[pricingFclUnitWeights] No se encontró la posición de los pesos en pantalla 3.')

  const fclHeading = code.indexOf('Distribución de contenedores FCL')
  const row4Position = code.indexOf(row4, fclHeading)
  if (fclHeading < 0 || row4Position < 0) {
    throw new Error('[pricingFclUnitWeights] No se encontró la distribución FCL.')
  }
  // Después de FCL también se renderiza la distribución terrestre, que utiliza
  // los mismos v-model de cantidad; limitar el alcance a los contenedores marítimos.
  const landHeading = code.indexOf('Distribución de furgones', fclHeading)
  const distributionEnd = landHeading > fclHeading && landHeading < row4Position
    ? landHeading
    : row4Position
  let distribution = code.slice(fclHeading, distributionEnd)

  // Place a compact weight column inside the SAME responsive grid as
  // container size/type and quantity. Each physical unit retains its weight.
  const addWeightControls = (model: string, markup: string, panel: string) => {
    const tokens = [`v-model.number="${model}"`, `v-model="${model}"`]
    const occurrences = tokens.flatMap((token) => {
      const positions: number[] = []
      let pos = distribution.indexOf(token)
      while (pos >= 0) {
        positions.push(pos)
        pos = distribution.indexOf(token, pos + token.length)
      }
      return positions
    })
    if (occurrences.length !== 1) {
      throw new Error('[pricingFclUnitWeights] Cantidad de contenedor ambigua: ' + model)
    }
    const inputPos = occurrences[0]!
    const inputEnd = distribution.indexOf('/>', inputPos)
    const gridStart = distribution.lastIndexOf('<div class="grid ', inputPos)
    const gridEnd = distribution.indexOf('>', gridStart)
    if (inputEnd < 0 || gridStart < 0 || gridEnd < 0
      || gridEnd >= inputPos || inputPos - gridEnd > 750) {
      throw new Error('[pricingFclUnitWeights] No se encontró la fila de contenedor para ' + model)
    }
    const originalGrid = distribution.slice(gridStart, gridEnd + 1)
    const targetGrid = originalGrid.replace('lg:items-end', 'lg:items-start').replace(
      'lg:grid-cols-[minmax(0,1fr)_160px]',
      'lg:grid-cols-[minmax(0,1fr)_120px_215px] xl:grid-cols-[minmax(0,1fr)_130px_235px]',
    )
    if (originalGrid === targetGrid) {
      throw new Error('[pricingFclUnitWeights] Cambió la grilla para ' + model)
    }
    // Inject after the quantity input but BEFORE the grid closes. Alter the
    // grid markup only after insertion, so positions remain valid.
    distribution = distribution.slice(0, inputEnd + 2)
      + '\n                    ' + markup
      + distribution.slice(inputEnd + 2)
    distribution = distribution.slice(0, gridStart)
      + targetGrid
      + distribution.slice(gridEnd + 1)
    // Put the expandable editor AFTER the grid, inside the same card.
    // This prevents the quantity column from making the entire row taller.
    const tags = /<\/?div\b[^>]*>/g
    tags.lastIndex = gridStart
    let depth = 0
    let rowEnd = -1
    let token: RegExpExecArray | null
    while ((token = tags.exec(distribution)) !== null) {
      depth += token[0].startsWith('</') ? -1 : 1
      if (depth === 0) {
        rowEnd = tags.lastIndex
        break
      }
    }
    if (rowEnd < 0) throw new Error('[pricingFclUnitWeights] No cerró la fila de ' + model)
    distribution = distribution.slice(0, rowEnd) + '\n' + panel + distribution.slice(rowEnd)
  }
  addWeightControls('form.equipmentQuantity', primaryFclWeights, primaryFclPanel)
  addWeightControls('row.quantity', additionalFclWeights, additionalFclPanel)
  code = code.slice(0, fclHeading) + distribution + code.slice(distributionEnd)

  // FTL: el peso se registra junto al tamaño y la cantidad dentro de cada tarjeta.
  // Cada unidad física tiene un input propio, incluso cuando hay varios furgones iguales.
  const primaryFtlWeights = "<div class=\"min-w-0\">\n  <div v-if=\"Math.trunc(Number(form.equipmentQuantity)) <= 1\">\n    <DhInput :model-value=\"fclUnitWeight(form.equipmentId, 0)\" type=\"number\" min=\"0\" step=\"1\"\n      label=\"Peso (kg) *\" @update:model-value=\"(value) => setFclUnitWeight(form.equipmentId, 0, Number(value))\" />\n  </div>\n  <div v-else class=\"rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2\">\n    <span class=\"block text-[10px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]\">Pesos individuales</span>\n    <div class=\"mt-1 flex items-center justify-between gap-2\">\n      <span class=\"text-xs font-black text-[var(--dh-text)]\">{{ fclWeightCompleted(form.equipmentId, form.equipmentQuantity) }}/{{ Math.trunc(Number(form.equipmentQuantity)) }} listos</span>\n      <button type=\"button\" class=\"rounded-lg border border-[rgb(var(--dh-primary-rgb)/0.30)] px-2 py-1 text-xs font-black text-[var(--dh-primary)] hover:bg-[rgb(var(--dh-primary-rgb)/0.08)]\"\n        :aria-expanded=\"Boolean(fclWeightEditorOpen[form.equipmentId])\" @click=\"toggleFclWeightEditor(form.equipmentId)\">\n        {{ fclWeightEditorOpen[form.equipmentId] ? 'Cerrar' : 'Editar' }}\n      </button>\n    </div>\n    <span class=\"mt-1 block text-[11px] font-semibold text-[var(--dh-text-muted)]\">{{ fclWeightTotal(form.equipmentId, form.equipmentQuantity).toLocaleString('es-CR') }} kg total</span>\n  </div>\n</div>"
  const additionalFtlWeights = "<div class=\"min-w-0\">\n  <div v-if=\"Math.trunc(Number(row.quantity)) <= 1\">\n    <DhInput :model-value=\"fclUnitWeight(row.containerTypeId, 0)\" type=\"number\" min=\"0\" step=\"1\"\n      label=\"Peso (kg) *\" @update:model-value=\"(value) => setFclUnitWeight(row.containerTypeId, 0, Number(value))\" />\n  </div>\n  <div v-else class=\"rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2\">\n    <span class=\"block text-[10px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]\">Pesos individuales</span>\n    <div class=\"mt-1 flex items-center justify-between gap-2\">\n      <span class=\"text-xs font-black text-[var(--dh-text)]\">{{ fclWeightCompleted(row.containerTypeId, row.quantity) }}/{{ Math.trunc(Number(row.quantity)) }} listos</span>\n      <button type=\"button\" class=\"rounded-lg border border-[rgb(var(--dh-primary-rgb)/0.30)] px-2 py-1 text-xs font-black text-[var(--dh-primary)] hover:bg-[rgb(var(--dh-primary-rgb)/0.08)]\"\n        :aria-expanded=\"Boolean(fclWeightEditorOpen[row.containerTypeId])\" @click=\"toggleFclWeightEditor(row.containerTypeId)\">\n        {{ fclWeightEditorOpen[row.containerTypeId] ? 'Cerrar' : 'Editar' }}\n      </button>\n    </div>\n    <span class=\"mt-1 block text-[11px] font-semibold text-[var(--dh-text-muted)]\">{{ fclWeightTotal(row.containerTypeId, row.quantity).toLocaleString('es-CR') }} kg total</span>\n  </div>\n</div>"
  const primaryFtlPanel = "<div v-if=\"Math.trunc(Number(form.equipmentQuantity)) > 1 && fclWeightEditorOpen[form.equipmentId]\"\n  class=\"mt-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3\">\n  <div class=\"flex flex-wrap items-center justify-between gap-3\">\n    <div>\n      <p class=\"text-xs font-black text-[var(--dh-text)]\">Pesos por furgón (kg)</p>\n      <p class=\"mt-1 text-[11px] text-[var(--dh-text-muted)]\">Edite cada peso individualmente o repita el primero.</p>\n    </div>\n    <DhButton type=\"button\" variant=\"secondary\" size=\"sm\"\n      :disabled=\"fclUnitWeight(form.equipmentId, 0) <= 0\" @click=\"copyFirstFclUnitWeight(form.equipmentId, form.equipmentQuantity)\">\n      Repetir peso del primero\n    </DhButton>\n  </div>\n  <div class=\"mt-3 grid max-h-56 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4\">\n    <div v-for=\"unitNumber in Math.max(1, Math.min(100, Math.trunc(Number(form.equipmentQuantity))))\"\n      :key=\"'ftl-primary-weight:' + unitNumber\" class=\"min-w-0\">\n      <DhInput :model-value=\"fclUnitWeight(form.equipmentId, unitNumber - 1)\" type=\"number\" min=\"0\" step=\"1\"\n        :label=\"'Furgón ' + unitNumber + ' · kg *'\"\n        @update:model-value=\"(value) => setFclUnitWeight(form.equipmentId, unitNumber - 1, Number(value))\" />\n      <p v-if=\"fclUnitIsOverweight(fclUnitWeight(form.equipmentId, unitNumber - 1))\"\n        class=\"mt-1 text-[11px] font-semibold text-[var(--dh-primary)]\">Sobrepeso</p>\n    </div>\n  </div>\n</div>"
  const additionalFtlPanel = "<div v-if=\"Math.trunc(Number(row.quantity)) > 1 && fclWeightEditorOpen[row.containerTypeId]\"\n  class=\"mt-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3\">\n  <div class=\"flex flex-wrap items-center justify-between gap-3\">\n    <div>\n      <p class=\"text-xs font-black text-[var(--dh-text)]\">Pesos por furgón (kg)</p>\n      <p class=\"mt-1 text-[11px] text-[var(--dh-text-muted)]\">Edite cada peso individualmente o repita el primero.</p>\n    </div>\n    <DhButton type=\"button\" variant=\"secondary\" size=\"sm\"\n      :disabled=\"fclUnitWeight(row.containerTypeId, 0) <= 0\" @click=\"copyFirstFclUnitWeight(row.containerTypeId, row.quantity)\">\n      Repetir peso del primero\n    </DhButton>\n  </div>\n  <div class=\"mt-3 grid max-h-56 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4\">\n    <div v-for=\"unitNumber in Math.max(1, Math.min(100, Math.trunc(Number(row.quantity))))\"\n      :key=\"'ftl-additional-weight:' + unitNumber\" class=\"min-w-0\">\n      <DhInput :model-value=\"fclUnitWeight(row.containerTypeId, unitNumber - 1)\" type=\"number\" min=\"0\" step=\"1\"\n        :label=\"'Furgón ' + unitNumber + ' · kg *'\"\n        @update:model-value=\"(value) => setFclUnitWeight(row.containerTypeId, unitNumber - 1, Number(value))\" />\n      <p v-if=\"fclUnitIsOverweight(fclUnitWeight(row.containerTypeId, unitNumber - 1))\"\n        class=\"mt-1 text-[11px] font-semibold text-[var(--dh-primary)]\">Sobrepeso</p>\n    </div>\n  </div>\n</div>"
  const ftlHeading = code.indexOf('Distribución de furgones FTL', fclHeading)
  const ftlDistributionEnd = code.indexOf(row4, ftlHeading)
  if (ftlHeading < 0 || ftlDistributionEnd < 0) {
    throw new Error('[pricingFclUnitWeights] No se encontró la distribución terrestre.')
  }
  distribution = code.slice(ftlHeading, ftlDistributionEnd)
  addWeightControls('form.equipmentQuantity', primaryFtlWeights, primaryFtlPanel)
  addWeightControls('row.quantity', additionalFtlWeights, additionalFtlPanel)
  code = code.slice(0, ftlHeading) + distribution + code.slice(ftlDistributionEnd)

  // Los indicadores permanecen dentro de la distribución, sin crear un panel aparte.
  const ftlSummaryAnchor = '<strong class="text-sm text-[var(--dh-primary)]">Total: {{ landEquipmentTotal }} furgón{{ landEquipmentTotal === 1 ? \'\' : \'es\' }}</strong>'
  if (!code.includes(ftlSummaryAnchor)) {
    throw new Error('[pricingFclUnitWeights] No se encontró el resumen terrestre.')
  }
  code = code.replace(ftlSummaryAnchor, ftlSummaryAnchor + `
                  <span v-if="fclOverweightUnitCount > 0" class="text-xs font-semibold text-[var(--dh-primary)]">{{ fclOverweightUnitCount }} con sobrepeso</span>
                  <span v-if="fclMissingUnitCount > 0" class="text-xs font-semibold text-[var(--dh-primary)]">Pendientes de peso: {{ fclMissingUnitCount }}</span>`)

  const freightUi = `
          <div v-if="shipmentModeForApi === 'Fcl' && fclContainerAllocations.length > 1" class="crystal-soft space-y-3 p-4 md:p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="font-black">Flete internacional por equipo</p>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Cada tipo conserva su propio costo y venta. Los valores del equipo principal se editan en los campos superiores.</p>
              </div>
              <span class="rounded-full border border-[var(--dh-border)] px-3 py-1 text-xs font-black">{{ fclContainerTotal }} contenedores</span>
            </div>
            <div class="flex flex-wrap items-center gap-3 rounded-xl border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[rgb(var(--dh-primary-rgb)/0.04)] p-3">
              <span class="rounded-lg bg-[rgb(var(--dh-primary-rgb)/0.12)] px-2 py-1 text-xs font-black text-[var(--dh-primary)]">Principal</span>
              <strong class="text-sm">{{ form.equipmentQuantity }} × {{ fclContainerName(form.equipmentId) }}</strong>
              <span class="text-xs text-[var(--dh-text-muted)]">Costo y venta: campos superiores</span>
              <span v-if="fclGroupOverweightUnits(form.equipmentId, form.equipmentQuantity)" class="text-xs font-bold text-[var(--dh-primary)]">{{ fclGroupOverweightUnits(form.equipmentId, form.equipmentQuantity) }} con sobrepeso</span>
            </div>
            <div v-for="(row, index) in fclExtraContainers" :key="'fcl-freight:' + row.key" class="grid gap-3 rounded-xl border border-[var(--dh-border)] p-3 lg:grid-cols-[minmax(0,1fr)_180px_180px] lg:items-end">
              <div class="min-w-0">
                <span class="text-[10px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Equipo adicional {{ index + 1 }}</span>
                <strong class="mt-1 block text-sm">{{ row.quantity }} × {{ fclContainerName(row.containerTypeId) }}</strong>
                <p v-if="fclGroupOverweightUnits(row.containerTypeId, row.quantity)" class="mt-1 text-xs font-bold text-[var(--dh-primary)]">{{ fclGroupOverweightUnits(row.containerTypeId, row.quantity) }} con sobrepeso</p>
              </div>
              <DhInput v-model.number="row.freightCostAmount" type="number" min="0" step="0.01" label="Costo unitario" @update:model-value="row.freightTouched = true" />
              <DhInput v-model.number="row.freightSaleAmount" type="number" min="0" step="0.01" label="Venta unitaria" @update:model-value="row.freightTouched = true" />
            </div>
          </div>
`
  code = replaceDivBlock(code, 'Flete internacional por tipo de contenedor', freightUi)
  // Keep the individual weight map in the browser's automatic draft save/restore.
  // This must be separate from cargoWeightKg (the aggregate weight).
  const draftWeightsAnchor = '    fclExtraContainers: JSON.parse(JSON.stringify(fclExtraContainers.value)),'
  if (!code.includes(draftWeightsAnchor)) {
    throw new Error('[pricingFclUnitWeights] No se encontró el guardado de pesos en borrador.')
  }
  code = code.replace(
    draftWeightsAnchor,
    draftWeightsAnchor + '\n    fclUnitWeightsKg: JSON.parse(JSON.stringify(fclUnitWeightsKg.value)),',
  )

  const draftRestoreAnchor = '    fclExtraContainers.value = sanitizeDraftFclExtraContainers(draft.fclExtraContainers)'
  if (!code.includes(draftRestoreAnchor)) {
    throw new Error('[pricingFclUnitWeights] No se encontró la restauración segura del borrador.')
  }
  code = code.replace(draftRestoreAnchor, draftRestoreAnchor + '\n' + [
    '    if (draft.fclUnitWeightsKg && typeof draft.fclUnitWeightsKg === "object" && !Array.isArray(draft.fclUnitWeightsKg)) {',
    '      restoreFclUnitWeights(Object.entries(draft.fclUnitWeightsKg).map(([containerTypeId, weights]) => ({',
    '        containerTypeId,',
    '        unitWeightsKg: Array.isArray(weights) ? weights.map((weight) => Math.max(0, Math.min(100000, number(weight)))) : [],',
    '      })))',
    '    }',
  ].join('\n'))

  // A seller request stores unit weights under payload.form.fclContainers.
  // Recover them after form hydration, including legacy one-unit aggregate-only
  // requests; do not depend on the optional restore rows utility being called.
  const requestHydrationStart = code.indexOf('async function hydrateRateRequest() {')
  const requestHydrationEnd = code.indexOf('\n}\n', requestHydrationStart)
  if (requestHydrationStart < 0 || requestHydrationEnd < 0) {
    throw new Error('[pricingFclUnitWeights] No se encontró la carga de solicitud de Ventas.')
  }
  const requestHydration = code.slice(requestHydrationStart, requestHydrationEnd)
  const requestHydrationAnchor = '    rateRequestPriority.value = request.priority'
  if (requestHydration.split(requestHydrationAnchor).length !== 2) {
    throw new Error('[pricingFclUnitWeights] No se encontró el contexto de equipo de la solicitud.')
  }
  const requestRestoration = [
    requestHydrationAnchor,
    '    const sellerEquipment = request.payload?.form as Record<string, unknown> | undefined',
    '    const sellerFclRows = sellerEquipment?.fclContainers',
    '    const sellerLandRows = sellerEquipment?.landContainers',
    '    const sellerUnits = shipmentModeForApi.value === "Fcl" ? sellerFclRows : sellerLandRows',
    '    if (Array.isArray(sellerUnits)) {',
    '      restoreFclUnitWeights(sellerUnits as Array<{ containerTypeId: string; quantity?: number; unitWeightsKg?: number[] }>,',
    '        number(sellerEquipment?.cargoWeightKg))',
    '    }',
  ].join('\n')
  code = code.slice(0, requestHydrationStart)
    + requestHydration.replace(requestHydrationAnchor, requestRestoration)
    + code.slice(requestHydrationEnd)

  // The seller previously could send a positive aggregate with an empty unit
  // weight. Use it only for one container; multiple containers must be explicit.
  const saveRequestAnchor = 'async function saveOpenRequest() {'
  if (code.split(saveRequestAnchor).length !== 2) {
    throw new Error('[pricingFclUnitWeights] Falta el guardado de la solicitud.')
  }
  code = code.replace(saveRequestAnchor, saveRequestAnchor + [
    '',
    '  if (props.sellerRequestMode && (shipmentModeForApi.value === "Fcl" || shipmentModeForApi.value === "Ftl")) {',
    '    const units = shipmentModeForApi.value === "Fcl" ? fclContainerAllocations.value : landEquipmentAllocations.value',
    '    const unitCount = units.reduce((sum, row) => sum + Math.max(1, Math.trunc(number(row.quantity))), 0)',
    '    if (unitCount === 1 && units.length === 1',
    '      && fclUnitWeight(units[0]!.containerTypeId, 0) <= 0 && number(form.cargoWeightKg) > 0) {',
    '      setFclUnitWeight(units[0]!.containerTypeId, 0, number(form.cargoWeightKg))',
    '    }',
    '    if (fclMissingUnitCount.value > 0) {',
    '      toastStore.error("Indique el peso en kg de cada contenedor antes de enviar la solicitud a Pricing.")',
    '      return',
    '    }',
    '  }',
  ].join('\n'))

  // Requirements may add landExtraEquipment between the watched refs.
  const draftWatchStart = code.indexOf('watch(\n  [\n    () => step.value,')
  const draftWatchEnd = code.indexOf('  () => schedulePricingDraftSave()', draftWatchStart)
  if (draftWatchStart < 0 || draftWatchEnd < 0) {
    throw new Error('[pricingFclUnitWeights] No se encontró el autosave reactivo de pesos.')
  }
  const draftWatchSection = code.slice(draftWatchStart, draftWatchEnd)
  if (!draftWatchSection.includes('    fclExtraContainers,\n')) {
    throw new Error('[pricingFclUnitWeights] No se observa la distribución FCL en el autosave.')
  }
  code = code.slice(0, draftWatchStart)
    + draftWatchSection.replace('    fclExtraContainers,\n',
      '    fclExtraContainers,\n    fclUnitWeightsKg,\n')
    + code.slice(draftWatchEnd)

  // Requests created by Sales keep the full per-unit distribution as well.
  const requestFormAnchor = 'fclContainers: fclContainerAllocations.value, landContainers: landEquipmentAllocations.value'
  if (!code.includes(requestFormAnchor)) {
    throw new Error('[pricingFclUnitWeights] No se encontró la persistencia de contenedores en solicitudes.')
  }
  code = code.replace(requestFormAnchor, [
    'fclContainers: fclContainerAllocations.value.map((row) => ({',
    '  ...row, unitWeightsKg: fclUnitWeightsFor(row.containerTypeId, row.quantity),',
    '})), landContainers: landEquipmentAllocations.value.map((row) => ({',
    '  ...row, unitWeightsKg: fclUnitWeightsFor(row.containerTypeId, row.quantity),',
    '}))',
  ].join('\n'))

  // Preserve individual weights for saved rate create/update and request context.
  if (!code.includes('unitWeightsKg: fclUnitWeightsFor(row.containerTypeId, row.quantity)')) {
    throw new Error('[pricingFclUnitWeights] No se incluyeron los pesos por unidad en el payload.')
  }
  return code
}

export function pricingFclUnitWeights20261015(): Plugin {
  return {
    name: 'dhole-pricing-fcl-unit-weights-20261015',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
