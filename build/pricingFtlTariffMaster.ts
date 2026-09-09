import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const COST_FORM_PATH = '/src/modules/pricing/components/PricingCostFormDrawer.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingFtlTariffMaster] ${label} anchor not found.`)
  }
  return source.replace(anchor, replacement)
}

function patchCostForm(source: string) {
  let code = source

  const formAnchor = `const form = reactive({`
  if (!code.includes('function ftlSystemTag(')) {
    code = replaceRequired(
      code,
      formAnchor,
      `function ftlSystemTag(notes: string | null | undefined, key: 'FTL_EQUIPMENT_CLASS' | 'TRANSIT_DAYS') {\n  const match = String(notes ?? '').match(new RegExp('\\\\[' + key + '=([^\\\\]]+)\\\\]', 'i'))\n  return match?.[1]?.trim() ?? ''\n}\n\nfunction stripFtlSystemNotes(notes: string | null | undefined) {\n  return String(notes ?? '')\n    .replace(/\\[FTL_EQUIPMENT_CLASS=[^\\]]+\\]/gi, '')\n    .replace(/\\[TRANSIT_DAYS=[^\\]]+\\]/gi, '')\n    .replace(/\\s+/g, ' ')\n    .trim()\n}\n\n${formAnchor}`,
      'cost form helpers',
    )
  }

  code = replaceRequired(
    code,
    `  kgPerCbm: String(props.cost?.kgPerCbm ?? ''),`,
    `  kgPerCbm: String(props.cost?.kgPerCbm ?? ''),\n  ftlEquipmentClass: ftlSystemTag(props.cost?.notes, 'FTL_EQUIPMENT_CLASS'),\n  transitDays: ftlSystemTag(props.cost?.notes, 'TRANSIT_DAYS'),`,
    'FTL form fields',
  )
  code = replaceRequired(
    code,
    `  notes: props.cost?.notes ?? '',`,
    `  notes: stripFtlSystemNotes(props.cost?.notes),`,
    'clean editable notes',
  )

  const equipmentBasisAnchor = `const isEquipmentBasis = computed(\n  () => form.chargeBasis === 'PerContainer' || form.chargeBasis === 'PerTruck',\n)`
  code = replaceRequired(
    code,
    equipmentBasisAnchor,
    `${equipmentBasisAnchor}\nconst isFtlFreight = computed(\n  () => form.shipmentMode === 'Ftl' && form.costDetailType === 'Freight',\n)\n\nfunction buildFtlTaggedNotes() {\n  const userNotes = form.notes.trim()\n  if (!isFtlFreight.value) return userNotes || null\n  const tags = [\n    form.ftlEquipmentClass ? \`[FTL_EQUIPMENT_CLASS=\${form.ftlEquipmentClass}]\` : '',\n    form.transitDays.trim() ? \`[TRANSIT_DAYS=\${Math.max(0, Math.trunc(Number(form.transitDays)))}]\` : '',\n  ].filter(Boolean)\n  return [...tags, userNotes].filter(Boolean).join(' ') || null\n}`,
    'FTL computed state',
  )

  const shipmentOptionsAnchor = `const shipmentModeOptions: Array<{ label: string; value: CostShipmentMode }> = [`
  code = replaceRequired(
    code,
    shipmentOptionsAnchor,
    `const ftlEquipmentClassOptions = [\n  { label: 'Equipo de 48 y 53 pies', value: '48_53' },\n  { label: 'Equipo de 5 a 7 toneladas', value: '5_7_TON' },\n]\n\n${shipmentOptionsAnchor}`,
    'FTL equipment options',
  )

  code = replaceRequired(
    code,
    `    (form.minimumSaleAmount !== '' && Number(form.minimumSaleAmount) < 0) ||\n    (form.kgPerCbm !== '' && Number(form.kgPerCbm) <= 0)`,
    `    (form.minimumSaleAmount !== '' && Number(form.minimumSaleAmount) < 0) ||\n    (form.kgPerCbm !== '' && Number(form.kgPerCbm) <= 0) ||\n    (isFtlFreight.value && !form.ftlEquipmentClass) ||\n    (isFtlFreight.value && form.transitDays !== '' && (!Number.isFinite(Number(form.transitDays)) || Number(form.transitDays) < 0))`,
    'FTL validation',
  )

  code = replaceRequired(
    code,
    `    notes: form.notes.trim() || null,`,
    `    notes: buildFtlTaggedNotes(),`,
    'FTL notes payload',
  )

  const chargeBasisField = `<DhSelect v-model="form.chargeBasis" label="Base de cobro" :options="chargeBasisOptions" />`
  code = replaceRequired(
    code,
    chargeBasisField,
    `${chargeBasisField}\n        <DhSelect\n          v-if="isFtlFreight"\n          v-model="form.ftlEquipmentClass"\n          label="Clase de equipo FTL"\n          :options="ftlEquipmentClassOptions"\n          placeholder="Seleccione la clase"\n          :error="form.submitted && !form.ftlEquipmentClass ? 'Seleccione la clase de equipo FTL.' : undefined"\n        />\n        <DhInput\n          v-if="isFtlFreight"\n          v-model="form.transitDays"\n          type="number"\n          min="0"\n          step="1"\n          label="Días de tránsito"\n          placeholder="No informado"\n          :error="\n            form.submitted && form.transitDays !== '' && Number(form.transitDays) < 0\n              ? 'Los días de tránsito no pueden ser negativos.'\n              : undefined\n          "\n        />`,
    'FTL editable fields UI',
  )

  return code
}

