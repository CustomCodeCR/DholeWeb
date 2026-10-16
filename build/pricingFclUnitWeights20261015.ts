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

  const script = `
const fclUnitWeightsKg = ref<Record<string, number[]>>({})

function fclUnitWeight(typeId: string, index: number) {
  const saved = fclUnitWeightsKg.value[typeId]?.[index]
  if (saved !== undefined) return Math.max(0, number(saved))
  // Las cotizaciones anteriores de una sola unidad tenían solo peso total.
  if (form.equipmentId === typeId && Math.trunc(number(form.equipmentQuantity)) === 1
    && (shipmentModeForApi.value === 'Ftl' || fclContainerTotal.value === 1))
    return Math.max(0, number(form.cargoWeightKg))
  return 0
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

function restoreFclUnitWeights(value: Array<{ containerTypeId: string; unitWeightsKg?: number[] | null }>) {
  fclUnitWeightsKg.value = Object.fromEntries(value.map((row) => [
    row.containerTypeId, Array.isArray(row.unitWeightsKg)
      ? row.unitWeightsKg.map((kg) => Math.max(0, number(kg)))
      : [],
  ]))
}

watch(
  () => [shipmentModeForApi.value, fclOverweightUnitCount.value] as const,
  ([mode, count]) => {
    if (mode === 'Fcl' || mode === 'Ftl') form.overweight = count > 0
  },
  { immediate: true },
)

watch(
  () => [shipmentModeForApi.value, form.equipmentId, JSON.stringify(fclUnitWeightsKg.value)] as const,
  ([mode]) => {
    if (mode !== 'Fcl' && mode !== 'Ftl') return
    const weights = mode === 'Fcl'
      ? fclContainerAllocations.value.flatMap((row) => fclUnitWeightsFor(row.containerTypeId, row.quantity))
      : landEquipmentAllocations.value.flatMap((row) => fclUnitWeightsFor(row.containerTypeId, row.quantity))
    // No sobrescribir el dato agregado de un registro antiguo mientras no se indiquen pesos por unidad.
    if (weights.some((kg) => kg > 0))
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
      code = code.slice(0, at + line.length) + '\n  restoreFclUnitWeights(allocations)' + code.slice(at + line.length)
  }
  // La hidratación de una tarifa FTL también debe restaurar sus pesos por equipo.
  const hydrate = '    const restoredMixedFclFreight = restorePersistedFclDistribution(rate)'
  if (code.includes(hydrate))
    code = code.replace(hydrate, '    restoreFclUnitWeights((rate.containers ?? []).filter((container) => number(container.quantity) > 0))\n' + hydrate)

  const requestRows = '  const rows = value as Array<Record<string, unknown>>'
  if (code.includes(requestRows))
    code = code.replace(requestRows, requestRows + '\n  restoreFclUnitWeights(rows.map((row) => ({ containerTypeId: String(row.containerTypeId ?? ""), unitWeightsKg: Array.isArray(row.unitWeightsKg) ? row.unitWeightsKg.map((kg) => number(kg)) : [] })))')

  if (code.includes('function resetWizard() {'))
    code = code.replace('function resetWizard() {', 'function resetWizard() {\n  fclUnitWeightsKg.value = {}')

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

  const primaryFclWeights = "<div class=\"mt-2 rounded-lg border border-[rgb(var(--dh-primary-rgb)/0.12)] bg-[rgb(var(--dh-primary-rgb)/0.02)] px-3 py-2\">\n                    <div class=\"mb-2 flex flex-wrap items-center justify-between gap-2\">\n                      <div>\n                        <p class=\"text-xs font-black uppercase tracking-wider text-[var(--dh-text)]\">Peso por unidad (kg)</p>\n                        \n                      </div>\n                      <span v-if=\"fclGroupOverweightUnits(form.equipmentId, form.equipmentQuantity)\" class=\"rounded-full border border-[rgb(var(--dh-primary-rgb)/0.35)] px-2.5 py-1 text-xs font-bold text-[var(--dh-primary)]\">{{ fclGroupOverweightUnits(form.equipmentId, form.equipmentQuantity) }} con sobrepeso</span>\n                    </div>\n                    <div class=\"grid gap-2 sm:grid-cols-2 xl:grid-cols-4\">\n                      <div v-for=\"unitNumber in Math.max(1, Math.trunc(Number(form.equipmentQuantity)))\" :key=\"'primary-weight:' + unitNumber\" class=\"rounded-md border border-[var(--dh-border)] bg-transparent px-2 py-1.5\">\n                        <DhInput :model-value=\"fclUnitWeight(form.equipmentId, unitNumber - 1)\" type=\"number\" min=\"0\" step=\"1\" :label=\"'Unidad ' + unitNumber + ' · peso (kg) *'\" @update:model-value=\"(value) => setFclUnitWeight(form.equipmentId, unitNumber - 1, Number(value))\" />\n                        <p class=\"mt-1 text-[11px] font-medium\" :class=\"fclUnitIsOverweight(fclUnitWeight(form.equipmentId, unitNumber - 1)) ? 'text-[var(--dh-primary)]' : 'text-[var(--dh-text-muted)]'\">{{ fclUnitIsOverweight(fclUnitWeight(form.equipmentId, unitNumber - 1)) ? 'Con sobrepeso' : fclUnitWeight(form.equipmentId, unitNumber - 1) > 0 ? 'Sin sobrepeso' : 'Peso pendiente' }}</p>\n                      </div>\n                    </div>\n                  </div>"
  const additionalFclWeights = "<div class=\"mt-2 rounded-lg border border-[rgb(var(--dh-primary-rgb)/0.12)] bg-[rgb(var(--dh-primary-rgb)/0.02)] px-3 py-2\">\n                    <div class=\"mb-2 flex flex-wrap items-center justify-between gap-2\">\n                      <div>\n                        <p class=\"text-xs font-black uppercase tracking-wider text-[var(--dh-text)]\">Peso por unidad (kg)</p>\n                        \n                      </div>\n                      <span v-if=\"fclGroupOverweightUnits(row.containerTypeId, row.quantity)\" class=\"rounded-full border border-[rgb(var(--dh-primary-rgb)/0.35)] px-2.5 py-1 text-xs font-bold text-[var(--dh-primary)]\">{{ fclGroupOverweightUnits(row.containerTypeId, row.quantity) }} con sobrepeso</span>\n                    </div>\n                    <div class=\"grid gap-2 sm:grid-cols-2 xl:grid-cols-4\">\n                      <div v-for=\"unitNumber in Math.max(1, Math.trunc(Number(row.quantity)))\" :key=\"'additional-weight:' + unitNumber\" class=\"rounded-md border border-[var(--dh-border)] bg-transparent px-2 py-1.5\">\n                        <DhInput :model-value=\"fclUnitWeight(row.containerTypeId, unitNumber - 1)\" type=\"number\" min=\"0\" step=\"1\" :label=\"'Unidad ' + unitNumber + ' · peso (kg) *'\" @update:model-value=\"(value) => setFclUnitWeight(row.containerTypeId, unitNumber - 1, Number(value))\" />\n                        <p class=\"mt-1 text-[11px] font-medium\" :class=\"fclUnitIsOverweight(fclUnitWeight(row.containerTypeId, unitNumber - 1)) ? 'text-[var(--dh-primary)]' : 'text-[var(--dh-text-muted)]'\">{{ fclUnitIsOverweight(fclUnitWeight(row.containerTypeId, unitNumber - 1)) ? 'Con sobrepeso' : fclUnitWeight(row.containerTypeId, unitNumber - 1) > 0 ? 'Sin sobrepeso' : 'Peso pendiente' }}</p>\n                      </div>\n                    </div>\n                  </div>"

  // El peso FCL se muestra en la tarjeta roja de cada contenedor. FTL mantiene su bloque propio.
  const weightUi = `
            <section v-if="shipmentModeForApi === 'Ftl'" class="space-y-4 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 md:p-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="font-black">Peso individual de los furgones</h3>
                  <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Registre el peso de cada furgón. Sobrepeso: más de 21.500 kg cuando el POE es Centroamérica, excepto Panamá.</p>
                </div>
                <span class="rounded-full border border-[var(--dh-border)] px-3 py-1 text-xs font-black">{{ fclOverweightUnitCount }} con sobrepeso</span>
              </div>
              <div v-if="landEquipmentAllocations.length" class="space-y-3">
                <div v-for="group in landEquipmentAllocations" :key="'ftl:' + group.containerTypeId" class="rounded-xl border border-[var(--dh-border)] p-3">
                  <p class="mb-3 text-sm font-bold">{{ group.quantity }} × {{ group.containerTypeName }}</p>
                  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div v-for="unitNumber in group.quantity" :key="'ftl-weight:' + group.containerTypeId + ':' + unitNumber" class="rounded-xl border border-[var(--dh-border)] p-3">
                      <DhInput :model-value="fclUnitWeight(group.containerTypeId, unitNumber - 1)" type="number" min="0" step="1" :label="'Furgón ' + unitNumber + ' · peso (kg) *'" @update:model-value="(value) => setFclUnitWeight(group.containerTypeId, unitNumber - 1, Number(value))" />
                      <p class="mt-2 text-xs font-bold" :class="fclUnitIsOverweight(fclUnitWeight(group.containerTypeId, unitNumber - 1)) ? 'text-[var(--dh-primary)]' : 'text-[var(--dh-text-muted)]'">{{ fclUnitIsOverweight(fclUnitWeight(group.containerTypeId, unitNumber - 1)) ? 'Con sobrepeso' : 'Sin sobrepeso' }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <p v-if="fclMissingUnitCount > 0" class="text-xs font-bold text-[var(--dh-primary)]">Pendientes de peso: {{ fclMissingUnitCount }} equipos.</p>
            </section>

`
  const row4 = '<!-- Fila 4: Incoterm y fecha de carga lista. -->'
  if (!code.includes(row4)) throw new Error('[pricingFclUnitWeights] No se encontró la posición de los pesos en pantalla 3.')

  // Solo el terrestre usa un panel separado; FCL se integra en sus tarjetas rojas.
  code = code.replace(row4, weightUi + row4)

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

  // Anclar los campos debajo de la fila de cantidad del contenedor correspondiente.
  // Los plugins anteriores pueden cambiar clases, identación y atributos de DhInput.
  const addWeightControls = (model: string, markup: string) => {
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
      throw new Error('[pricingFclUnitWeights] No se encontró una única cantidad para ' + model + '.')
    }
    const inputPos = occurrences[0]!
    const endOfInput = distribution.indexOf('/>', inputPos)
    const endOfQuantityGrid = distribution.indexOf('</div>', endOfInput + 2)
    if (endOfInput < 0 || endOfQuantityGrid < 0 || endOfQuantityGrid - endOfInput > 500) {
      throw new Error('[pricingFclUnitWeights] No se encontró el cierre de la fila de ' + model + '.')
    }
    const insertAt = endOfQuantityGrid + '</div>'.length
    distribution = distribution.slice(0, insertAt) + '\n' + markup + distribution.slice(insertAt)
  }
  addWeightControls('form.equipmentQuantity', primaryFclWeights)
  addWeightControls('row.quantity', additionalFclWeights)
  code = code.slice(0, fclHeading) + distribution + code.slice(distributionEnd)

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

  const draftRestoreAnchor = "    if (typeof draft.rateCarrierFilter === 'string') rateCarrierFilter.value = draft.rateCarrierFilter"
  if (!code.includes(draftRestoreAnchor)) {
    throw new Error('[pricingFclUnitWeights] No se encontró la restauración del borrador.')
  }
  code = code.replace(draftRestoreAnchor, draftRestoreAnchor + '\n' + [
    '    if (draft.fclUnitWeightsKg && typeof draft.fclUnitWeightsKg === "object" && !Array.isArray(draft.fclUnitWeightsKg)) {',
    '      restoreFclUnitWeights(Object.entries(draft.fclUnitWeightsKg).map(([containerTypeId, weights]) => ({',
    '        containerTypeId,',
    '        unitWeightsKg: Array.isArray(weights) ? weights.map((weight) => Math.max(0, Math.min(100000, number(weight)))) : [],',
    '      })))',
    '    }',
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
