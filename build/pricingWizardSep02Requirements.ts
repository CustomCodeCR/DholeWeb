import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardSep02Requirements] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `function selectDefaultService() {
  const internationalTransport = catalogs.services.find((item) =>
    normalizeCatalogValue(displayValue(item)).includes('transporte internacional'),
  )
  form.serviceIds = internationalTransport ? [internationalTransport.id] : []
}`,
    `const entryLogisticsService = ref<'customs' | 'international' | ''>('')

function resolveEntryLogisticsService(kind: 'customs' | 'international') {
  const keywords = kind === 'customs'
    ? ['agencia aduanal', 'agencia de aduanas', 'aduana']
    : ['transporte internacional']
  return catalogs.services.find((item) => {
    const label = normalizeCatalogValue(displayValue(item))
    return keywords.some((keyword) => label.includes(normalizeCatalogValue(keyword)))
  }) ?? null
}

function chooseEntryLogisticsService(kind: 'customs' | 'international') {
  const service = resolveEntryLogisticsService(kind)
  if (!service) {
    toastStore.warning(
      'Servicio no configurado',
      kind === 'customs'
        ? 'No se encontró Agencia Aduanal en el catálogo de servicios.'
        : 'No se encontró Transporte Internacional en el catálogo de servicios.',
    )
    return
  }
  entryLogisticsService.value = kind
  form.serviceIds = [service.id]
}

function selectDefaultService() {
  // Pantalla 0 owns the initial service selection. Never overwrite it when the
  // user chooses a transport modality in Pantalla 1.
  if (form.serviceIds.length > 0 || !entryLogisticsService.value) return
  const selected = resolveEntryLogisticsService(entryLogisticsService.value)
  form.serviceIds = selected ? [selected.id] : []
}`,
    'screen 0 service selection',
  )

  code = replaceOne(
    code,
    `      <template v-else>
        <div v-if="step === 1" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 1</p>
            <h2 class="crystal-title">Seleccione la modalidad</h2>
            <p class="crystal-description">Al elegir una modalidad se agrega Transporte Internacional como servicio inicial.</p>
          </div>`,
    `      <template v-else>
        <div v-if="step === 1 && !isEditing && !entryLogisticsService" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 0</p>
            <h2 class="crystal-title">Seleccione el servicio logístico</h2>
            <p class="crystal-description">El servicio elegido queda seleccionado automáticamente cuando llegue a la selección de servicios de la tarifa.</p>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              class="crystal-choice group min-h-[170px] text-left"
              @click="chooseEntryLogisticsService('customs')"
            >
              <span class="crystal-icon">
                <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M4 20h16M5 20V9l7-5 7 5v11M9 20v-6h6v6M8 10h.01M12 10h.01M16 10h.01" />
                </svg>
              </span>
              <span class="mt-5 block text-lg font-black">Agencia Aduanal</span>
              <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">Trámites y gestión aduanera.</span>
            </button>

            <button
              type="button"
              class="crystal-choice group min-h-[170px] text-left"
              @click="chooseEntryLogisticsService('international')"
            >
              <span class="crystal-icon">
                <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M3 17h18M5 17l2 3h10l2-3M6 14V7h12v7M9 7V4h6v3" />
                </svg>
              </span>
              <span class="mt-5 block text-lg font-black">Transporte Internacional</span>
              <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">Movimiento internacional de la carga.</span>
            </button>
          </div>
        </div>

        <div v-else-if="step === 1" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 1</p>
            <h2 class="crystal-title">Seleccione la modalidad</h2>
            <p class="crystal-description">El servicio inicial seleccionado en Pantalla 0 se conserva para la tarifa.</p>
            <button
              v-if="!isEditing"
              type="button"
              class="mt-2 text-xs font-black text-[var(--dh-primary)] hover:underline"
              @click="entryLogisticsService = ''; form.serviceIds = []"
            >
              Cambiar servicio logístico
            </button>
          </div>`,
    'screen 0 template',
  )

  code = replaceOne(
    code,
    `            >
              <span class="text-lg font-black">{{ option.label }}</span>
              <Check v-if="form.shipmentMode === option.value" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />`,
    `            >
              <span v-if="option.value === 'FCL'" class="mb-3 inline-flex h-12 w-14 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-primary)]" aria-label="Contenedor completo">
                <svg viewBox="0 0 56 40" class="h-9 w-12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect x="4" y="8" width="48" height="25" rx="2" />
                  <path d="M10 9v23M16 9v23M22 9v23M28 9v23M34 9v23M40 9v23M46 9v23M4 33h48" />
                </svg>
              </span>
              <span v-else-if="option.value === 'LCL'" class="mb-3 inline-flex h-12 w-14 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-primary)]" aria-label="Contenedor con puertas abiertas">
                <svg viewBox="0 0 64 44" class="h-9 w-14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M17 8h30v27H17zM22 9v25M28 9v25M34 9v25M40 9v25" />
                  <path d="M17 10 5 5v31l12-3M47 10l12-5v31l-12-3" />
                  <path d="M8 10v20M56 10v20" />
                </svg>
              </span>
              <span class="block text-lg font-black">{{ option.label }}</span>
              <Check v-if="form.shipmentMode === option.value" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />`,
    'FCL/LCL shipment icons',
  )

  code = code.replace(
    `label="Peso total kg"`,
    `:label="shipmentMode === 'LCL' ? 'Peso total kg (opcional)' : 'Peso total kg'"`,
  )
  code = code.replace(
    `label="Peso bruto total (kg)"`,
    `:label="shipmentMode === 'LCL' ? 'Peso bruto total (kg) · opcional' : 'Peso bruto total (kg)'"`,
  )
  code = code.replace(
    `Complete peso y/o dimensiones.`,
    `El peso es opcional; complete peso y/o dimensiones para determinar el CBM cobrable.`,
  )

  code = replaceOne(
    code,
    `const selectedAgent = computed(() => findById(catalogs.agents, form.agentId))`,
    `const selectedAgent = computed(() => findById(catalogs.agents, form.agentId))
const fclAgentContacts = computed(() => {
  if (!selectedAgent.value) return [] as WarehouseContactDirectoryEntry[]
  const meta = metadata(selectedAgent.value)
  const directory = Array.isArray(meta?.contactDirectory) ? meta.contactDirectory : []
  return directory
    .filter((contact) => contact.isActive !== false)
    .filter((contact) => !contact.shipmentModes?.length || contact.shipmentModes.some((mode) => String(mode).trim().toUpperCase() === 'FCL'))
    .sort((left, right) => Number(right.isPrimary === true) - Number(left.isPrimary === true))
}`,
    'FCL agent contact directory',
  )

  code = replaceOne(
    code,
    `              <p class="mt-3 text-sm font-bold">Proveedor: {{ displayValue(selectedCarrier) || 'Sin proveedor' }}</p>
              <p class="mt-1 text-sm font-bold">Agente: {{ displayValue(selectedAgent) || 'Sin agente' }}</p>
              <div class="mt-4 grid grid-cols-2 gap-2 text-sm">`,
    `              <p class="mt-3 text-sm font-bold">Proveedor: {{ displayValue(selectedCarrier) || 'Sin proveedor' }}</p>
              <p class="mt-1 text-sm font-bold">Agente: {{ displayValue(selectedAgent) || 'Sin agente' }}</p>
              <div v-if="shipmentMode === 'FCL' && selectedAgent" class="mt-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-xs">
                <p class="font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Contacto del agente</p>
                <p class="mt-2 font-black text-[var(--dh-text)]">{{ displayValue(selectedAgent) }}</p>
                <div v-if="fclAgentContacts.length" class="mt-2 space-y-2">
                  <div v-for="(contact, index) in fclAgentContacts" :key="`${contact.email || contact.phone || contact.name || index}`" class="rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] p-2">
                    <p v-if="contact.name" class="font-black">{{ contact.name }}<span v-if="contact.role" class="font-semibold text-[var(--dh-text-muted)]"> · {{ contact.role }}</span></p>
                    <p v-if="contact.email" class="mt-1 break-words font-semibold">Correo: {{ contact.email }}</p>
                    <p v-if="contact.phone" class="mt-1 font-semibold">Teléfono: {{ contact.phone }}</p>
                  </div>
                </div>
                <template v-else>
                  <p v-if="metadata(selectedAgent)?.contacts" class="mt-1 font-semibold">Contacto: {{ metadata(selectedAgent)?.contacts }}</p>
                  <p v-if="metadata(selectedAgent)?.email" class="mt-1 break-words font-semibold">Correo: {{ metadata(selectedAgent)?.email }}</p>
                  <p v-if="metadata(selectedAgent)?.phone" class="mt-1 font-semibold">Teléfono: {{ metadata(selectedAgent)?.phone }}</p>
                </template>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-2 text-sm">`,
    'FCL agent contact summary',
  )

  code = replaceOne(
    code,
    `    <div class="crystal-footer flex items-center justify-between gap-3 p-3">`,
    `    <div v-if="isEditing || entryLogisticsService || step !== 1" class="crystal-footer flex items-center justify-between gap-3 p-3">`,
    'screen 0 footer visibility',
  )

  return code
}

export function pricingWizardSep02Requirements(): Plugin {
  return {
    name: 'dhole-pricing-wizard-sep02-requirements',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
