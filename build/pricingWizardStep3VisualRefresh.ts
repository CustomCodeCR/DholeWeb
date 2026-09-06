import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOptional(source: string, anchor: string, replacement: string) {
  return source.includes(anchor) ? source.replace(anchor, replacement) : source
}

function patchWizard(source: string) {
  let code = source

  const step3Marker = '<div v-else-if="step === 3"'
  const step3Start = code.indexOf(step3Marker)
  if (step3Start < 0) {
    throw new Error('[pricingWizardStep3VisualRefresh] Step 3 was not found.')
  }

  const step3OpenEnd = code.indexOf('>', step3Start)
  if (step3OpenEnd > step3Start) {
    const step3OpenTag = code.slice(step3Start, step3OpenEnd + 1)
    const refreshedStep3OpenTag = step3OpenTag.includes('class=')
      ? step3OpenTag.replace(/class="[^"]*"/, 'class="space-y-5"')
      : step3OpenTag.replace('>', ' class="space-y-5">')
    code = code.slice(0, step3Start) + refreshedStep3OpenTag + code.slice(step3OpenEnd + 1)
  }

  const refreshedStep3Start = code.indexOf(step3Marker)
  const generalCardStart = code.indexOf('<div class="crystal-soft', refreshedStep3Start)
  if (generalCardStart < 0) {
    throw new Error('[pricingWizardStep3VisualRefresh] General information card was not found.')
  }

  const generalCardOpenEnd = code.indexOf('>', generalCardStart)
  if (generalCardOpenEnd < 0) {
    throw new Error('[pricingWizardStep3VisualRefresh] General information card opening tag is invalid.')
  }

  const refreshedGeneralOpen = `<div class="overflow-hidden rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[0_18px_48px_rgb(0_0_0/0.10)]">\n            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] bg-[rgb(var(--dh-primary-rgb)/0.045)] px-4 py-4 md:px-5">\n              <div class="flex min-w-0 items-center gap-3">\n                <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.22)] bg-[rgb(var(--dh-primary-rgb)/0.10)] text-[var(--dh-primary)]">\n                  <Waypoints class="h-5 w-5" />\n                </span>\n                <div class="min-w-0">\n                  <p class="text-sm font-black text-[var(--dh-text)]">Información general</p>\n                  <p class="mt-0.5 text-xs font-semibold text-[var(--dh-text-muted)]">Ruta, cliente, equipo y condiciones base de la alternativa.</p>\n                </div>\n              </div>\n              <DhBadge variant="primary">Datos de la alternativa</DhBadge>\n            </div>\n\n            <div class="space-y-5 p-4 md:p-5 lg:p-6">`

  code = code.slice(0, generalCardStart) + refreshedGeneralOpen + code.slice(generalCardOpenEnd + 1)

  const exwMarker = `<div v-if="selectedIncotermCode === 'EXW' || selectedIncotermCode === 'FCA'"`
  const exwStart = code.indexOf(exwMarker, generalCardStart)
  if (exwStart < 0) {
    throw new Error('[pricingWizardStep3VisualRefresh] EXW/FCA block was not found after Step 3 form.')
  }

  code = code.slice(0, exwStart) + `          </div>\n\n          ` + code.slice(exwStart)

  code = replaceOptional(
    code,
    `            <!-- Fila 2: buscadores de ubicación estilo freight search. CY = Container Yard; SD = Store Door. -->`,
    `            <div class="flex items-center gap-3 border-t border-[var(--dh-border)] pt-5">\n              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.08)] text-[var(--dh-primary)]"><Waypoints class="h-4 w-4" /></span>\n              <div>\n                <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-soft)]">Ruta logística</p>\n                <p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">Defina POL, POE y destino final cuando corresponda.</p>\n              </div>\n            </div>\n\n            <!-- Fila 2: buscadores de ubicación estilo freight search. CY = Container Yard; SD = Store Door. -->`,
  )

  code = replaceOptional(
    code,
    `label="POD"\n                placeholder="Buscar destino final"`,
    `label="POD (opcional)"\n                placeholder="Buscar destino final"`,
  )

  code = replaceOptional(
    code,
    `            <!-- Fila 3: tamaño, tipo y cantidad del equipo. -->`,
    `            <div class="flex items-center gap-3 border-t border-[var(--dh-border)] pt-5">\n              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.08)] text-[var(--dh-primary)]">\n                <Truck v-if="form.modality === 'Land'" class="h-4 w-4" />\n                <Ship v-else class="h-4 w-4" />\n              </span>\n              <div>\n                <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-soft)]">{{ form.modality === 'Land' ? 'Equipo terrestre' : 'Equipo de transporte' }}</p>\n                <p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">Seleccione el equipo base y la cantidad requerida.</p>\n              </div>\n            </div>\n\n            <!-- Fila 3: tamaño, tipo y cantidad del equipo. -->`,
  )

  const fclMarker = `<div v-if="shipmentModeForApi === 'Fcl'"`
  const fclStart = code.indexOf(fclMarker, generalCardStart)
  const row4Anchor = `            <!-- Fila 4: Incoterm y fecha de carga lista. -->`
  const row4Index = code.indexOf(row4Anchor, Math.max(generalCardStart, fclStart))

  if (fclStart < 0 || row4Index < 0 || row4Index <= fclStart) {
    throw new Error('[pricingWizardStep3VisualRefresh] FCL distribution block was not found after commercial automation.')
  }

  const refreshedFclBlock = `            <div v-if="shipmentModeForApi === 'Fcl'" class="overflow-hidden rounded-[22px] border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[rgb(var(--dh-primary-rgb)/0.035)] shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">\n              <div class="flex flex-wrap items-center justify-between gap-4 border-b border-[rgb(var(--dh-primary-rgb)/0.16)] px-4 py-4 md:px-5">\n                <div class="flex min-w-0 items-center gap-3">\n                  <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">\n                    <Ship class="h-5 w-5" />\n                  </span>\n                  <div class="min-w-0">\n                    <div class="flex flex-wrap items-center gap-2">\n                      <p class="font-black text-[var(--dh-text)]">Distribución de contenedores FCL</p>\n                      <DhBadge variant="primary">Composición mixta</DhBadge>\n                    </div>\n                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Combine varios tipos en la misma cotización, por ejemplo 1 × 20DV + 5 × 40HC.</p>\n                  </div>\n                </div>\n                <DhButton variant="secondary" :disabled="!selectedEquipment" @click="addFclContainer">\n                  <Plus class="h-4 w-4" /> Añadir contenedor\n                </DhButton>\n              </div>\n\n              <div v-if="selectedEquipment" class="space-y-3 p-4 md:p-5">\n                <div class="grid gap-4 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[rgb(var(--dh-primary-rgb)/0.06)] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,1.1fr)_150px] lg:items-end">\n                  <div class="flex min-w-0 items-center gap-3">\n                    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.14)] text-[var(--dh-primary)]"><Ship class="h-4 w-4" /></span>\n                    <div class="min-w-0">\n                      <DhBadge variant="primary">Principal</DhBadge>\n                      <p class="mt-2 truncate text-sm font-black text-[var(--dh-text)]">{{ displayValue(selectedEquipment) }}</p>\n                    </div>\n                  </div>\n                  <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2.5">\n                    <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Tipo de contenedor</span>\n                    <strong class="mt-1 block text-sm">{{ displayValue(selectedEquipment) }}</strong>\n                  </div>\n                  <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" label="Cantidad" />\n                </div>\n\n                <div\n                  v-for="row in fclExtraContainers"\n                  :key="row.key"\n                  class="grid gap-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 lg:grid-cols-[180px_minmax(260px,1fr)_150px_auto] lg:items-end"\n                >\n                  <div class="flex items-center gap-3 lg:pb-1">\n                    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/5 text-[var(--dh-text-soft)] dark:bg-white/[0.06]"><Ship class="h-4 w-4" /></span>\n                    <DhBadge variant="neutral">Adicional</DhBadge>\n                  </div>\n                  <DhSelect v-model="row.containerTypeId" label="Tipo de contenedor" :options="fclExtraContainerOptions(row.key)" />\n                  <DhInput v-model.number="row.quantity" type="number" min="1" label="Cantidad" />\n                  <DhButton variant="danger" @click="removeFclContainer(row.key)">Quitar</DhButton>\n                </div>\n\n                <div class="flex flex-col gap-3 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.22)] bg-[rgb(var(--dh-primary-rgb)/0.075)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">\n                  <div>\n                    <span class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Resumen del equipo</span>\n                    <p class="mt-1 text-sm font-black text-[var(--dh-primary)]">Total: {{ fclContainerTotal }} contenedores · {{ fclContainerTeu }} TEU</p>\n                  </div>\n                  <div class="flex flex-wrap gap-2">\n                    <span v-for="allocation in fclContainerAllocations" :key="'summary:' + allocation.containerTypeId" class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-1.5 text-[11px] font-black text-[var(--dh-text-soft)]">\n                      {{ allocation.quantity }} × {{ allocation.containerTypeName }}\n                    </span>\n                  </div>\n                </div>\n              </div>\n\n              <div v-else class="px-5 py-5 text-xs font-semibold text-[var(--dh-text-muted)]">\n                Seleccione primero el equipo principal para habilitar la composición FCL.\n              </div>\n            </div>\n\n`

  code = code.slice(0, fclStart) + refreshedFclBlock + code.slice(row4Index)

  const refreshedRow4Index = code.indexOf(row4Anchor, generalCardStart)
  if (refreshedRow4Index >= 0) {
    const row4GridStart = code.indexOf('<div class="grid gap-4', refreshedRow4Index)
    if (row4GridStart >= 0) {
      const row4GridEnd = code.indexOf('>', row4GridStart)
      const oldGridTag = code.slice(row4GridStart, row4GridEnd + 1)
      const newGridTag = oldGridTag.replace(/class="[^"]*"/, 'class="grid gap-4 lg:grid-cols-3"')
      const termsHeading = `<div class="flex items-center gap-3 border-t border-[var(--dh-border)] pt-5">\n              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.08)] text-[var(--dh-primary)]"><Check class="h-4 w-4" /></span>\n              <div>\n                <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-soft)]">Vigencia y términos</p>\n                <p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">Defina Incoterm, vigencia de la alternativa y servicios aplicables.</p>\n              </div>\n            </div>\n\n            `
      code = code.slice(0, refreshedRow4Index) + termsHeading + code.slice(refreshedRow4Index, row4GridStart) + newGridTag + code.slice(row4GridEnd + 1)
    }
  }

  return code
}

export function pricingWizardStep3VisualRefresh(): Plugin {
  return {
    name: 'dhole-pricing-wizard-step3-visual-refresh',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
