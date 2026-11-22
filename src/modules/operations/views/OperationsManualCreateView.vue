<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Package, Plus, Trash2, Save, FolderPlus, Route, Ship, Plane, Check, Truck, Layers3 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhSearchInput } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { operationsApi, type CrmAccountOption } from '../services/operationsApi'
import PricingCrystalMultiSelect from '@/modules/pricing/components/PricingCrystalMultiSelect.vue'
import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'
import PricingWizardStepper from '@/modules/pricing/components/PricingWizardStepper.vue'
import PricingContainerSelector from '@/modules/pricing/components/PricingContainerSelector.vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { useAuthStore } from '@/core/stores/authStore'

const router = useRouter()
const route = useRoute()
const editingId = computed(() => typeof route.params.id === 'string' ? route.params.id : '')
const existingVersion = ref(0)
const canEdit = ref(false)
const auth = useAuthStore()
const companyId = ref('')
const canInitialize = computed(() => auth.hasScope('operations.team.manage'))
const initializing = ref(false)
const accountId = ref('')
const accountSearch = ref('')
const accounts = ref<CrmAccountOption[]>([])
const loadingAccounts = ref(false)
const modality = ref('')
const priority = ref(1)
const complexity = ref(1)
const saving = ref(false)
const activeStep = ref(1)
const wizardSteps = [
  { id: 1, label: 'Modalidad', hint: 'Marítimo, aéreo, terrestre o multimodal' },
  { id: 2, label: 'Embarque', hint: 'FCL, LCL, FTL, LTL y carga aérea' },
  { id: 3, label: 'Cliente y ruta', hint: 'Cuenta CRM, Incoterm y terminales' },
  { id: 4, label: 'Carga', hint: 'Mercancía, pesos y equipos' },
  { id: 5, label: 'Servicios', hint: 'Recolecta, entrega y coordinación' },
  { id: 6, label: 'Revisión', hint: 'Resumen y guardado del borrador' },
]
const activeStepMeta = computed(() => wizardSteps.find(x => x.id === activeStep.value) ?? wizardSteps[0]!)
const catalogLoading = ref(false)
const catalogIssue = ref('')
const catalogs = ref<Record<string, CatalogItemSelectDto[]>>({})
const selectedPol = ref('')
const selectedPoe = ref('')
const selectedPod = ref('')
const selectedWarehouse = ref('')
let restoringOpening = false
const currentCatalog = (key: string) => catalogs.value[key] || []
const optionText = (item: CatalogItemSelectDto) => String(item.value || item.label || item.code).trim()
const catalogChoices = (key: string) => currentCatalog(key).filter(item => item.isActive).map(item => ({ value: optionText(item), label: optionText(item) }))
const locationChoices = (key: string) => currentCatalog(key).filter(item => item.isActive).map(item => ({ value: item.id, label: optionText(item), searchText: [item.label,item.code,item.slug].join(' ') }))
const polOptions = computed(() => locationChoices('pol'))
const poeOptions = computed(() => locationChoices('poe'))
const podOptions = computed(() => locationChoices('pod'))
const warehouseOptions = computed(() => locationChoices('warehouses'))
const agentChoices = computed(() => catalogChoices('agents'))
const carrierChoices = computed(() => catalogChoices('carriers'))
function asChoices(key: string, saved: string) {
  const options = catalogChoices(key)
  return saved && !options.some(x => x.value === saved) ? [{ label: saved, value: saved }, ...options] : options
}
const incotermChoices = computed(() => {
  const items = catalogChoices('incoterms')
  const values = items.length ? items : incoterms.map(value => ({ label: value, value }))
  return values.filter(item => isMaritime.value || !['FAS','FOB','CFR','CIF'].includes(item.value.toUpperCase()))
})
const serviceChoices = computed(() => {
  const items = currentCatalog('pricing-services').filter(x => x.isActive).map(x => ({value: x.id, label: optionText(x)}))
  const legacy = serviceCatalog.map(([value, label]) => ({ value, label }))
  const combined = items.length ? [...items, ...legacy.filter(x => form.value.services.includes(x.value))] : legacy
  for (const selected of form.value.services) {
    if (!combined.some(x => x.value === selected)) combined.push({ value: selected, label: selected })
  }
  return combined
})
function lookupLabel(key: string, id: string) { return optionText(currentCatalog(key).find(x => x.id === id) || { value: '', label: '', code: '' } as CatalogItemSelectDto) }
function selectedForLabel(key: string, label: string) {
  return currentCatalog(key).find(item => optionText(item).trim().toLowerCase() === label.trim().toLowerCase())?.id || ''
}
function reconcileLocations() {
  selectedPol.value = selectedForLabel('pol', form.value.pol)
  selectedPoe.value = selectedForLabel('poe', form.value.poe)
  selectedPod.value = selectedForLabel('pod', form.value.pod)
  selectedWarehouse.value = selectedForLabel('warehouses', form.value.whsName)
}
async function loadPricingCatalogs() {
  catalogLoading.value = true
  try {
    const names = ['pol','poe','pod','incoterms','container-types','land-equipment-sizes','agents','carriers','pricing-services']
    const result = await Promise.all(names.map(async key => {
      try { return [key, await CatalogItemsService.select({ catalogGroupSlug: key })] as const }
      catch { return [key, [] as CatalogItemSelectDto[]] as const }
    }))
    const warehouseGroups = ['pricing-warehouses','warehouses','whs','fca-warehouses']
    let warehouseItems: CatalogItemSelectDto[] = []
    for (const key of warehouseGroups) {
      try { warehouseItems = await CatalogItemsService.select({ catalogGroupSlug: key }); if (warehouseItems.length) break } catch { /* legacy slug */ }
    }
    catalogs.value = { ...Object.fromEntries(result), warehouses: warehouseItems }
    if (!polOptions.value.length || !poeOptions.value.length || !podOptions.value.length)
      catalogIssue.value = 'No se pudieron consultar todos los catálogos de ubicaciones; puede conservar las referencias manuales.'
    reconcileLocations()
  } finally { catalogLoading.value = false }
}
function goToStep(target: number) {
  if (target < 1 || target > wizardSteps.length) return
  activeStep.value = target
  void nextTick(() => document.getElementById('operations-opening-wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
const fieldTitle = (label: string, value: unknown) => ({ label, value: value == null || value === '' ? 'Pendiente' : String(value) })
const summaryFields = computed(() => [
  fieldTitle('Cliente', accounts.value.find(x => x.id === accountId.value)?.displayName || accountId.value),
  fieldTitle('Modalidad', modality.value), fieldTitle('Transporte', form.value.transportType),
  fieldTitle('Tipo de embarque', form.value.shipmentType),
  fieldTitle('Incoterm', form.value.incoterm), fieldTitle('Origen / POL', form.value.pol),
  fieldTitle('Salida / POE', form.value.poe), fieldTitle('Destino / POD', form.value.pod),
  fieldTitle('Mercancía', form.value.cargoDescription),
  fieldTitle('Bultos', form.value.packageCount),
  fieldTitle('Peso', form.value.weightValue ? form.value.weightValue + ' ' + form.value.weightUnit : ''),
  fieldTitle('Volumen', form.value.volumeValue ? form.value.volumeValue + ' ' + form.value.volumeUnit : ''),
  fieldTitle('Equipos', form.value.equipment.map(item => item.quantity + ' × ' + item.equipmentType).join(', ')),
  fieldTitle('Servicios', form.value.services.map(v => serviceChoices.value.find(x => x.value === v)?.label || v).join(', ')),
])
const loading = ref(true)
const error = ref('')
const form = ref({
  provenance: 'CLIENT', clientPoReference: '', crmDivisionId: '',
  shipmentType: '', cargoNature: '', transportType: '', incoterm: '',
  pol: '', poe: '', pod: '', pickupAddress: '', pickupContact: '',
  pickupWindow: '', requiresPickup: false, whsName: '',
  destinationAddress: '', cargoDescription: '', packageCount: '',
  packageType: '', weightValue: '', weightUnit: 'KG',
  volumeValue: '', volumeUnit: 'CBM', consolidationReference: '',
  isImo: false, imoClass: '', unNumber: '', stackable: true,
  overweight: false, overweightNotes: '', carrierReference: '',
  agentReference: '', merchantReference: '', etm: '', eta: '',
  services: [] as string[], observations: '',
  contactReferences: '', commercialReviewRequested: false,
  equipment: [] as Array<{ equipmentType: string; equipmentCatalogId?: string; quantity: number }>,
  originCountryCode: '', destinationCountryCode: '',
})
const modalOptions = [
  { label: 'FCL', value: 'FCL' }, { label: 'LCL', value: 'LCL' },
  { label: 'FTL', value: 'FTL' }, { label: 'LTL', value: 'LTL' },
  { label: 'Aéreo', value: 'AIR' }, { label: 'Multimodal', value: 'MULTIMODAL' },
]
const transportSelectionOptions = [
  { label: 'Marítimo', value: 'MARITIME', caption: 'FCL o LCL', icon: Ship },
  { label: 'Aéreo', value: 'AIR', caption: 'Carga aérea internacional', icon: Plane },
  { label: 'Terrestre', value: 'ROAD', caption: 'FTL o LTL', icon: Truck },
  { label: 'Multimodal', value: 'MULTIMODAL', caption: 'Combinación de medios de transporte', icon: Layers3 },
]
const shipmentOptionsByTransport: Record<string, Array<{ label: string; value: string }>> = {
  MARITIME: [{ label: 'FCL · Contenedor completo', value: 'FCL' }, { label: 'LCL · Coloading / propio', value: 'LCL' }],
  AIR: [{ label: 'Carga aérea', value: 'AIR' }],
  ROAD: [{ label: 'FTL · Furgón completo', value: 'FTL' }, { label: 'LTL · Carga consolidada', value: 'LTL' }],
  MULTIMODAL: [{ label: 'FCL · Contenedor completo', value: 'FCL' }, { label: 'LCL · Carga consolidada', value: 'LCL' },
    { label: 'FTL · Furgón completo', value: 'FTL' }, { label: 'LTL · Carga consolidada', value: 'LTL' }],
}
const shipmentOptions = computed(() => shipmentOptionsByTransport[form.value.transportType] ?? [])
const effectiveShipment = computed(() => {
  const saved = form.value.shipmentType.toUpperCase()
  return shipmentOptions.value.some(item => item.value === saved) ? saved :
    shipmentOptions.value.some(item => item.value === modality.value) ? modality.value : ''
})
const equipmentCatalogKey = computed(() => effectiveShipment.value === 'FTL' ? 'land-equipment-sizes' : 'container-types')
function selectTransport(value: string) {
  if (form.value.transportType === value) return
  const available = shipmentOptionsByTransport[value] ?? []
  form.value.transportType = value
  if (!available.some(item => item.value === effectiveShipment.value)) {
    form.value.shipmentType = ''
    modality.value = ''
  } else {
    modality.value = value === 'MULTIMODAL' ? 'MULTIMODAL' : effectiveShipment.value
  }
  if (!['MARITIME', 'MULTIMODAL'].includes(value) && ['FAS','FOB','CFR','CIF'].includes(form.value.incoterm.toUpperCase())) {
    form.value.incoterm = ''
  }
}
function selectShipment(value: string) {
  if (!shipmentOptions.value.some(item => item.value === value)) return
  form.value.shipmentType = value
  modality.value = form.value.transportType === 'MULTIMODAL' ? 'MULTIMODAL' : value
}
function setEquipmentType(item: { equipmentType: string; equipmentCatalogId?: string }, id: string) {
  item.equipmentCatalogId = id
  item.equipmentType = lookupLabel(equipmentCatalogKey.value, id) || id
}
const originOptions = [
  { label: 'Cliente', value: 'CLIENT' }, { label: 'Proveedor', value: 'SUPPLIER' },
  { label: 'Agente', value: 'AGENT' }, { label: 'Oficina de origen', value: 'ORIGIN_OFFICE' },
]
const incoterms = ['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP']
const serviceCatalog: Array<[string, string]> = [
  ['INTERNATIONAL_FREIGHT','Transporte internacional'],
  ['PICKUP','Recolecta'],['ORIGIN_CHARGES','Cargos en origen'],
  ['DESTINATION_CHARGES','Cargos en destino'],
  ['INLAND','Inland'],['CUSTOMS','Agenciamiento aduanal'],
  ['CARGO_INSURANCE','Seguro de carga'],['DELIVERY','Entrega'],
  ['WAREHOUSE','Almacenaje'],['DOCUMENTATION','Documentación'],
  ['OTHER','Otros servicios'],
]
const isMaritime = computed(() => ['MARITIME','MULTIMODAL'].includes(form.value.transportType))
const needsEquipment = computed(() => ['FCL','FTL'].includes(effectiveShipment.value))
const requiresWarehouse = computed(() => form.value.incoterm === 'FCA' && ['LCL','LTL'].includes(effectiveShipment.value))
const accountOptions = computed(() => [
  { label: 'Seleccionar cuenta CRM', value: '' },
  ...accounts.value.map(a => ({ label: a.displayName || a.legalName || a.id, value: a.id })),
])
const valid = computed(() =>
  (editingId.value ? canEdit.value : /^[0-9a-f-]{36}$/i.test(companyId.value)) &&
  modalOptions.some(x => x.value === modality.value) &&
  /^[0-9a-f-]{36}$/i.test(accountId.value) &&
  priority.value >= 1 && priority.value <= 5 && complexity.value > 0 &&
  (!form.value.originCountryCode || /^[A-Za-z]{2}$/.test(form.value.originCountryCode)) &&
  (!form.value.destinationCountryCode || /^[A-Za-z]{2}$/.test(form.value.destinationCountryCode)) &&
  form.value.equipment.every(x => Number.isInteger(x.quantity) && x.quantity > 0))
const blockers = computed(() => {
  const result: string[] = []
  if (!accountId.value) result.push('Cliente CRM')
  if (!form.value.transportType) result.push('Modalidad de transporte')
  if (!effectiveShipment.value) result.push('Tipo de embarque')
  if (!form.value.cargoDescription.trim()) result.push('Descripción de la carga')
  if (!form.value.pol.trim()) result.push('POL / lugar de origen')
  if (!form.value.pod.trim()) result.push('POD / lugar de destino')
  if (!form.value.incoterm.trim()) result.push('Incoterm')
  if (needsEquipment.value && !form.value.equipment.length) result.push('Equipos')
  if (requiresWarehouse.value && !form.value.whsName.trim()) result.push('Nombre WHS (FCA + LCL/LTL)')
  if (form.value.isImo && (!form.value.imoClass || !form.value.unNumber)) result.push('Clase IMO / número UN')
  if (form.value.overweight && !form.value.overweightNotes.trim()) result.push('Observaciones de sobrepeso')
  if (form.value.requiresPickup && !form.value.pickupAddress.trim()) result.push('Dirección de recolecta')
  return result
})
function addEquipment() { form.value.equipment.push({ equipmentType: '', equipmentCatalogId: '', quantity: 1 }) }
async function loadAccounts() {
  loadingAccounts.value = true
  try { accounts.value = (await operationsApi.crmAccounts(accountSearch.value)).items }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'No fue posible cargar cuentas CRM.' }
  finally { loadingAccounts.value = false }
}
async function loadContext() {
  try {
    companyId.value = (await operationsApi.createContext()).companyId || ''
    if (!companyId.value) error.value = 'El servicio no pudo resolver la empresa operativa. Configure Operations antes de crear el expediente.'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No fue posible resolver el contexto.' }
  finally { loading.value = false }
}
async function initializeWorkspace() {
  if (!canInitialize.value || initializing.value) return
  initializing.value = true
  error.value = ''
  try {
    await operationsApi.initializeTeams()
    companyId.value = (await operationsApi.createContext()).companyId || ''
    if (!companyId.value)
      error.value = 'El catálogo se inicializó, pero no se identificó la empresa operativa.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo inicializar Operaciones.'
  } finally { initializing.value = false }
}
async function save() {
  if (!valid.value || saving.value || (editingId.value ? !canEdit.value : !auth.hasScope('operations.case.create'))) return
  saving.value = true
  error.value = ''
  try {
    const openingData = {
      ...form.value,
      weightKg: form.value.weightValue ? Number(form.value.weightValue) *
        (form.value.weightUnit === 'LB' ? 0.45359237 : 1) : null,
      volumeCbm: form.value.volumeValue ? Number(form.value.volumeValue) *
        (form.value.volumeUnit === 'CFT' ? 0.028316846592 : 1) : null,
      equipment: form.value.equipment.map(item => ({
        equipmentType: item.equipmentType,
        equipmentCatalogId: item.equipmentCatalogId || undefined,
        quantity: Number(item.quantity),
      })),
      completionStatus: blockers.value.length ? 'DRAFT_INCOMPLETE' : 'READY_FOR_VALIDATION',
      missingFields: blockers.value,
      commercialStatus: 'SIN_QUO',
    }
    const result = editingId.value
      ? await operationsApi.updateCase(editingId.value, {
          expectedVersion: existingVersion.value,
          modalityCode: modality.value, priority: Number(priority.value),
          complexityPoints: Number(complexity.value),
          originCountryCode: form.value.originCountryCode.toUpperCase() || null,
          destinationCountryCode: form.value.destinationCountryCode.toUpperCase() || null,
          openingData,
        }).then(() => ({ id: editingId.value }))
      : await operationsApi.createAperture({
      companyId: companyId.value,
      accountId: accountId.value,
      modalityCode: modality.value,
      priority: Number(priority.value),
      complexityPoints: Number(complexity.value),
      originCountryCode: form.value.originCountryCode.toUpperCase() || null,
      destinationCountryCode: form.value.destinationCountryCode.toUpperCase() || null,
      openingData,
    })
    await router.push({ name: 'operations-case-detail', params: { id: result.id } })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la apertura.'
  } finally { saving.value = false }
}
let accountTimer: ReturnType<typeof setTimeout> | undefined
watch(accountSearch, () => {
  clearTimeout(accountTimer)
  accountTimer = setTimeout(() => { void loadAccounts() }, 250)
})
watch(selectedPol, id => { const label = lookupLabel('pol', id); if (label) form.value.pol = label })
watch(selectedPoe, id => { const label = lookupLabel('poe', id); if (label) form.value.poe = label })
watch(selectedPod, id => { const label = lookupLabel('pod', id); if (label) form.value.pod = label })
watch(selectedWarehouse, id => { const label = lookupLabel('warehouses', id); if (label) form.value.whsName = label })
onMounted(async () => {
  await Promise.all([loadContext(), loadAccounts(), loadPricingCatalogs()])
  if (editingId.value) {
    try {
      const [detail, tabs] = await Promise.all([
        operationsApi.caseDetail(editingId.value), operationsApi.caseTabs(editingId.value),
      ])
      canEdit.value = tabs.tabs.some(x => x.code === 'RESUMEN' && x.accessLevel === 'EDITABLE')
      if (!canEdit.value) { error.value = 'No tiene permisos para modificar esta apertura.'; return }
      restoringOpening = true
      existingVersion.value = detail.version
      accountId.value = detail.accountId
      companyId.value = detail.companyId
      modality.value = detail.modalityCode
      priority.value = detail.priority
      complexity.value = detail.complexityPoints
      const parsed = JSON.parse(detail.openingDataJson || '{}') as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        form.value = { ...form.value, ...parsed } as typeof form.value
      }
      if (!form.value.transportType) {
        form.value.transportType = modality.value === 'AIR' ? 'AIR'
          : ['FTL','LTL'].includes(modality.value) ? 'ROAD'
            : modality.value === 'MULTIMODAL' ? 'MULTIMODAL' : 'MARITIME'
      }
      if (!form.value.shipmentType && modality.value !== 'MULTIMODAL') form.value.shipmentType = modality.value
      form.value.originCountryCode = detail.originCountryCode || ''
      form.value.destinationCountryCode = detail.destinationCountryCode || ''
      reconcileLocations()
      await nextTick()
      restoringOpening = false
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'No fue posible abrir la captura.'
    } finally { restoringOpening = false }
  }
})
onUnmounted(() => { clearTimeout(accountTimer) })
</script>

<template>
  <div id="operations-opening-wizard" class="mx-auto w-full max-w-[1540px] space-y-4 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <RouterLink to="/operations/cases" class="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--dh-primary)]">
      <ArrowLeft class="h-4 w-4" /> Trámites
    </RouterLink>
    <DhPageHeader
      :title="editingId ? 'Modificar apertura' : 'Nueva apertura manual'"
      subtitle="La misma experiencia guiada de Crear tarifas, adaptada al expediente operativo."
      :icon="FolderPlus"
      :hide-excel-export="true"
    >
      <template #actions>
        <DhButton :icon="Save" :label="editingId ? 'Guardar modificaciones' : 'Guardar borrador'" :loading="saving" :disabled="loading || !valid" @click="save" />
      </template>
    </DhPageHeader>

    <div class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)] sm:p-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-4">
          <div class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">
            <FolderPlus class="h-7 w-7" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-black uppercase tracking-[.18em] text-[var(--dh-primary)]">OPERATIONS · APERTURAS</p>
            <h2 class="text-xl font-black tracking-tight text-[var(--dh-text)] sm:text-2xl">{{ editingId ? 'Actualizar expediente' : 'Crear expediente operativo' }}</h2>
            <p class="mt-1 text-xs font-medium text-[var(--dh-text-muted)]">Completa una etapa a la vez. Puedes guardar un borrador sin completar todos los campos.</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <DhBadge variant="neutral">IDTRA automático</DhBadge>
          <DhBadge variant="primary">{{ editingId ? 'Modificación' : 'Apertura manual' }}</DhBadge>
          <DhBadge variant="neutral">Paso {{ activeStep }} de {{ wizardSteps.length }}</DhBadge>
        </div>
      </div>
      <div class="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--dh-input)]">
        <div class="h-full rounded-full bg-[var(--dh-primary)] transition-all duration-300" :style="{ width: (activeStep / wizardSteps.length * 100) + '%' }" />
      </div>
    </div>

    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-500">{{ error }}</div>
    <div v-if="catalogIssue" role="status" class="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs font-semibold text-amber-500">{{ catalogIssue }}</div>
    <DhCard v-if="!companyId && canInitialize && !editingId" title="Inicialización de Operaciones" subtitle="Acción administrativa, necesaria solo cuando la empresa operativa no se ha identificado.">
      <DhButton variant="secondary" label="Inicializar equipos" :loading="initializing" @click="initializeWorkspace" />
    </DhCard>

    <PricingWizardStepper
      :steps="wizardSteps"
      :active-step="activeStep"
      aria-label="Etapas de creación de apertura"
      @update:active-step="goToStep"
    />

    <section class="overflow-visible rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)]">
      <header class="flex flex-wrap items-center gap-3 rounded-t-[26px] border-b border-[var(--dh-border)] p-5 sm:p-6">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.10)] text-[var(--dh-primary)]">
          <Ship v-if="activeStep === 1" class="h-5 w-5" />
          <Layers3 v-else-if="activeStep === 2" class="h-5 w-5" />
          <Route v-else-if="activeStep === 3" class="h-5 w-5" />
          <Package v-else-if="activeStep === 4" class="h-5 w-5" />
          <Truck v-else-if="activeStep === 5" class="h-5 w-5" />
          <ClipboardCheck v-else class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-[10px] font-black uppercase tracking-[.16em] text-[var(--dh-primary)]">PASO {{ activeStep }} DE {{ wizardSteps.length }}</p>
          <h3 class="mt-0.5 text-lg font-black tracking-tight">{{ activeStepMeta.label }}</h3>
          <p class="text-xs font-medium text-[var(--dh-text-muted)]">{{ activeStepMeta.hint }}</p>
        </div>
        <DhBadge v-if="activeStep === 6" variant="warning" class="ml-auto">{{ blockers.length }} pendientes</DhBadge>
      </header>

      <div class="p-4 sm:p-6">
        <div v-show="activeStep === 1" class="space-y-6">
          <div>
            <h4 class="text-xl font-black">Seleccione la modalidad</h4>
            <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Utiliza las mismas modalidades de Crear tarifas. Los servicios y datos operativos se configuran en los siguientes pasos.</p>
          </div>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <button v-for="option in transportSelectionOptions" :key="option.value" type="button"
              class="group relative flex min-h-[158px] flex-col items-start rounded-[22px] border p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
              :class="form.transportType === option.value
                ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.13)] text-[var(--dh-text)]'
                : 'border-[var(--dh-border)] bg-[var(--dh-input)]/70 hover:border-[var(--dh-primary)]'"
              :aria-pressed="form.transportType === option.value" @click="selectTransport(option.value)">
              <span class="grid h-11 w-11 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.10)] text-[var(--dh-primary)]"><component :is="option.icon" class="h-6 w-6" /></span>
              <span class="mt-5 text-base font-black">{{ option.label }}</span>
              <span class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ option.caption }}</span>
              <Check v-if="form.transportType === option.value" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />
            </button>
          </div>
        </div>

        <div v-show="activeStep === 2" class="space-y-6">
          <div>
            <h4 class="text-xl font-black">Tipo de embarque</h4>
            <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Solo aparecen opciones compatibles con el transporte seleccionado. No se solicita una tarifa para abrir el trámite.</p>
          </div>
          <p v-if="!form.transportType" role="status" class="rounded-xl border border-amber-500/30 p-4 text-sm text-amber-500">
            Primero seleccione la modalidad de transporte en el paso anterior.
          </p>
          <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <button v-for="option in shipmentOptions" :key="option.value" type="button"
              class="relative min-h-[125px] rounded-[22px] border p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
              :class="effectiveShipment === option.value
                ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.13)]'
                : 'border-[var(--dh-border)] bg-[var(--dh-input)]/70 hover:border-[var(--dh-primary)]'"
              :aria-pressed="effectiveShipment === option.value" @click="selectShipment(option.value)">
              <span class="text-base font-black">{{ option.label }}</span>
              <Check v-if="effectiveShipment === option.value" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />
            </button>
          </div>
        </div>

        <div v-show="activeStep === 3" class="space-y-5">
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/60 p-4 sm:p-5">
            <div class="mb-4">
              <h4 class="text-sm font-black">Cuenta y responsable comercial</h4>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">El cliente y el ejecutivo se obtienen de CRM; nunca debes introducir un UUID o IDTRA.</p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2 md:col-span-2">
                <label class="text-xs font-black uppercase tracking-wide text-[var(--dh-text-muted)]">Buscar cliente en CRM</label>
                <DhSearchInput v-model="accountSearch" placeholder="Escribe el nombre o la cédula del cliente…" />
                <DhSelect v-model="accountId" label="Cliente" :options="accountOptions" :disabled="loadingAccounts || Boolean(editingId)" />
                <p v-if="editingId" class="text-xs text-[var(--dh-text-muted)]">No se cambia el cliente propietario durante la edición de una apertura.</p>
              </div>
              <DhSelect v-model="form.provenance" label="Asignación recibida desde" :options="originOptions" />
              <DhInput v-model="form.clientPoReference" label="Orden / PO / referencia del cliente" />
              <DhInput v-model="form.crmDivisionId" label="División CRM (opcional)" placeholder="Referencia de división" />
              <DhInput v-model="form.contactReferences" label="Contactos de notificación" placeholder="Referencias de contactos de CRM" />
            </div>
          </div>
          <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <p class="text-xs font-black text-[var(--dh-text)]">Identificador del trámite</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">PostgreSQL asignará el siguiente consecutivo global al guardar. Formato: IDTRA12345, IDTRA100000 y sucesivos. La serie nunca es editable.</p>
          </div>
        </div>

        <div v-show="activeStep === 3" class="space-y-5">
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DhSelect v-model="form.incoterm" label="Incoterm" :options="incotermChoices" />
            <DhInput v-model="form.cargoNature" label="Naturaleza de la carga" placeholder="Carga general, perecedera…" />
            <DhInput v-model="form.originCountryCode" label="País de origen (ISO)" placeholder="CN" />
            <DhInput v-model="form.destinationCountryCode" label="País destino (ISO)" placeholder="CR" />
          </div>
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4 sm:p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h4 class="text-sm font-black">Ruta de transporte</h4><p class="mt-1 text-xs font-medium text-[var(--dh-text-muted)]">Buscadores de POL, POE y POD compartidos con el wizard de Pricing.</p></div>
              <DhBadge variant="neutral">{{ catalogLoading ? 'Cargando catálogos' : 'Catálogos de Config' }}</DhBadge>
            </div>
            <div class="grid gap-4 md:grid-cols-3">
              <div>
                <PricingLocationSearchSelect v-if="polOptions.length" v-model="selectedPol" label="Origen / POL" placeholder="Buscar puerto o ciudad…" search-placeholder="Nombre, código o país…" :options="polOptions" terminal-type="CY" />
                <DhInput v-else v-model="form.pol" label="Origen / POL" placeholder="Puerto o lugar de origen" />
                <DhInput v-if="form.pol && !selectedPol && polOptions.length" v-model="form.pol" label="Origen registrado / texto libre" />
              </div>
              <div>
                <PricingLocationSearchSelect v-if="poeOptions.length" v-model="selectedPoe" label="Entrada / POE" placeholder="Buscar puerto de entrada…" search-placeholder="Nombre, código o país…" :options="poeOptions" terminal-type="CY" />
                <DhInput v-else v-model="form.poe" label="Entrada / POE" placeholder="Puerto de entrada" />
                <DhInput v-if="form.poe && !selectedPoe && poeOptions.length" v-model="form.poe" label="POE registrado / texto libre"  />
              </div>
              <div>
                <PricingLocationSearchSelect v-if="podOptions.length" v-model="selectedPod" label="Destino final / POD" placeholder="Buscar destino…" search-placeholder="Nombre, código o país…" :options="podOptions" terminal-type="SD" />
                <DhInput v-else v-model="form.pod" label="Destino final / POD" placeholder="Destino" />
                <DhInput v-if="form.pod && !selectedPod && podOptions.length" v-model="form.pod" label="POD registrado / texto libre" />
              </div>
            </div>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <DhInput v-model="form.etm" label="Fecha estimada de salida (ETD)" type="date" />
            <DhInput v-model="form.eta" label="Fecha estimada de llegada (ETA)" type="date" />
          </div>
        </div>

        <div v-show="activeStep === 4" class="space-y-5">
          <DhTextarea v-model="form.cargoDescription" label="Descripción de la mercancía" :rows="3" />
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DhInput v-model="form.packageCount" label="Cantidad de bultos" type="number" :min="0" />
            <DhInput v-model="form.packageType" label="Tipo de bulto" />
            <DhInput v-model="form.weightValue" label="Peso bruto" type="number" :min="0" />
            <DhSelect v-model="form.weightUnit" label="Unidad peso" :options="[{ label: 'Kilogramos', value: 'KG' }, { label: 'Libras', value: 'LB' }]" />
            <DhInput v-model="form.volumeValue" label="Volumen" type="number" :min="0" />
            <DhSelect v-model="form.volumeUnit" label="Unidad volumen" :options="[{ label: 'CBM', value: 'CBM' }, { label: 'CFT', value: 'CFT' }]" />
            <DhInput v-model="form.consolidationReference" label="Referencia de consolidado" />
          </div>
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4 sm:p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div><h4 class="text-sm font-black">Condiciones especiales</h4><p class="text-xs text-[var(--dh-text-muted)]">Se mostrarán únicamente los campos que correspondan.</p></div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <DhCheckbox v-model="form.isImo" label="Mercancía peligrosa / IMO" />
              <DhCheckbox v-model="form.stackable" label="Carga estibable" />
              <DhCheckbox v-model="form.overweight" label="Requiere gestión de sobrepeso" />
              <DhInput v-if="form.isImo" v-model="form.imoClass" label="Clase IMO" />
              <DhInput v-if="form.isImo" v-model="form.unNumber" label="Número UN" />
              <DhInput v-if="form.overweight" v-model="form.overweightNotes" label="Requerimientos por sobrepeso" />
            </div>
          </div>
          <div v-if="needsEquipment || form.equipment.length" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h4 class="text-sm font-black">Equipos de transporte</h4><p class="mt-1 text-xs text-[var(--dh-text-muted)]">Selecciona los tipos de equipo del catálogo usado en Crear tarifas.</p></div>
              <DhButton variant="secondary" :icon="Plus" label="Agregar equipo" size="sm" @click="addEquipment" />
            </div>
            <div v-if="!form.equipment.length" class="rounded-xl border border-dashed border-[var(--dh-border)] p-5 text-center text-sm text-[var(--dh-text-muted)]">Agrega al menos un equipo cuando corresponda.</div>
            <div v-for="(item, index) in form.equipment" :key="index" class="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-3">
              <div class="min-w-[170px] flex-1">
                <PricingContainerSelector
                  :model-value="item.equipmentCatalogId || selectedForLabel(equipmentCatalogKey, item.equipmentType)"
                  :transport="effectiveShipment === 'FTL' ? 'land' : 'maritime'"
                  @update:model-value="setEquipmentType(item, $event)"
                />
                <DhInput v-if="item.equipmentType && !item.equipmentCatalogId && !selectedForLabel(equipmentCatalogKey, item.equipmentType)"
                  v-model="item.equipmentType" label="Equipo histórico / referencia" />
              </div>
              <div class="w-36"><DhInput :model-value="item.quantity" label="Cantidad" type="number" :min="1" :step="1" @update:model-value="item.quantity = Number($event)" /></div>
              <DhButton variant="secondary" :icon="Trash2" label="Quitar" size="sm" @click="form.equipment.splice(index, 1)" />
            </div>
          </div>
        </div>

        <div v-show="activeStep === 5" class="space-y-5">
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4 sm:p-5">
            <div class="mb-4"><h4 class="text-sm font-black">Servicios contratados</h4><p class="mt-1 text-xs text-[var(--dh-text-muted)]">Mismo multiselector de servicios utilizado por Pricing. Esto documenta la operación: no crea ni cambia cargos comerciales.</p></div>
            <PricingCrystalMultiSelect v-model="form.services" label="Servicios" placeholder="Seleccionar servicios" search-placeholder="Buscar servicio..." :options="serviceChoices" />
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <div class="space-y-4 rounded-[22px] border border-[var(--dh-border)] p-4 sm:p-5">
              <DhCheckbox v-model="form.requiresPickup" label="Requiere recolecta" />
              <template v-if="form.requiresPickup">
                <DhInput v-model="form.pickupAddress" label="Dirección de recolecta" />
                <DhInput v-model="form.pickupContact" label="Contacto en origen" />
                <DhInput v-model="form.pickupWindow" label="Ventana u horario de recolecta" />
              </template>
              <DhInput v-model="form.destinationAddress" label="Dirección de entrega final" />
            </div>
            <div class="space-y-4 rounded-[22px] border border-[var(--dh-border)] p-4 sm:p-5">
              <PricingLocationSearchSelect
                v-if="warehouseOptions.length && (requiresWarehouse || ['LCL','LTL'].includes(effectiveShipment))"
                v-model="selectedWarehouse" label="WHS"
                placeholder="Seleccionar WHS" search-placeholder="Buscar bodega o ciudad…"
                :options="warehouseOptions" terminal-type="WHS"
              />
              <DhInput v-if="requiresWarehouse || ['LCL','LTL'].includes(effectiveShipment)" v-model="form.whsName" label="Nombre WHS / referencia registrada" />
              <DhSelect v-if="agentChoices.length" v-model="form.agentReference" label="Agente de origen" :options="asChoices('agents', form.agentReference)" />
              <DhInput v-else v-model="form.agentReference" label="Agente / oficina de origen" />
              <DhSelect v-if="isMaritime && carrierChoices.length" v-model="form.carrierReference" label="Naviera" :options="asChoices('carriers', form.carrierReference)" />
              <DhInput v-else-if="isMaritime" v-model="form.carrierReference" label="Naviera / proveedor" />
              <DhInput v-if="isMaritime" v-model="form.merchantReference" label="Merchant / referencia" />
            </div>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <DhInput :model-value="priority" label="Prioridad (1–5)" type="number" :min="1" :max="5" :step="1" @update:model-value="priority = Number($event)" />
            <DhInput :model-value="complexity" label="Puntos de complejidad" type="number" :min="0.5" :max="1000" :step="0.5" @update:model-value="complexity = Number($event)" />
          </div>
          <DhTextarea v-model="form.observations" label="Observaciones e instrucciones operativas" :rows="4" />
          <DhCheckbox v-model="form.commercialReviewRequested" label="Solicitar revisión comercial en Pricing (requiere integración)" />
        </div>

        <div v-show="activeStep === 6" class="space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div><h4 class="text-base font-black">Resumen del expediente</h4><p class="mt-1 text-xs text-[var(--dh-text-muted)]">Verifica los datos antes de guardar. El IDTRA se asignará automáticamente.</p></div>
            <DhBadge :variant="blockers.length ? 'warning' : 'success'">{{ blockers.length ? 'Borrador incompleto' : 'Listo para validación' }}</DhBadge>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="field in summaryFields" :key="field.label" class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)]/50 p-3.5">
              <p class="text-[10px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">{{ field.label }}</p>
              <p class="mt-1 break-words text-sm font-bold">{{ field.value }}</p>
            </div>
          </div>
          <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <h4 class="text-sm font-black">Completitud de la apertura</h4>
            <p v-if="!blockers.length" class="mt-2 text-sm text-[var(--dh-text-muted)]">Los campos críticos básicos están completos. La validación definitiva continúa en Aperturas.</p>
            <ul v-else class="mt-3 grid list-disc gap-2 pl-5 text-sm font-semibold text-amber-500 sm:grid-cols-2">
              <li v-for="field in blockers" :key="field">{{ field }}</li>
            </ul>
            <p class="mt-3 text-xs text-[var(--dh-text-muted)]">Guardar no modifica ninguna QUO ni los costos existentes. Se guarda la ficha operativa, su auditoría y las referencias relacionadas.</p>
          </div>
        </div>
      </div>
    </section>

    <footer class="sticky bottom-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-[23px] border border-[var(--dh-border)] bg-[var(--dh-card-solid,var(--dh-card))] p-3 shadow-xl sm:p-4">
      <DhButton variant="secondary" :icon="ChevronLeft" label="Anterior" :disabled="activeStep <= 1" @click="goToStep(activeStep - 1)" />
      <div class="hidden text-center sm:block">
        <p class="text-xs font-black">{{ activeStepMeta.label }}</p>
        <p class="text-[11px] text-[var(--dh-text-muted)]">Paso {{ activeStep }} / {{ wizardSteps.length }}</p>
      </div>
      <div class="flex items-center gap-2">
        <DhButton v-if="activeStep < wizardSteps.length" :icon="ChevronRight" label="Siguiente" @click="goToStep(activeStep + 1)" />
        <DhButton v-else :icon="Save" :label="editingId ? 'Guardar modificaciones' : 'Guardar borrador'" :disabled="loading || !valid" :loading="saving" @click="save" />
      </div>
    </footer>
  </div>
</template>
