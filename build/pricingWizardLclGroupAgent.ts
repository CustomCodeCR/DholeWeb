import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) throw new Error(`[pricingWizardLclGroupAgent] ${label}: expected 1 anchor, got ${count}`)
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source
  if (code.includes('// lcl-group-agent-selector-20261020')) return code

  code = replaceOne(code, "const form = reactive({", "const form = reactive({\n  // lcl-group-agent-selector-20261020\n  lclGroupAgentId: '',", 'form field')

  const agentsAnchor = "const currencyOptions = computed(() =>"
  code = replaceOne(code, agentsAnchor,
    "const lclGroupAgentOptions = computed(() => catalogs.agents.map((item) => ({ value: item.id, label: displayValue(item) })))\n" + agentsAnchor,
    'catalog selector')

  code = replaceOne(code,
    "    agentId: '',\n    carrierId: '',",
    "    agentId: '',\n    lclGroupAgentId: '',\n    carrierId: '',",
    'reset new rate')

  code = replaceOne(code,
    "    form.agentId = rate.agentId ?? ''",
    "    form.agentId = rate.agentId ?? ''\n    form.lclGroupAgentId = rate.lclGroupAgentId ?? ''",
    'rate hydration')

  code = replaceOne(code, "const canNext = computed(() => {",
    "const canNext = computed(() => {\n  if (step.value === 6 && shipmentModeForApi.value === 'Lcl' && !form.lclGroupAgentId) return false",
    'step 6 required agent')

  const provider = "      lclGroupAgentId: shipmentModeForApi.value === 'Lcl' ? form.lclGroupAgentId || null : null,\n"
  code = replaceOne(code, "    const createPayload: CreateRateRequest = {",
    "    const createPayload: CreateRateRequest = {\n" + provider,
    'create rate payload')
  code = replaceOne(code, "      const updatePayload = {",
    "      const updatePayload = {\n" + provider,
    'edit rate payload')

  const begin = code.indexOf('<div v-else-if="step === 6"')
  if (begin < 0) throw new Error('[pricingWizardLclGroupAgent] Screen 6 not found')
  const end = code.indexOf('<div v-else-if="step === 4"', begin)
  if (end < 0) throw new Error('[pricingWizardLclGroupAgent] Screen 6 end not found')
  let section = code.slice(begin, end)
  section = section.replace(
    /<h2 class="crystal-title">[\s\S]*?<\/h2>/,
    "<h2 class=\"crystal-title\">{{ shipmentModeForApi === 'Lcl' ? 'Agentes LCL' : form.modality === 'Land' ? 'Flete terrestre' : 'Agente y naviera' }}</h2>")
  const carrier = /<DhSelect[^>]*v-model="form\.carrierId" label="Naviera \/ proveedor"[^>]*\/>/
  if (!carrier.test(section)) throw new Error('[pricingWizardLclGroupAgent] Carrier select not found')
  section = section.replace(carrier,
    `<DhSelect v-if="shipmentModeForApi !== 'Lcl' && form.modality !== 'Land'" v-model="form.carrierId" label="Naviera / proveedor" :options="carrierOptions" />
            <DhSelect v-if="shipmentModeForApi === 'Lcl' && form.modality !== 'Land'" v-model="form.lclGroupAgentId" label="Agente de Grupo Castro Fallas" :options="lclGroupAgentOptions" />`)
  section = section.replace(
    /<p class="crystal-description">[\s\S]*?<\/p>/,
    `<p class="crystal-description">{{ shipmentModeForApi === 'Lcl' ? 'Seleccione el agente o coloader y, por separado, el agente de Grupo Castro Fallas configurado en Config. Para LCL no se utiliza naviera.' : form.modality === 'Land' ? 'Flete terrestre: no se requiere naviera.' : 'Los selectores muestran el Value configurado en Config.' }}</p>`)
  code = code.slice(0, begin) + section + code.slice(end)

  // El resumen debe distinguir ambos agentes; la naviera no aplica a LCL.
  const oldCarrier = '<div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Naviera / proveedor</span><p class="mt-1 font-bold">{{ editingRate.carrierName || \'Sin asignar\' }}</p></div>'
  const newCarrier = '<div v-if="editingRate.shipmentMode !== \'Lcl\'">' +
    '<span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Naviera / proveedor</span><p class="mt-1 font-bold">{{ editingRate.carrierName || \'Sin asignar\' }}</p></div>' +
    '<div v-else><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Agente de Grupo Castro Fallas</span><p class="mt-1 font-bold">{{ editingRate.lclGroupAgentName || \'Sin asignar\' }}</p></div>'
  if (code.includes(oldCarrier)) code = code.replace(oldCarrier, newCarrier)

  return code
}

export function pricingWizardLclGroupAgent(): Plugin {
  return {
    name: 'dhole-pricing-lcl-group-agent',
    // Ejecutar después de las transformaciones de pantalla 6 y antes de Vue.
    transform(source, id) {
      if (id.includes('?')) return null
      if (!id.replace(/\\/g, '/').endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
