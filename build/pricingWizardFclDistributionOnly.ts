import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOptional(source: string, anchor: string, replacement: string) {
  return source.includes(anchor) ? source.replace(anchor, replacement) : source
}

function patchWizard(source: string) {
  let code = source

  // FCL no debe tener una selección duplicada de tamaño/tipo/cantidad fuera de la distribución.
  code = replaceOptional(
    code,
    `v-if="shipmentModeForApi !== 'Lcl'" class="grid gap-4 md:grid-cols-3"`,
    `v-if="shipmentModeForApi !== 'Lcl' && shipmentModeForApi !== 'Fcl'" class="grid gap-4 md:grid-cols-3"`,
  )

  // Las leyendas intermedias agregaban ruido visual y repetían lo que ya dicen los campos.
  const routeLegend = `            <div class="flex items-center gap-3 border-t border-[var(--dh-border)] pt-5">\n              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.08)] text-[var(--dh-primary)]"><Waypoints class="h-4 w-4" /></span>\n              <div>\n                <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-soft)]">Ruta logística</p>\n                <p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">Defina POL, POE y destino final cuando corresponda.</p>\n              </div>\n            </div>\n\n`
  code = replaceOptional(code, routeLegend, '')

  const equipmentLegend = `            <div class="flex items-center gap-3 border-t border-[var(--dh-border)] pt-5">\n              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.08)] text-[var(--dh-primary)]">\n                <Truck v-if="form.modality === 'Land'" class="h-4 w-4" />\n                <Ship v-else class="h-4 w-4" />\n              </span>\n              <div>\n                <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-soft)]">{{ form.modality === 'Land' ? 'Equipo terrestre' : 'Equipo de transporte' }}</p>\n                <p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">Seleccione el equipo base y la cantidad requerida.</p>\n              </div>\n            </div>\n\n`
  code = replaceOptional(code, equipmentLegend, '')

  const fclMarker = `<div v-if="shipmentModeForApi === 'Fcl'"`
  const fclStart = code.indexOf(fclMarker)
  const row4Anchor = `            <!-- Fila 4: Incoterm y fecha de carga lista. -->`
  const row4Index = code.indexOf(row4Anchor, Math.max(0, fclStart))

  if (fclStart < 0 || row4Index < 0 || row4Index <= fclStart) {
    throw new Error('[pricingWizardFclDistributionOnly] FCL distribution block was not found.')
  }

  const compactFclBlock = `            <div v-if="shipmentModeForApi === 'Fcl'" class="overflow-hidden rounded-[22px] border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[rgb(var(--dh-primary-rgb)/0.035)]">\n              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--dh-primary-rgb)/0.16)] px-4 py-4 md:px-5">\n                <p class="font-black text-[var(--dh-text)]">Distribución de contenedores FCL</p>\n                <DhButton variant="secondary" :disabled="!canAddFclContainer" @click="addFclContainer">\n                  <Plus class="h-4 w-4" /> Añadir contenedor\n                </DhButton>\n              </div>\n\n              <div class="space-y-3 p-4 md:p-5">\n                <div class="rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[rgb(var(--dh-primary-rgb)/0.055)] p-4">\n                  <div class="mb-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Contenedor 1</div>\n                  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-end">\n                    <PricingContainerSelector\n                      v-model="form.equipmentId"\n                      transport="maritime"\n                      :excluded-equipment-ids="fclExtraContainers.map((row) => row.containerTypeId).filter(Boolean)"\n                      :show-resolved-label="false"\n                    />\n                    <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" label="Cantidad" />\n                  </div>\n                </div>\n\n                <div\n                  v-for="(row, index) in fclExtraContainers"\n                  :key="row.key"\n                  class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"\n                >\n                  <div class="mb-3 flex items-center justify-between gap-3">\n                    <span class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Contenedor {{ index + 2 }}</span>\n                    <DhButton variant="danger" size="sm" @click="removeFclContainer(row.key)">Quitar</DhButton>\n                  </div>\n                  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-end">\n                    <PricingContainerSelector\n                      v-model="row.containerTypeId"\n                      transport="maritime"\n                      :excluded-equipment-ids="fclExtraExcludedEquipmentIds(row.key)"\n                      :show-resolved-label="false"\n                    />\n                    <DhInput v-model.number="row.quantity" type="number" min="1" label="Cantidad" />\n                  </div>\n                </div>\n\n                <div v-if="selectedEquipment" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.20)] bg-[rgb(var(--dh-primary-rgb)/0.07)] px-4 py-3">\n                  <strong class="text-sm text-[var(--dh-primary)]">Total: {{ fclContainerTotal }} contenedores · {{ fclContainerTeu }} TEU</strong>\n                  <div class="flex flex-wrap gap-2">\n                    <span\n                      v-for="allocation in fclContainerAllocations"\n                      :key="'compact-summary:' + allocation.containerTypeId"\n                      class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-1 text-[11px] font-black text-[var(--dh-text-soft)]"\n                    >\n                      {{ allocation.quantity }} × {{ allocation.containerTypeName }}\n                    </span>\n                  </div>\n                </div>\n              </div>\n            </div>\n\n`

  // Reemplaza también la leyenda de "Vigencia y términos" que quedaba entre FCL y Fila 4.
  code = code.slice(0, fclStart) + compactFclBlock + code.slice(row4Index)

  return code
}

export function pricingWizardFclDistributionOnly(): Plugin {
  return {
    name: 'dhole-pricing-wizard-fcl-distribution-only',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
