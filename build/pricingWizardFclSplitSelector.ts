import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardFclSplitSelector] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'`,
    `import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'\nimport PricingContainerSelector from '@/modules/pricing/components/PricingContainerSelector.vue'`,
    'container selector import',
  )

  const addContainerAnchor = `function addFclContainer() {\n  const used = new Set([form.equipmentId, ...fclExtraContainers.value.map((row) => row.containerTypeId)].filter(Boolean))\n  const next = catalogs.containers.find((item) => !used.has(item.id))\n  fclExtraContainers.value.push({\n    key: crypto.randomUUID(),\n    containerTypeId: next?.id ?? '',\n    quantity: 1,\n    freightCostAmount: number(form.freightCost),\n    freightSaleAmount: number(form.freightSale),\n    freightTouched: false,\n  })\n}`

  const addContainerReplacement = `const canAddFclContainer = computed(() => {\n  if (!selectedEquipment.value) return false\n  if (fclExtraContainers.value.some((row) => !row.containerTypeId)) return false\n\n  const used = new Set(\n    [form.equipmentId, ...fclExtraContainers.value.map((row) => row.containerTypeId)].filter(Boolean),\n  )\n  return catalogs.containers.some((item) => !used.has(item.id))\n})\n\nfunction fclExtraExcludedEquipmentIds(rowKey: string) {\n  return [\n    form.equipmentId,\n    ...fclExtraContainers.value\n      .filter((row) => row.key !== rowKey)\n      .map((row) => row.containerTypeId),\n  ].filter(Boolean)\n}\n\nfunction addFclContainer() {\n  if (!canAddFclContainer.value) return\n\n  fclExtraContainers.value.push({\n    key: crypto.randomUUID(),\n    containerTypeId: '',\n    quantity: 1,\n    freightCostAmount: number(form.freightCost),\n    freightSaleAmount: number(form.freightSale),\n    freightTouched: false,\n  })\n}`

  code = replaceOne(code, addContainerAnchor, addContainerReplacement, 'extra FCL state')

  code = replaceOne(
    code,
    `:disabled="!selectedEquipment" @click="addFclContainer"`,
    `:disabled="!canAddFclContainer" @click="addFclContainer"`,
    'add container availability',
  )

  code = replaceOne(
    code,
    `Combine varios tipos en la misma cotización, por ejemplo 1 × 20DV + 5 × 40HC.`,
    `Añada cada contenedor y seleccione primero el tamaño y después el tipo. Ejemplo: 1 × 20DV + 5 × 40HC.`,
    'FCL guidance',
  )

  const oldAdditionalRow = `                <div\n                  v-for="row in fclExtraContainers"\n                  :key="row.key"\n                  class="grid gap-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 lg:grid-cols-[180px_minmax(260px,1fr)_150px_auto] lg:items-end"\n                >\n                  <div class="flex items-center gap-3 lg:pb-1">\n                    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/5 text-[var(--dh-text-soft)] dark:bg-white/[0.06]"><Ship class="h-4 w-4" /></span>\n                    <DhBadge variant="neutral">Adicional</DhBadge>\n                  </div>\n                  <DhSelect v-model="row.containerTypeId" label="Tipo de contenedor" :options="fclExtraContainerOptions(row.key)" />\n                  <DhInput v-model.number="row.quantity" type="number" min="1" label="Cantidad" />\n                  <DhButton variant="danger" @click="removeFclContainer(row.key)">Quitar</DhButton>\n                </div>`

  const newAdditionalRow = `                <div\n                  v-for="(row, index) in fclExtraContainers"\n                  :key="row.key"\n                  class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 transition-shadow hover:shadow-[0_12px_28px_rgb(0_0_0/0.08)]"\n                >\n                  <div class="mb-4 flex flex-wrap items-center justify-between gap-3">\n                    <div class="flex items-center gap-3">\n                      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/5 text-[var(--dh-text-soft)] dark:bg-white/[0.06]"><Ship class="h-4 w-4" /></span>\n                      <div>\n                        <div class="flex flex-wrap items-center gap-2">\n                          <DhBadge variant="neutral">Adicional {{ index + 1 }}</DhBadge>\n                          <span v-if="!row.containerTypeId" class="text-[11px] font-bold text-[var(--dh-text-muted)]">Pendiente de completar</span>\n                        </div>\n                        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Seleccione en orden: <strong>1. Tamaño</strong> → <strong>2. Tipo</strong>.</p>\n                      </div>\n                    </div>\n                    <DhButton variant="danger" @click="removeFclContainer(row.key)">Quitar</DhButton>\n                  </div>\n\n                  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-end">\n                    <PricingContainerSelector\n                      v-model="row.containerTypeId"\n                      transport="maritime"\n                      :excluded-equipment-ids="fclExtraExcludedEquipmentIds(row.key)"\n                    />\n                    <DhInput v-model.number="row.quantity" type="number" min="1" label="Cantidad" />\n                  </div>\n                </div>`

  code = replaceOne(code, oldAdditionalRow, newAdditionalRow, 'additional container row')

  return code
}

export function pricingWizardFclSplitSelector(): Plugin {
  return {
    name: 'dhole-pricing-wizard-fcl-split-selector',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
