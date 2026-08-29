from pathlib import Path
import re

ROOT=Path('.')
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s):
    x=ROOT/p; x.parent.mkdir(parents=True,exist_ok=True); x.write_text(s,encoding='utf-8')
def replace(p,old,new,count=1):
    s=read(p); n=s.count(old)
    if n!=count: raise RuntimeError(f'{p}: expected {count}, got {n}: {old[:120]!r}')
    write(p,s.replace(old,new,count))

# Contracts.
replace('src/core/interfaces/pricing.ts',
'''  rateCode: string\n  rateName: string\n  sourceImportFclRateId?: string | null''',
'''  rateCode: string\n  rateName: string\n  revisionNumber: number\n  sourceImportFclRateId?: string | null''')
replace('src/core/interfaces/pricing.ts',
'''export interface RateSelectDto extends Record<string, unknown> {''',
'''export interface RateRevisionDto extends Record<string, unknown> {\n  id: string\n  rateHeaderId: string\n  revisionNumber: number\n  status: string\n  rateName: string\n  idtraNumber?: string | null\n  quoNumber?: string | null\n  totalSaleUsd: number\n  totalSaleCrc: number\n  marginPercentage: number\n  createdAtUtc: string\n  createdBy?: string | null\n  snapshotJson: string\n}\n\nexport interface RateSelectDto extends Record<string, unknown> {''')

# Pricing service revision endpoint.
replace('src/core/services/pricingService.ts',
'''  RateDto,\n  RateTermItemDto,''',
'''  RateDto,\n  RateRevisionDto,\n  RateTermItemDto,''')
s=read('src/core/services/pricingService.ts')
anchor='''  async getRate(rateId: string): Promise<RateDto> {'''
pos=s.find(anchor)
if pos<0: raise RuntimeError('getRate anchor not found')
# insert method before getRate
method='''  async getRateRevisions(rateId: string): Promise<RateRevisionDto[]> {\n    const response = await callEndpoint<unknown>({ method: 'GET', path: `/api/pricing/rates/${rateId}/revisions` })\n    return unwrapApiResponse<RateRevisionDto[]>(response as never)\n  },\n\n'''
s=s[:pos]+method+s[pos:]
write('src/core/services/pricingService.ts',s)

# Dedicated wizard route.
replace('src/core/router/index.ts',
'''        {\n          path: 'pricing/rates',\n          name: 'pricing-rates',''',
'''        {\n          path: 'pricing/rates/:rateId/wizard',\n          name: 'pricing-rate-wizard',\n          component: () => import('@/modules/pricing/views/PricingOverviewView.vue'),\n          meta: {\n            tabTitle: 'Tarifa · Wizard',\n            closable: true,\n            requiredScope: VIEW_SCOPES.pricingRates,\n          },\n        },\n        {\n          path: 'pricing/rates',\n          name: 'pricing-rates',''')

write('src/modules/pricing/views/PricingOverviewView.vue', '''<script setup lang="ts">\nimport { computed } from 'vue'\nimport { useRoute } from 'vue-router'\nimport PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'\n\nconst route = useRoute()\nconst rateId = computed(() => typeof route.params.rateId === 'string' ? route.params.rateId : null)\nconst viewOnly = computed(() => route.query.mode === 'view')\n</script>\n\n<template>\n  <PricingAlternativeWizardCrystal :rate-id="rateId" :view-only="viewOnly" />\n</template>\n''')

