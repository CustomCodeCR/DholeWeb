from pathlib import Path


def rep(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one {label} anchor, found {count}")
    p.write_text(text.replace(old, new, 1))


service = 'src/core/services/ownLclConsolidationService.ts'
rep(
    service,
    '''  saveCostOverrides: { method: 'PUT', path: '/api/pricing/own-lcl-consolidations/{{id}}/cost-overrides', headers: jsonHeaders },
  calculate: { method: 'POST', path: '/api/pricing/own-lcl-route-matrix/{{id}}/calculate', headers: jsonHeaders },''',
    '''  saveCostOverrides: { method: 'PUT', path: '/api/pricing/own-lcl-consolidations/{{id}}/cost-overrides', headers: jsonHeaders },
  pricingLines: { method: 'GET', path: '/api/pricing/own-lcl-consolidations/{{id}}/pricing-lines', headers: acceptJson },
  savePricingLines: { method: 'PUT', path: '/api/pricing/own-lcl-consolidations/{{id}}/pricing-lines', headers: jsonHeaders },
  calculate: { method: 'POST', path: '/api/pricing/own-lcl-route-matrix/{{id}}/calculate', headers: jsonHeaders },''',
    'pricing line endpoints',
)

interface_anchor = '''export interface OwnLclCargoLineRequest {
'''
interfaces = '''export interface OwnLclPricingLineDto {
  lineKey: string
  scope: 'PA' | 'CR' | 'CA' | 'ORIGIN' | string
  name: string
  chargeBasis: string
  costUnit: number
  saleUnit: number
}

export interface SaveOwnLclPricingLinesRequest {
  rows: Array<{
    lineKey: string
    costUnit: number
    saleUnit: number
  }>
}

export function createDefaultOwnLclPricingLines(): OwnLclPricingLineDto[] {
  return [
    { lineKey: 'PA_DESTINATION_CHARGE', scope: 'PA', name: 'Destination Charge', chargeBasis: 'CBM', costUnit: 0, saleUnit: 20 },
    { lineKey: 'PA_DMCE', scope: 'PA', name: 'DMCE', chargeBasis: 'HBL', costUnit: 65, saleUnit: 65 },
    { lineKey: 'PA_HANDLING', scope: 'PA', name: 'Handling', chargeBasis: 'HBL', costUnit: 25, saleUnit: 25 },
    { lineKey: 'PA_ZONE', scope: 'PA', name: 'Zone Charge', chargeBasis: 'HBL', costUnit: 30, saleUnit: 30 },
    { lineKey: 'CR_HANDLING', scope: 'CR', name: 'Manejos', chargeBasis: 'HBL', costUnit: 65, saleUnit: 65 },
    { lineKey: 'CR_ZONE', scope: 'CR', name: 'Zone Charge', chargeBasis: 'HBL', costUnit: 50, saleUnit: 50 },
    { lineKey: 'CA_DOCUMENTATION', scope: 'CA', name: 'Documentación', chargeBasis: 'HBL', costUnit: 0, saleUnit: 65 },
    { lineKey: 'CA_ZONE', scope: 'CA', name: 'Zone Charge', chargeBasis: 'HBL', costUnit: 0, saleUnit: 65 },
    { lineKey: 'CA_HANDLING', scope: 'CA', name: 'Manejos destino', chargeBasis: 'HBL', costUnit: 0, saleUnit: 50 },
    { lineKey: 'ORIGIN_CFS', scope: 'ORIGIN', name: 'CFS', chargeBasis: 'CBM', costUnit: 8, saleUnit: 8 },
    { lineKey: 'ORIGIN_WHSE', scope: 'ORIGIN', name: 'WHSE FEE', chargeBasis: 'CBM', costUnit: 12, saleUnit: 12 },
    { lineKey: 'ORIGIN_CUSTOMS', scope: 'ORIGIN', name: 'CUSTOMS', chargeBasis: 'SET', costUnit: 15, saleUnit: 25 },
    { lineKey: 'ORIGIN_DOC', scope: 'ORIGIN', name: 'DOC FEE', chargeBasis: 'HBL', costUnit: 15, saleUnit: 65 },
    { lineKey: 'ORIGIN_VGM', scope: 'ORIGIN', name: 'VGM', chargeBasis: 'HBL', costUnit: 0, saleUnit: 25 },
    { lineKey: 'ORIGIN_MANIFEST', scope: 'ORIGIN', name: 'MANIFEST', chargeBasis: 'HBL', costUnit: 15, saleUnit: 25 },
  ]
}

'''
rep(service, interface_anchor, interfaces + interface_anchor, 'pricing line interfaces')

rep(
    service,
    '''  async saveCostOverrides(id: string, payload: SaveOwnLclCostOverridesRequest): Promise<void> {
    await callEndpoint<unknown, SaveOwnLclCostOverridesRequest>(endpoints.saveCostOverrides, { params: { id }, body: payload })
  },
  async create(payload: AutomaticOwnLclConsolidationRequest): Promise<CreatedOwnLcl> {''',
    '''  async saveCostOverrides(id: string, payload: SaveOwnLclCostOverridesRequest): Promise<void> {
    await callEndpoint<unknown, SaveOwnLclCostOverridesRequest>(endpoints.saveCostOverrides, { params: { id }, body: payload })
  },
  async getPricingLines(id: string): Promise<OwnLclPricingLineDto[]> {
    const response = await callEndpoint<unknown>(endpoints.pricingLines, { params: { id } })
    return unwrapListResponse<OwnLclPricingLineDto>(response)
  },
  async savePricingLines(id: string, payload: SaveOwnLclPricingLinesRequest): Promise<void> {
    await callEndpoint<unknown, SaveOwnLclPricingLinesRequest>(endpoints.savePricingLines, { params: { id }, body: payload })
  },
  async create(payload: AutomaticOwnLclConsolidationRequest): Promise<CreatedOwnLcl> {''',
    'pricing line service methods',
)

view = 'src/modules/pricing/views/PricingOwnLclView.vue'
rep(
    view,
    '''  OwnLclConsolidationService,
  type OwnLclAutomationSnapshotDto,
  type OwnLclConsolidationDto,
  type OwnLclDestinationProfileDto,
  type OwnLclFobScenarioMatrixDto,
} from '@/core/services/ownLclConsolidationService' ''',
    '''  OwnLclConsolidationService,
  createDefaultOwnLclPricingLines,
  type OwnLclAutomationSnapshotDto,
  type OwnLclConsolidationDto,
  type OwnLclDestinationProfileDto,
  type OwnLclFobScenarioMatrixDto,
  type OwnLclPricingLineDto,
} from '@/core/services/ownLclConsolidationService' ''',
    'pricing line imports',
)
rep(
    view,
    '''const scenarioSaving = ref(false)
const rows = ref<OwnLclTableRow[]>([])''',
    '''const scenarioSaving = ref(false)
const pricingLineSaving = ref(false)
const pricingLines = ref<OwnLclPricingLineDto[]>(createDefaultOwnLclPricingLines())
const rows = ref<OwnLclTableRow[]>([])''',
    'pricing line state',
)
rep(
    view,
    '''const poeLocationOptions = computed(() => poePorts.value.map((item) => ({
  value: item.code || item.value,
  label: item.label,
  searchText: [item.code, item.value, item.label].filter(Boolean).join(' '),
})))
''',
    '''const poeLocationOptions = computed(() => poePorts.value.map((item) => ({
  value: item.code || item.value,
  label: item.label,
  searchText: [item.code, item.value, item.label].filter(Boolean).join(' '),
})))
const pricingLineGroups = computed(() => [
  { scope: 'PA', label: 'Panamá', description: 'Cargos de destino Panamá.', rows: pricingLines.value.filter((line) => line.scope === 'PA') },
  { scope: 'CR', label: 'Costa Rica', description: 'Cargos fijos de destino Costa Rica.', rows: pricingLines.value.filter((line) => line.scope === 'CR') },
  { scope: 'CA', label: 'Centroamérica', description: 'Cargos fijos para Nicaragua, Honduras, El Salvador y Guatemala.', rows: pricingLines.value.filter((line) => line.scope === 'CA') },
  { scope: 'ORIGIN', label: 'Origen FCA / EXW', description: 'Manejos en origen. La recolección EXW sigue siendo específica de cada carga.', rows: pricingLines.value.filter((line) => line.scope === 'ORIGIN') },
])
''',
    'pricing line groups',
)
rep(
    view,
    '''  scenarioMatrix.value = null
  readOnly.value = false
  Object.assign(form, {''',
    '''  scenarioMatrix.value = null
  pricingLines.value = createDefaultOwnLclPricingLines()
  readOnly.value = false
  Object.assign(form, {''',
    'reset pricing lines',
)
rep(
    view,
    '''  try {
    const [automation] = await Promise.all([
      OwnLclConsolidationService.getAutomation(row.id),
      loadScenarios(row.id),
    ])
    selectedAutomation.value = automation''',
    '''  try {
    const [automation, storedPricingLines] = await Promise.all([
      OwnLclConsolidationService.getAutomation(row.id),
      OwnLclConsolidationService.getPricingLines(row.id),
      loadScenarios(row.id),
    ])
    selectedAutomation.value = automation
    pricingLines.value = storedPricingLines''',
    'load pricing lines',
)

save_helpers_anchor = '''async function saveScenarioRows(showToast = true) {'''
save_helpers = '''function buildPricingLinesPayload() {
  return {
    rows: pricingLines.value.map((line) => ({
      lineKey: line.lineKey,
      costUnit: line.lineKey === 'PA_DESTINATION_CHARGE'
        ? Math.max(previewDestinationPerCbm.value, 0)
        : Math.max(Number(line.costUnit || 0), 0),
      saleUnit: Math.max(Number(line.saleUnit || 0), 0),
    })),
  }
}

async function savePricingLineRows(showToast = true) {
  if (!selectedId.value) return
  pricingLineSaving.value = true
  try {
    await OwnLclConsolidationService.savePricingLines(selectedId.value, buildPricingLinesPayload())
    pricingLines.value = await OwnLclConsolidationService.getPricingLines(selectedId.value)
    if (showToast) toastStore.success('Tarifario guardado', 'Los costos y ventas por línea quedaron asociados únicamente a este consolidado.')
  } catch (error) {
    toastStore.backendError(error, 'No fue posible guardar los costos y ventas del consolidado.')
  } finally {
    pricingLineSaving.value = false
  }
}

'''
rep(view, save_helpers_anchor, save_helpers + save_helpers_anchor, 'pricing line save helpers')
rep(
    view,
    '''    await OwnLclConsolidationService.saveCostOverrides(targetId, buildCostOverrides())
    if (!wasNew && scenarioMatrix.value) await saveScenarioRows(false)
''',
    '''    await OwnLclConsolidationService.saveCostOverrides(targetId, buildCostOverrides())
    await OwnLclConsolidationService.savePricingLines(targetId, buildPricingLinesPayload())
    if (!wasNew && scenarioMatrix.value) await saveScenarioRows(false)
''',
    'save pricing lines with consolidation',
)
rep(
    view,
    '''      wasNew
        ? 'El consolidado fue creado. Ahora puede ajustar las ventas FOB por país y puerto de China.'
        : 'Los costos y ventas quedaron guardados a nivel del consolidado.',''',
    '''      wasNew
        ? 'El consolidado fue creado con sus costos y ventas por línea. La matriz FOB queda disponible para ajustar la venta por país y puerto.'
        : 'Los costos y ventas quedaron guardados a nivel del consolidado y se reutilizarán en las próximas cotizaciones.',''',
    'save confirmation copy',
)
rep(
    view,
    '''  scenarioMatrix.value = null
}

onMounted(load)''',
    '''  scenarioMatrix.value = null
  pricingLines.value = createDefaultOwnLclPricingLines()
}

onMounted(load)''',
    'close pricing line reset',
)

scenario_section_anchor = '''          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Escenarios FOB por país</p>'''
pricing_section = '''          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tarifario del consolidado · costos y ventas</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Estos valores pertenecen solo a este consolidado. Las cotizaciones LCL propias los cargan automáticamente y ya no hay que corregirlos cotización por cotización.</p>
              </div>
              <DhButton v-if="selectedId && !readOnly" label="Guardar costos y ventas" :loading="pricingLineSaving" variant="secondary" @click="savePricingLineRows()" />
            </div>

            <div class="mt-4 space-y-3">
              <details v-for="group in pricingLineGroups" :key="group.scope" class="group overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]" :open="group.scope === 'PA'">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <div><p class="font-black">{{ group.label }}</p><p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ group.description }}</p></div>
                  <span class="text-xs font-black text-[var(--dh-text-muted)]">{{ group.rows.length }} líneas ▾</span>
                </summary>
                <div class="overflow-x-auto border-t border-[var(--dh-border)]">
                  <table class="w-full min-w-[610px] text-sm">
                    <thead class="bg-black/[0.025] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)] dark:bg-white/[0.03]">
                      <tr><th class="px-4 py-2 text-left">Concepto</th><th class="px-4 py-2 text-left">Base</th><th class="px-4 py-2 text-right">Costo USD</th><th class="px-4 py-2 text-right">Venta USD</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="line in group.rows" :key="line.lineKey" class="border-t border-[var(--dh-border)] first:border-t-0">
                        <td class="px-4 py-2 font-black">{{ line.name }}<p v-if="line.lineKey === 'PA_DESTINATION_CHARGE'" class="mt-0.5 text-[10px] font-semibold text-[var(--dh-text-muted)]">Costo derivado de “Costos destino USD” ÷ capacidad CBM.</p></td>
                        <td class="px-4 py-2 text-xs font-bold text-[var(--dh-text-muted)]">{{ line.chargeBasis }}</td>
                        <td class="px-4 py-2 text-right">
                          <span v-if="line.lineKey === 'PA_DESTINATION_CHARGE'" class="inline-block min-w-28 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black">{{ money(previewDestinationPerCbm) }}</span>
                          <input v-else v-model.number="line.costUnit" type="number" min="0" step="0.01" :disabled="readOnly" class="w-28 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" />
                        </td>
                        <td class="px-4 py-2 text-right"><input v-model.number="line.saleUnit" type="number" min="0" step="0.01" :disabled="readOnly" class="w-28 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </section>

'''
rep(view, scenario_section_anchor, pricing_section + scenario_section_anchor, 'pricing line editor')

# FCL: show the real agent contact directory and never WHS contact/email/phone as the FCL contact.
sep02 = 'build/pricingWizardSep02Requirements.ts'
rep(
    sep02,
    '''  code = replaceOne(
    code,
    `              <p class="mt-3 text-sm font-bold">Proveedor: {{ displayValue(selectedCarrier) || 'Sin proveedor' }}</p>''',
    '''  code = replaceOne(
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
    `              <p class="mt-3 text-sm font-bold">Proveedor: {{ displayValue(selectedCarrier) || 'Sin proveedor' }}</p>''',
    'insert FCL contact helper transform',
)
rep(
    sep02,
    '''              <div v-if="shipmentMode === 'FCL' && selectedAgent" class="mt-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-xs">
                <p class="font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Contacto del agente</p>
                <p class="mt-2 font-black text-[var(--dh-text)]">{{ displayValue(selectedAgent) }}</p>
                <p v-if="metadata(selectedAgent)?.email" class="mt-1 font-semibold">Correo: {{ metadata(selectedAgent)?.email }}</p>
                <p v-if="metadata(selectedAgent)?.phone" class="mt-1 font-semibold">Teléfono: {{ metadata(selectedAgent)?.phone }}</p>
              </div>''',
    '''              <div v-if="shipmentMode === 'FCL' && selectedAgent" class="mt-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-xs">
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
              </div>''',
    'FCL contact directory UI',
)

wizard = 'src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
for field in ('contacts', 'email', 'phone'):
    old = f'''<p v-if="metadata(selectedWarehouse)?.{field}"'''
    new = f'''<p v-if="shipmentMode !== 'FCL' && metadata(selectedWarehouse)?.{field}"'''
    rep(wizard, old, new, f'hide WHS {field} for FCL')