function patchWizard(source: string) {
  let code = source

  code = replaceRequired(
    code,
    `const costs = ref<CostSelectDto[]>([])`,
    `const costs = ref<CostSelectDto[]>([])\nconst selectedFtlConfiguredCostId = ref('')`,
    'FTL selected cost state',
  )

  const applicableAnchor = `function applicableCost(cost: CostSelectDto) {`
  const helpers = `function ftlCostTag(cost: CostSelectDto, key: 'FTL_EQUIPMENT_CLASS' | 'TRANSIT_DAYS') {\n  const match = String(cost.notes ?? '').match(new RegExp('\\\\[' + key + '=([^\\\\]]+)\\\\]', 'i'))\n  return match?.[1]?.trim() ?? ''\n}\n\nfunction selectedFtlEquipmentClass() {\n  const equipment = selectedEquipment.value\n  if (!equipment) return ''\n  const text = normalizeCatalogValue([\n    equipment.code,\n    equipment.slug,\n    equipment.label,\n    displayValue(equipment),\n    equipment.metadataJson,\n  ].filter(Boolean).join(' '))\n\n  if (/(^|[^0-9])(48|53)([^0-9]|$)/.test(text)) return '48_53'\n  if (/(^|[^0-9])(5|6|7)([^0-9]|$).*\\b(ton|tons|tonelada|toneladas)\\b/.test(text)) return '5_7_TON'\n  if (/\\b(ton|tons|tonelada|toneladas)\\b.*(^|[^0-9])(5|6|7)([^0-9]|$)/.test(text)) return '5_7_TON'\n  if (/5\\s*(a|-|\\/)\\s*7/.test(text)) return '5_7_TON'\n  return ''\n}\n\nfunction ftlCostMatchesSelectedEquipment(cost: CostSelectDto) {\n  if (cost.shipmentMode !== 'Ftl' || cost.costDetailType !== 'Freight') return true\n  const configuredClass = ftlCostTag(cost, 'FTL_EQUIPMENT_CLASS').toUpperCase()\n  if (!configuredClass) return true\n  const selectedClass = selectedFtlEquipmentClass().toUpperCase()\n  return Boolean(selectedClass && selectedClass === configuredClass)\n}\n\nfunction ftlTransitDays(cost: CostSelectDto | null | undefined) {\n  if (!cost) return null\n  const raw = ftlCostTag(cost, 'TRANSIT_DAYS')\n  if (!raw) return null\n  const days = Number(raw)\n  return Number.isFinite(days) && days >= 0 ? Math.trunc(days) : null\n}\n\nfunction configuredFtlFreightCost() {\n  if (shipmentModeForApi.value !== 'Ftl') return null\n  return costs.value\n    .filter((cost) => cost.shipmentMode === 'Ftl' && cost.costDetailType === 'Freight')\n    .filter((cost) => ftlCostMatchesSelectedEquipment(cost))\n    .filter(applicableCost)\n    .sort((left, right) => costSpecificity(right) - costSpecificity(left))[0] ?? null\n}\n\n${applicableAnchor}`
  code = replaceRequired(code, applicableAnchor, helpers, 'FTL tariff matching helpers')

  code = replaceRequired(
    code,
    applicableAnchor + `\n  if (cost.services?.length`,
    applicableAnchor + `\n  if (shipmentModeForApi.value === 'Ftl' && cost.costDetailType === 'Freight' && !ftlCostMatchesSelectedEquipment(cost)) return false\n  if (cost.services?.length`,
    'FTL equipment matching guard',
  )

  const searchStart = `async function searchApprovedRates() {`
  const searchIndex = code.indexOf(searchStart)
  if (searchIndex < 0) throw new Error('[pricingFtlTariffMaster] searchApprovedRates anchor not found.')
  const firstGuardIndex = code.indexOf(`\n  if (`, searchIndex + searchStart.length)
  if (firstGuardIndex < 0) throw new Error('[pricingFtlTariffMaster] searchApprovedRates first guard not found.')

  const ftlSearchBranch = `\n  selectedFtlConfiguredCostId.value = ''\n\n  if (shipmentModeForApi.value === 'Ftl') {\n    const configured = configuredFtlFreightCost()\n    form.manualRate = true\n    if (configured) {\n      selectedFtlConfiguredCostId.value = configured.id\n      form.freightCost = number(configured.costAmount)\n      form.freightSale = number(configured.saleAmount)\n      if (configured.currencyId) form.currencyId = configured.currencyId\n      const days = ftlTransitDays(configured)\n      form.transitDays = days ?? 0\n    } else {\n      form.freightCost = 0\n      form.freightSale = 0\n      form.transitDays = 0\n    }\n    return\n  }\n`
  code = code.slice(0, firstGuardIndex) + ftlSearchBranch + code.slice(firstGuardIndex)

  code = replaceRequired(
    code,
    `      chargeBasis: defaultChargeBasis('Freight'),\n      currencyId: currency.id,`,
    `      chargeBasis: defaultChargeBasis('Freight'),\n      costId: shipmentModeForApi.value === 'Ftl' ? (selectedFtlConfiguredCostId.value || null) : null,\n      contextLabel: shipmentModeForApi.value === 'Ftl' && selectedFtlConfiguredCostId.value\n        ? 'Tarifa FTL maestra configurada en Costos.'\n        : null,\n      notes: shipmentModeForApi.value === 'Ftl'\n        ? configuredFtlFreightCost()?.notes?.trim() || null\n        : null,\n      currencyId: currency.id,`,
    'FTL freight line source mapping',
  )

  return code
}

export function pricingFtlTariffMaster(): Plugin {
  return {
    name: 'dhole-pricing-ftl-tariff-master',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (normalizedId.endsWith(COST_FORM_PATH)) return { code: patchCostForm(source), map: null }
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      return null
    },
  }
}