# Rates list: all viewing/editing goes to the wizard; richer official-rate display.
replace('src/modules/pricing/views/PricingRatesView.vue',
'''import { useRoute } from 'vue-router' ''',
'''import { useRoute, useRouter } from 'vue-router' ''')
# exact import has newline-free? normalize fallback
s=read('src/modules/pricing/views/PricingRatesView.vue')
s=s.replace("import { useRoute } from 'vue-router'", "import { useRoute, useRouter } from 'vue-router'")
s=s.replace("import { useDrawerStore } from '@/core/stores/drawerStore'\n", '')
s=s.replace("import PricingRateFormDrawer from '@/modules/pricing/components/PricingRateFormDrawer.vue'\n", '')
s=s.replace("import PricingRateDetailDrawer from '@/modules/pricing/components/PricingRateDetailDrawer.vue'\n", '')
s=s.replace('const route = useRoute()\n', 'const route = useRoute()\nconst router = useRouter()\n')
s=s.replace('const drawerStore = useDrawerStore()\n', '')
old=re.compile(r'''function openDetail\(rate: RateDto\) \{.*?\n\}\n\nfunction openEdit\(rate: RateDto\) \{.*?\n\}\n''',re.S)
m=old.search(s)
if not m: raise RuntimeError('openDetail/openEdit block not found')
s=s[:m.start()]+'''function openDetail(rate: RateDto) {\n  router.push({ name: 'pricing-rate-wizard', params: { rateId: rate.id }, query: { mode: 'view' } })\n}\n\nfunction openEdit(rate: RateDto) {\n  router.push({ name: 'pricing-rate-wizard', params: { rateId: rate.id }, query: { mode: 'edit' } })\n}\n'''+s[m.end():]
# Add revision badge after rate code chip.
s=s.replace('''                <DhBadge\n                  :label="row.rateType === 'Spot' ? 'SPOT' : 'TARIFARIO'"''',
'''                <DhBadge :label="`REV ${row.revisionNumber || 1}`" variant="primary" />\n                <DhBadge\n                  :label="row.rateType === 'Spot' ? 'SPOT' : 'TARIFARIO'"''',1)
# More readable IDTRA line.
s=s.replace('''                <span v-if="row.idtraNumber"> · IDTRA {{ row.idtraNumber }}</span>''',
'''                <span v-if="row.idtraNumber" class="font-black text-[var(--dh-primary)]"> · IDTRA {{ row.idtraNumber }}</span>''',1)
# Commercial summary dual-currency.
pattern=re.compile(r'''          <template #cell-commercial="\{ row \}">.*?          </template>''',re.S)
m=pattern.search(s)
if not m: raise RuntimeError('commercial slot not found')
commercial='''          <template #cell-commercial="{ row }">\n            <div class="min-w-[190px] text-right">\n              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Venta de la revisión</p>\n              <p class="font-black text-[var(--dh-text)]">USD {{ Number(row.totalSaleUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>\n              <p class="text-sm font-black text-[var(--dh-primary)]">CRC ₡{{ Number(row.totalSaleCrc || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>\n              <div class="mt-2 flex items-center justify-end gap-2">\n                <span class="text-xs font-black" :class="row.totalUtilityUsd >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'">\n                  Utilidad USD {{ Number(row.totalUtilityUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}\n                </span>\n                <DhBadge :label="`${row.marginPercentage.toFixed(2)}%`" :variant="marginTone(row.marginPercentage)" />\n              </div>\n            </div>\n          </template>'''
s=s[:m.start()]+commercial+s[m.end():]
s=s.replace('title="Ver detalle"','title="Ver en wizard"')
s=s.replace('title="Editar"','title="Editar en wizard"')
write('src/modules/pricing/views/PricingRatesView.vue',s)

# Wizard imports/types/props/form.
p='src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
s=read(p)
s=s.replace('''  CreateRateDetailRequest,\n  ImportRateSelectDto,''','''  CreateRateDetailRequest,\n  CreateRateRequest,\n  ImportRateSelectDto,\n  RateDto,\n  RateRevisionDto,\n  UpdateRateRequest,''')
s=s.replace('''  applyDestinationTax?: boolean\n}''','''  applyDestinationTax?: boolean\n  detailId?: string | null\n}''',1)
s=s.replace('''const router = useRouter()''','''const props = withDefaults(defineProps<{ rateId?: string | null; viewOnly?: boolean }>(), {\n  rateId: null,\n  viewOnly: false,\n})\n\nconst router = useRouter()''')
s=s.replace('''const createdRateId = ref('')''','''const createdRateId = ref('')\nconst editingRate = ref<RateDto | null>(null)\nconst rateRevisions = ref<RateRevisionDto[]>([])\nconst loadingExistingRate = ref(false)\nconst hydratingExistingRate = ref(false)\nconst isEditing = computed(() => Boolean(props.rateId))\nconst pageTitle = computed(() => isEditing.value ? (props.viewOnly ? 'Visualizar tarifa' : 'Editar tarifa') : 'Seleccionar alternativa')\nconst pageDescription = computed(() => isEditing.value\n  ? 'Toda la tarifa se revisa en el mismo wizard. Las tarifas aceptadas crean una nueva revisión al guardar.'\n  : 'Construya la alternativa paso a paso con catálogos filtrados por modalidad.')''')
s=s.replace("  executiveName: '',\n", "  executiveName: '',\n  idtraNumber: '',\n",1)
s=s.replace("  loadDate: todayIso(),\n", "  loadDate: todayIso(),\n  validTo: addDaysIso(todayIso(), 30),\n",1)
# reset additions
s=s.replace("    loadDate: todayIso(),\n    selectedImportRateId:", "    loadDate: todayIso(),\n    validTo: addDaysIso(todayIso(), 30),\n    selectedImportRateId:",1)
s=s.replace("    executiveName: '',\n    pickupAddress:", "    executiveName: '',\n    idtraNumber: '',\n    pickupAddress:",1)

