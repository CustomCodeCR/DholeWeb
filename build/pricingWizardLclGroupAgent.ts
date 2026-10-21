import type { Plugin } from 'vite'

// Última transformación del wizard: un solo agente para LCL y sin naviera.
const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) throw new Error(`[pricingWizardLclGroupAgent] ${label}: expected 1 anchor, got ${count}`)
  return source.replace(anchor, replacement)
}

function replaceCount(source: string, anchor: string, replacement: string, expected: number, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== expected) throw new Error(`[pricingWizardLclGroupAgent] ${label}: expected ${expected} anchors, got ${count}`)
  return source.split(anchor).join(replacement)
}

function patchWizard(source: string) {
  let code = source
  if (code.includes('// lcl-unified-agent-selector-20261021')) return code

  // Si existe un agente real de GCF en Config, usar su GUID. En caso
  // contrario, la opción interna se persiste como AgentName/AgentCode
  // (AgentId nulo), nunca como un GUID ficticio.
  const agentOptionsAnchor = 'const currencyOptions = computed(() =>'
  code = replaceOne(code, agentOptionsAnchor, [
    '// lcl-unified-agent-selector-20261021',
    "const LCL_GCF_INTERNAL_AGENT_ID = '__dhole_lcl_gcf_agent__'",
    'const lclGcfCatalogAgent = computed(() => catalogs.agents.find((item) => {',
    '  const name = normalizeCatalogValue(displayValue(item))',
    '  const code = normalizeCatalogValue(item.code)',
    "  return code === 'gcf' || name.includes('grupo castro fallas')",
    '}))',
    'const lclAgentOptions = computed(() => {',
    '  const gcfId = lclGcfCatalogAgent.value?.id ?? LCL_GCF_INTERNAL_AGENT_ID',
    '  return [',
    "    { value: gcfId, label: 'Grupo Castro Fallas' },",
    '    ...agentOptions.value.filter((option) => option.value !== gcfId),',
    '  ]',
    '})',
    agentOptionsAnchor,
  ].join('\n'), 'single LCL agent selector options')

  // Al seleccionar un consolidado propio, GCF es el agente seleccionado,
  // no un segundo campo obligatorio.
  code = replaceOne(
    code,
    '  form.agentId = sourceAgent?.id ?? selectedProviderId',
    "  form.agentId = sourceAgent?.id ?? (selection.kind === 'Own' ? (lclGcfCatalogAgent.value?.id ?? LCL_GCF_INTERNAL_AGENT_ID) : selectedProviderId)",
    'own LCL selection agent',
  )

  // Tarifas antiguas con el agente independiente se visualizan en el
  // selector único durante la edición, sin perder la información histórica.
  code = replaceOne(
    code,
    "    form.agentId = rate.agentId ?? ''",
    "    form.agentId = rate.agentId ?? (String(rate.shipmentMode).toLowerCase() === 'lcl' && (normalizeCatalogValue(rate.agentName ?? '').includes('grupo castro fallas') || normalizeCatalogValue(rate.lclGroupAgentName ?? '').includes('grupo castro fallas')) ? (lclGcfCatalogAgent.value?.id ?? LCL_GCF_INTERNAL_AGENT_ID) : '')",
    'existing rate agent hydration',
  )

  code = replaceOne(
    code,
    'const canNext = computed(() => {',
    "const canNext = computed(() => {\n  if (step.value === 6 && shipmentModeForApi.value === 'Lcl' && !form.agentId) return false",
    'LCL agent required on screen 6',
  )

  // El flujo manual exige un agente; permitir también la opción interna GCF.
  const validationAnchors = [
    "if (form.modality !== 'Land' && !agent && !(shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value && !lclSelectedSource.value.manual)) missing.push('agente')",
    "if (!agent && !(shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value && !lclSelectedSource.value.manual)) missing.push('agente')",
  ]
  const validation = validationAnchors.filter((anchor) => code.includes(anchor))
  if (validation.length !== 1) throw new Error('[pricingWizardLclGroupAgent] Missing unique LCL agent validation')
  code = replaceOne(
    code,
    validation[0]!,
    validation[0]!.replace('!agent && ', '!agent && form.agentId !== LCL_GCF_INTERNAL_AGENT_ID && '),
    'GCF manual source validation',
  )

  code = replaceCount(
    code,
    'agentName: agent ? displayValue(agent) : lclSelectedSource.value?.providerName ?? null,',
    "agentName: agent ? displayValue(agent) : (form.agentId === LCL_GCF_INTERNAL_AGENT_ID ? 'Grupo Castro Fallas' : (lclSelectedSource.value?.providerName ?? null)),",
    2,
    'GCF agent name payload on create/update',
  )
  code = replaceCount(
    code,
    'agentCode: agent?.code ?? lclSelectedSource.value?.providerCode ?? null,',
    "agentCode: agent?.code ?? (form.agentId === LCL_GCF_INTERNAL_AGENT_ID ? 'GCF' : (lclSelectedSource.value?.providerCode ?? null)),",
    2,
    'GCF agent code payload on create/update',
  )

  const begin = code.indexOf('<div v-else-if="step === 6"')
  if (begin < 0) throw new Error('[pricingWizardLclGroupAgent] Screen 6 not found')
  const end = code.indexOf('<div v-else-if="step === 4"', begin)
  if (end < 0) throw new Error('[pricingWizardLclGroupAgent] Screen 6 end not found')
  let section = code.slice(begin, end)
  section = section.replace(
    /<h2 class="crystal-title">[\s\S]*?<\/h2>/,
    '<h2 class="crystal-title">{{ shipmentModeForApi === \'Lcl\' ? \'Agentes LCL\' : form.modality === \'Land\' ? \'Flete terrestre\' : \'Agente y naviera\' }}</h2>',
  )
  // Earlier Vite transforms can add Land restrictions to the historical LCL
  // controls. Match by their purpose instead of exact template attributes.
  const lockedProviderSelector = /<DhInput\b[^>]*lclSelectedSource\?\.kind === 'Own'[^>]*label="Fuente \/ proveedor"[^>]*\/>/g
  const lockedMatches = [...section.matchAll(lockedProviderSelector)]
  if (lockedMatches.length > 1) {
    throw new Error('[pricingWizardLclGroupAgent] Multiple locked LCL providers found')
  }
  if (lockedMatches.length === 1) {
    section = section.replace(lockedProviderSelector, '')
  }

  const agentSelector = /<DhSelect\b[^>]*v-model="form\.agentId"[^>]*label="(?:Agente|Agente \/ coloader)"[^>]*\/>/g
  const agentMatches = [...section.matchAll(agentSelector)]
  if (agentMatches.length !== 1) {
    throw new Error(
      `[pricingWizardLclGroupAgent] expected one LCL agent selector, got ${agentMatches.length}`,
    )
  }
  section = section.replace(
    agentSelector,
    '<DhSelect v-if="form.modality !== \'Land\' || (shipmentModeForApi === \'Ltl\' && form.manualRate && landLtlCommercialProfile === \'Nvocc\')" v-model="form.agentId" label="Agente / coloader" :options="shipmentModeForApi === \'Lcl\' ? lclAgentOptions : agentOptions" />',
  )

  // La naviera no se selecciona para LCL; no introducir ningún otro agente.
  const carrier = /<DhSelect[^>]*v-model="form\.carrierId" label="Naviera \/ proveedor"[^>]*\/>/
  if (!carrier.test(section)) throw new Error('[pricingWizardLclGroupAgent] Carrier select not found')
  section = section.replace(
    carrier,
    '<DhSelect v-if="shipmentModeForApi !== \'Lcl\' && form.modality !== \'Land\'" v-model="form.carrierId" label="Naviera / proveedor" :options="carrierOptions" />',
  )
  section = section.replace(
    /<p class="crystal-description">[\s\S]*?<\/p>/,
    "<p class=\"crystal-description\">{{ shipmentModeForApi === 'Lcl' ? 'Seleccione un agente o coloader, incluyendo Grupo Castro Fallas. Para LCL no se utiliza naviera.' : form.modality === 'Land' ? 'Flete terrestre: no se requiere naviera.' : 'Los selectores muestran el Value configurado en Config.' }}</p>",
  )
  code = code.slice(0, begin) + section + code.slice(end)

  // En el resumen LCL se muestra únicamente el agente común.
  const oldCarrier = '<div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Naviera / proveedor</span><p class="mt-1 font-bold">{{ editingRate.carrierName || \'Sin asignar\' }}</p></div>'
  const newCarrier = '<div v-if="editingRate.shipmentMode !== \'Lcl\'"><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Naviera / proveedor</span><p class="mt-1 font-bold">{{ editingRate.carrierName || \'Sin asignar\' }}</p></div>'
  if (code.includes(oldCarrier)) code = replaceOne(code, oldCarrier, newCarrier, 'LCL carrier summary')

  const oldAgent = '<div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Agente</span><p class="mt-1 font-bold">{{ editingRate.agentName || \'Sin asignar\' }}</p></div>'
  const newAgent = '<div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">{{ editingRate.shipmentMode === \'Lcl\' ? \'Agente / coloader\' : \'Agente\' }}</span><p class="mt-1 font-bold">{{ editingRate.agentName || editingRate.lclGroupAgentName || \'Sin asignar\' }}</p></div>'
  if (code.includes(oldAgent)) code = replaceOne(code, oldAgent, newAgent, 'unified agent summary')

  return code
}

export function pricingWizardLclGroupAgent(): Plugin {
  return {
    name: 'dhole-pricing-lcl-unified-agent',
    transform(source, id) {
      if (id.includes('?')) return null
      if (!id.replace(/\\/g, '/').endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
