<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhSearchInput } from '@/shared/components/molecules'
import { DhModal } from '@/shared/components/organisms'
import { operationsApi, type CrmAccountOption } from '../services/operationsApi'
import { useAuthStore } from '@/core/stores/authStore'

const props = defineProps<{ open: boolean }>()
const auth = useAuthStore()
const router = useRouter()
const canInitialize = computed(() => auth.hasScope('operations.team.manage'))
const initializing = ref(false)
const emit = defineEmits<{
  close: []
  created: [result: { id: string; idtra: string; status: string }]
}>()

const opening = ref({
  companyId: '', accountId: '', modalityCode: 'FCL',
  priority: 1, complexityPoints: 1, originCountryCode: '', destinationCountryCode: '',
})
const crmSearch = ref('')
const crmAccounts = ref<CrmAccountOption[]>([])
const loadingCrm = ref(false)
const loadingContext = ref(false)
const busy = ref(false)
const error = ref('')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isIso = (value: string) => !value.trim() || /^[a-zA-Z]{2}$/.test(value.trim())
const valid = computed(() =>
  uuid.test(opening.value.companyId) && uuid.test(opening.value.accountId) &&
  Number.isInteger(opening.value.priority) &&
  opening.value.priority >= 1 && opening.value.priority <= 5 &&
  Number.isFinite(opening.value.complexityPoints) &&
  opening.value.complexityPoints >= 0.5 && opening.value.complexityPoints <= 1000 &&
  isIso(opening.value.originCountryCode) && isIso(opening.value.destinationCountryCode))
const crmOptions = computed(() => [
  { label: 'Seleccionar cuenta de CRM', value: '' },
  ...crmAccounts.value.map(c => ({ label: c.displayName || c.legalName || c.id, value: c.id })),
])
const modalityOptions = [
  { label: 'FCL', value: 'FCL' }, { label: 'LCL', value: 'LCL' },
  { label: 'FTL', value: 'FTL' }, { label: 'LTL', value: 'LTL' },
  { label: 'Aéreo', value: 'AIR' }, { label: 'Multimodal', value: 'MULTIMODAL' },
]
async function fetchCrm() {
  if (!props.open) return
  loadingCrm.value = true
  try {
    const response = await operationsApi.crmAccounts(crmSearch.value)
    if (props.open) crmAccounts.value = response.items
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo consultar CRM.'
  } finally { loadingCrm.value = false }
}
watch(() => props.open, async value => {
  if (!value) return
  error.value = ''
  loadingContext.value = true
  try {
    const context = await operationsApi.createContext()
    opening.value.companyId = context.companyId ?? ''
    if (!opening.value.companyId) error.value = 'No se pudo resolver la empresa desde el servidor. Revise la configuración de Operations.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo consultar la empresa.'
  } finally { loadingContext.value = false }
  await fetchCrm()
})
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(crmSearch, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void fetchCrm() }, 250)
})
async function initializeWorkspace() {
  if (!canInitialize.value || initializing.value) return
  initializing.value = true
  error.value = ''
  try {
    // Authorized endpoint provisions the standard team catalog and persists
    // the tenant. It never creates users, grants scopes or fake memberships.
    await operationsApi.initializeTeams()
    const context = await operationsApi.createContext()
    opening.value.companyId = context.companyId ?? ''
    if (!opening.value.companyId)
      error.value = 'La empresa operativa continúa sin identificarse. Revise la configuración.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo inicializar Operaciones.'
  } finally { initializing.value = false }
}
async function submit() {
  emit('close')
  await router.push({ name: 'operations-case-create' })
}
</script>

<template>
  <DhModal :open="open" title="Nuevo trámite · Apertura manual" size="lg" @close="emit('close')">
    <form class="space-y-5" @submit.prevent="submit">
      <p class="text-sm text-[var(--dh-text-muted)]">
        Registre una asignación directa de un cliente. La QUO es opcional; el ejecutivo se obtiene de CRM.
        Completa el formulario de apertura para enviar el trámite a Coordinación Origen. No se inventarán costos comerciales.
      </p>
      <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{{ error }}</div>
      <div v-if="!opening.companyId && canInitialize" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
        <p class="mb-3 text-sm">Este entorno todavía no tiene una empresa operativa inicializada. Un administrador puede preparar el catálogo de equipos sin crear usuarios.</p>
        <DhButton variant="secondary" label="Inicializar equipos de Operaciones" :loading="initializing" @click="initializeWorkspace" />
      </div>
      <div class="space-y-2">
        <label class="text-xs font-bold text-[var(--dh-text)]">Buscar cuenta cliente en CRM</label>
        <DhSearchInput v-model="crmSearch" placeholder="Nombre o cédula de la cuenta" />
        <DhSelect v-model="opening.accountId" :options="crmOptions" label="Cliente" :disabled="loadingCrm" />
        <p class="text-xs text-[var(--dh-text-muted)]">Se utilizará el ejecutivo comercial responsable de esta cuenta.</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <DhSelect v-model="opening.modalityCode" label="Modalidad" :options="modalityOptions" />
        <DhInput :model-value="opening.priority" label="Prioridad (1-5)" type="number" :min="1" :max="5" :step="1" @update:model-value="opening.priority = Number($event)" />
        <DhInput :model-value="opening.complexityPoints" label="Puntos de complejidad" type="number" :min="0.5" :max="1000" :step="0.5" @update:model-value="opening.complexityPoints = Number($event)" />
        <DhInput v-model="opening.originCountryCode" label="País de origen (ISO, opcional)" placeholder="CR" />
        <DhInput v-model="opening.destinationCountryCode" label="País de destino (ISO, opcional)" placeholder="HN" />
      </div>
      <p class="rounded-xl bg-[var(--dh-input)] p-3 text-xs text-[var(--dh-text-muted)]">
        El formulario completo verifica los datos antes del envío directo a Coordinación Origen.
        El IDTRA lo genera PostgreSQL; no se introduce manualmente.
      </p>
      <div class="flex flex-wrap justify-end gap-2">
        <DhButton variant="secondary" label="Cancelar" @click="emit('close')" />
        <DhButton type="submit" :icon="Plus" label="Continuar al formulario" :loading="busy || loadingContext" :disabled="!valid || loadingContext" />
      </div>
    </form>
  </DhModal>
</template>