# Hydration helpers inserted before next().
anchor='''async function next() {'''
pos=s.find(anchor)
if pos<0: raise RuntimeError('next anchor not found')
hydrate=r'''function modalityForRate(rate: RateDto): Modality {\n  if (rate.shipmentMode === 'Ftl' || rate.shipmentMode === 'Ltl') return 'Land'\n  if (rate.shipmentMode === 'Fcl' || rate.shipmentMode === 'Lcl') return 'Maritime'\n  return 'Multimodal'\n}\n\nfunction transitDaysFrom(value?: string | null) {\n  const match = String(value ?? '').match(/\\d+/)\n  return match ? Number(match[0]) : 0\n}\n\nasync function hydrateExistingRate() {\n  if (!props.rateId) return\n  try {\n    loadingExistingRate.value = true\n    hydratingExistingRate.value = true\n    const [rate, revisions] = await Promise.all([\n      PricingService.getRate(props.rateId),\n      PricingService.getRateRevisions(props.rateId).catch(() => [] as RateRevisionDto[]),\n    ])\n    editingRate.value = rate\n    rateRevisions.value = revisions\n    const modality = modalityForRate(rate)\n    const equipment = [...catalogs.containers, ...catalogs.landEquipmentTypes].find((item) => item.id === rate.containerTypeId) ?? null\n    const equipmentMeta = metadata(equipment)\n    form.modality = modality\n    form.shipmentMode = String(rate.shipmentMode).toUpperCase()\n    form.originId = rate.polId\n    form.destinationId = rate.poeId\n    form.podId = rate.podId ?? ''\n    form.equipmentId = rate.containerTypeId\n    form.equipmentQuantity = Math.max(1, Number(rate.containerQuantity || 1))\n    form.equipmentSize = String(equipmentMeta?.size ?? '')\n    form.equipmentType = equipmentHasSizes.value ? String(equipmentMeta?.kind ?? '') : rate.containerTypeId\n    form.incotermId = rate.incotermId ?? ''\n    form.serviceIds = (rate.services ?? []).map((service) => service.id)\n    form.loadDate = String(rate.validFrom).slice(0,10)\n    form.validTo = String(rate.validTo).slice(0,10)\n    form.selectedImportRateId = rate.sourceImportFclRateId ?? ''\n    form.manualRate = !rate.sourceImportFclRateId\n    form.clientName = rate.clientName ?? ''\n    form.executiveName = rate.executiveName ?? ''\n    form.idtraNumber = rate.idtraNumber ?? ''\n    form.pickupAddress = rate.pickupAddress ?? ''\n    form.pickupLatitude = rate.pickupLatitude ?? null\n    form.pickupLongitude = rate.pickupLongitude ?? null\n    form.freeDays = Number(rate.freeDays || 0)\n    form.transitDays = transitDaysFrom(rate.transitTime)\n    form.agentId = rate.agentId ?? ''\n    form.carrierId = rate.carrierId ?? ''\n    form.currencyId = rate.currencyId\n    exchangeRatePurchase.value = Number(rate.exchangeRatePurchase || rate.exchangeRateApplied || 0) || null\n    exchangeRateSale.value = Number(rate.exchangeRateSale || rate.exchangeRateApplied || 0) || null\n    exchangeRateDate.value = String(rate.exchangeRateDate ?? '').slice(0,10)\n    exchangeRateSource.value = rate.exchangeRateSource || exchangeRateSource.value\n    const freight = rate.rateDetails.find((detail) => detail.costDetailType === 'Freight')\n    form.freightCost = Number(freight?.costAmount || 0)\n    form.freightSale = Number(freight?.saleAmount || 0)\n    form.cargoDescription = rate.cargoLines?.[0]?.description ?? ''\n\n    rateLines.value = rate.rateDetails.map((detail) => {\n      const configuredCost = detail.costId ? costs.value.find((cost) => cost.id === detail.costId) : null\n      return {\n        key: `existing:${detail.id}`,\n        detailId: detail.id,\n        section: sectionForDetail(detail.costDetailType, detail.name),\n        name: detail.name,\n        costDetailType: detail.costDetailType,\n        costType: detail.costType,\n        chargeBasis: detail.chargeBasis,\n        costId: detail.costId ?? null,\n        notes: detail.notes ?? null,\n        serviceIds: configuredCost?.services?.map((service) => service.id) ?? [],\n        currencyId: detail.currencyId,\n        currencyName: detail.currencyName,\n        currencyCode: detail.currencyCode,\n        costAmount: Number(detail.costAmount || 0),\n        saleAmount: Number(detail.saleAmount || 0),\n        included: true,\n        optional: detail.costType === 'Optional',\n        manual: !detail.costId,\n        applyDestinationTax: /IVA\\s+\\d+/i.test(String(detail.notes ?? '')),\n      } as RateLine\n    })\n    step.value = 8\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudo cargar la tarifa en el wizard.')\n    await router.push({ name: 'pricing-rates' })\n  } finally {\n    hydratingExistingRate.value = false\n    loadingExistingRate.value = false\n  }\n}\n\nfunction editCurrentRate() {\n  if (!editingRate.value) return\n  router.replace({ name: 'pricing-rate-wizard', params: { rateId: editingRate.value.id }, query: { mode: 'edit' } })\n}\n\n'''.replace('\\n','\n')
s=s[:pos]+hydrate+s[pos:]

# Prevent edit hydration from triggering rebuild watchers.
s=s.replace("    if (step.value < 6 || !agentId) return", "    if (hydratingExistingRate.value || step.value < 6 || !agentId) return")
s=s.replace("watch(() => form.currencyId, () => {\n  if (step.value === 7)", "watch(() => form.currencyId, () => {\n  if (hydratingExistingRate.value) return\n  if (step.value === 7)")

# Save/create payload: IDTRA + editable validity.
s=s.replace("      executiveName: form.executiveName.trim() || null,\n      freeDays:", "      executiveName: form.executiveName.trim() || null,\n      idtraNumber: form.idtraNumber.trim() || null,\n      freeDays:",1)
# second create payload in saveRate
idx=s.find("      executiveName: form.executiveName.trim() || null,", s.find('async function saveRate'))
if idx<0: raise RuntimeError('saveRate executiveName anchor missing')
insert_at=idx+len("      executiveName: form.executiveName.trim() || null,")
s=s[:insert_at]+"\n      idtraNumber: form.idtraNumber.trim() || null,"+s[insert_at:]
# replace saveRate validTo (only occurrence after saveRate)
start=s.find('async function saveRate')
old="      validTo: selectedImportRate.value?.validTo?.slice(0, 10) || addDaysIso(form.loadDate, 30),"
pos=s.find(old,start)
if pos<0: raise RuntimeError('saveRate validTo anchor missing')
s=s[:pos]+"      validTo: form.validTo || selectedImportRate.value?.validTo?.slice(0, 10) || addDaysIso(form.loadDate, 30),"+s[pos+len(old):]

# Turn create call into a reusable payload and branch update/create.
start=s.find('    const rateId = await PricingService.createRate({', s.find('async function saveRate'))
end_marker='''      details,\n    })\n    createdRateId.value = rateId'''
end=s.find(end_marker,start)
if start<0 or end<0: raise RuntimeError('save create payload block not found')
body=s[start+len('    const rateId = await PricingService.createRate({'):end]
replacement='''    const createPayload: CreateRateRequest = {'''+body+'''      details,\n    }\n\n    let rateId: string\n    if (editingRate.value) {\n      const originalDetailIds = new Set(editingRate.value.rateDetails.map((detail) => detail.id))\n      const currentDetailIds = new Set(includedLines.value.map((line) => line.detailId).filter((id): id is string => Boolean(id)))\n      const removedExtraDetailIds = [...originalDetailIds].filter((id) => !currentDetailIds.has(id))\n      const extraDetails = createPayload.details.map((detail, index) => ({\n        ...detail,\n        id: includedLines.value[index]?.detailId ?? null,\n      }))\n      const { sourceImportFclRateId: _sourceImportFclRateId, details: _details, ...baseUpdate } = createPayload\n      const updatePayload = {\n        ...baseUpdate,\n        agentId: agent!.id,\n        agentName: displayValue(agent),\n        agentCode: agent!.code,\n        carrierId: carrier!.id,\n        carrierName: displayValue(carrier),\n        carrierCode: carrier!.code,\n        rateType: editingRate.value.rateType,\n        quoNumber: editingRate.value.quoNumber ?? null,\n        includes: editingRate.value.includes ?? createPayload.includes ?? null,\n        subjectTo: editingRate.value.subjectTo ?? createPayload.subjectTo ?? null,\n        excludes: editingRate.value.excludes ?? createPayload.excludes ?? null,\n        extraDetails,\n        removedExtraDetailIds,\n      } as UpdateRateRequest\n      await PricingService.updateRate(editingRate.value.id, updatePayload)\n      rateId = editingRate.value.id\n      const nextRevision = editingRate.value.status === 'AcceptedByClient'\n        ? (editingRate.value.revisionNumber || 1) + 1\n        : (editingRate.value.revisionNumber || 1)\n      toastStore.success(\n        editingRate.value.status === 'AcceptedByClient'\n          ? `Revisión ${nextRevision} creada y versión aceptada anterior conservada.`\n          : 'Tarifa actualizada correctamente.',\n      )\n    } else {\n      rateId = await PricingService.createRate(createPayload)\n      toastStore.success('Tarifa creada correctamente.')\n    }\n    createdRateId.value = rateId'''
s=s[:start]+replacement+s[end+len(end_marker):]
# remove duplicate success line if still present.
s=s.replace("\n    toastStore.success('Tarifa creada correctamente.')\n    await router.push({ name: 'pricing-rates', query: { rateId } })", "\n    await router.push({ name: 'pricing-rates' })",1)
s=s.replace("toastStore.backendError(error, 'No se pudo crear la tarifa.')", "toastStore.backendError(error, isEditing.value ? 'No se pudo actualizar la tarifa.' : 'No se pudo crear la tarifa.')",1)

# Initial load: existing rate uses persisted exchange rate and hydrates after catalogs.
s=s.replace('''onMounted(async () => {\n  await Promise.allSettled([loadCatalogs(), loadHaciendaExchangeRate(true)])\n})''',
'''onMounted(async () => {\n  await loadCatalogs()\n  if (props.rateId) await hydrateExistingRate()\n  else await loadHaciendaExchangeRate(true)\n})''')

# Dynamic page header.
s=s.replace('''      title="Seleccionar alternativa"\n      description="Construya la alternativa paso a paso con catálogos filtrados por modalidad."''',
'''      :title="pageTitle"\n      :description="pageDescription"''',1)
# Editing banner before stepbar.
needle='''    <div class="crystal-stepbar grid grid-cols-2 gap-2 p-2 sm:grid-cols-4 xl:grid-cols-8">'''
banner='''    <div v-if="loadingExistingRate" class="crystal-soft p-5 text-sm font-black">Cargando tarifa completa…</div>\n\n    <div v-else-if="editingRate" class="crystal-soft p-5">\n      <div class="flex flex-wrap items-start justify-between gap-4">\n        <div>\n          <div class="flex flex-wrap items-center gap-2">\n            <DhBadge :label="editingRate.rateCode" variant="primary" />\n            <DhBadge :label="`Revisión ${editingRate.revisionNumber || 1}`" variant="neutral" />\n            <DhBadge :label="editingRate.status" :variant="editingRate.status === 'AcceptedByClient' ? 'success' : 'neutral'" />\n          </div>\n          <p class="mt-3 text-lg font-black">{{ editingRate.rateName }}</p>\n          <p class="mt-1 text-xs font-bold text-[var(--dh-text-muted)]">IDTRA: {{ editingRate.idtraNumber || 'Pendiente de asignar' }} · QUO: {{ editingRate.quoNumber || '—' }}</p>\n        </div>\n        <DhButton v-if="viewOnly" variant="secondary" @click="editCurrentRate">Editar en este wizard</DhButton>\n      </div>\n      <div v-if="editingRate.status === 'AcceptedByClient' && !viewOnly" class="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs font-bold text-amber-700 dark:text-amber-300">\n        Esta tarifa ya fue aceptada. Al guardar, Dhole conservará la revisión {{ editingRate.revisionNumber || 1 }} como versión histórica y abrirá la revisión {{ (editingRate.revisionNumber || 1) + 1 }}.\n      </div>\n      <details v-if="rateRevisions.length" class="mt-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">\n        <summary class="cursor-pointer text-sm font-black">Historial de revisiones · {{ rateRevisions.length }} versión{{ rateRevisions.length === 1 ? '' : 'es' }} anterior{{ rateRevisions.length === 1 ? '' : 'es' }}</summary>\n        <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">\n          <div v-for="revision in rateRevisions" :key="revision.id" class="rounded-xl border border-[var(--dh-border)] p-3 text-xs">\n            <div class="flex items-center justify-between gap-2"><strong>Revisión {{ revision.revisionNumber }}</strong><DhBadge :label="revision.status" variant="success" /></div>\n            <p class="mt-2 font-bold">{{ revision.idtraNumber || 'Sin IDTRA' }} · {{ revision.quoNumber || 'Sin QUO' }}</p>\n            <p class="mt-1 text-[var(--dh-text-muted)]">USD {{ Number(revision.totalSaleUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }} · CRC ₡{{ Number(revision.totalSaleCrc || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 }) }}</p>\n            <p class="mt-1 text-[var(--dh-text-muted)]">Margen {{ Number(revision.marginPercentage || 0).toFixed(2) }}% · {{ new Date(revision.createdAtUtc).toLocaleString() }}</p>\n          </div>\n        </div>\n      </details>\n    </div>\n\n'''+needle
if needle not in s: raise RuntimeError('stepbar anchor missing')
s=s.replace(needle,banner,1)

# Add validTo input to screen 3 next to loadDate.
s=s.replace('''              <DhInput v-model="form.loadDate" type="date" label="Fecha carga lista" />''',
'''              <DhInput v-model="form.loadDate" type="date" label="Vigente desde / carga lista" />\n              <DhInput v-model="form.validTo" type="date" label="Vigente hasta" />''',1)
# Add IDTRA to Screen 8 client card.
s=s.replace('''              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Ejecutivo: {{ form.executiveName || 'Sin asignar' }}</p>''',
'''              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Ejecutivo: {{ form.executiveName || 'Sin asignar' }}</p>\n              <div class="mt-4"><DhInput v-model="form.idtraNumber" label="Número IDTRA" placeholder="Ej. IDTRA-2026-00125" :disabled="viewOnly" /></div>''',1)
# Footer save/view labels.
s=s.replace('''      <DhButton v-else-if="step === 8" :disabled="saving || !includedLines.length" @click="saveRate"><Check class="h-4 w-4" /> {{ saving ? 'Guardando…' : 'Crear tarifa' }}</DhButton>''',
'''      <DhButton v-else-if="step === 8 && viewOnly && editingRate" @click="editCurrentRate"><Edit3 class="h-4 w-4" /> Editar tarifa</DhButton>\n      <DhButton v-else-if="step === 8" :disabled="saving || !includedLines.length" @click="saveRate"><Check class="h-4 w-4" /> {{ saving ? 'Guardando…' : isEditing ? 'Guardar tarifa' : 'Crear tarifa' }}</DhButton>''',1)
# Need Edit3 icon import.
s=s.replace('''  ExternalLink,\n  FileUp,''','''  ExternalLink,\n  Edit3,\n  FileUp,''',1)
write(p,s)
print('Wizard edit, IDTRA, rate visualization and revision UI applied.')
