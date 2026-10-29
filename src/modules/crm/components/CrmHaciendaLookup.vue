<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DhButton } from '@/shared/components/atoms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { crmError, crmRequest } from '../services/crmApi'
import { BadgeCheck, Search } from 'lucide-vue-next'

export interface HaciendaResult {
  identification: string
  name: string
  identificationType: string | null
  regime: string | null
  verifiedAt: string
  activities: {code: string; description: string; type: string}[]
}

const props = defineProps<{ countryId: string; taxId: string }>()
const emit = defineEmits<{ resolved: [data: HaciendaResult] }>()
const costaRicaId = ref('')
const loading = ref(false)
const error = ref('')
const result = ref<HaciendaResult | null>(null)
let lookupVersion = 0

const isCostaRica = computed(() => !!props.countryId && costaRicaId.value === props.countryId)
const digits = computed(() => props.taxId.replace(/[\s-]/g, ''))
const canLookup = computed(() => isCostaRica.value && /^\d{9,12}$/.test(digits.value))

async function loadCountry() {
  try {
    const list = await CatalogItemsService.select({catalogGroupSlug: 'countries'})
    const cr = list.find(x => x.isActive !== false &&
      [x.label, x.value, x.code, x.slug].some(v => ['cr','cri','crc','costa rica','costa-rica']
        .includes(String(v ?? '').trim().toLowerCase())))
    costaRicaId.value = cr?.id ?? ''
  } catch { costaRicaId.value = '' }
}
watch(() => [props.countryId, props.taxId], () => {
  lookupVersion++
  loading.value = false
  result.value = null
  error.value = ''
})
void loadCountry()

async function lookup() {
  if (!canLookup.value) return
  const version = ++lookupVersion
  const identification = digits.value
  const selectedCountry = props.countryId
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({identificacion: identification, countryId: selectedCountry})
    const response = await crmRequest<HaciendaResult>('/api/crm/hacienda/lookup?' + params.toString())
    // Never apply a response for a previous tax ID to the current form.
    if (version !== lookupVersion || digits.value !== identification ||
      props.countryId !== selectedCountry) return
    result.value = response
    emit('resolved', response)
  } catch (e) {
    if (version !== lookupVersion) return
    result.value = null
    error.value = crmError(e)
  } finally { if (version === lookupVersion) loading.value = false }
}
</script>

<template>
  <div v-if="isCostaRica" class="space-y-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-black text-[var(--dh-text)]">Información oficial de Hacienda</h3>
        <p class="text-xs text-[var(--dh-text-muted)]">Costa Rica · consulta de contribuyente por identificación</p>
      </div>
      <DhButton :icon="Search" label="Consultar cédula" :loading="loading"
        :disabled="!canLookup" variant="secondary" size="sm" @click="lookup" />
    </div>
    <p v-if="!canLookup" class="text-xs text-[var(--dh-text-muted)]">Digite una identificación de 9 a 12 dígitos.</p>
    <p v-if="error" role="alert" class="text-xs text-red-500">{{ error }}</p>
    <div v-if="result" role="status" class="space-y-2 text-sm">
      <p class="flex items-center gap-2 font-bold text-[var(--dh-text)]">
        <BadgeCheck class="h-4 w-4 text-emerald-500" /> {{ result.name }}
      </p>
      <p class="text-xs text-[var(--dh-text-muted)]">Razón social y tipo de identificación completados desde Hacienda.</p>
      <div v-if="result.activities.length" class="space-y-1">
        <p class="text-xs font-bold">Actividades económicas ({{ result.activities.length }})</p>
        <p v-for="activity in result.activities" :key="activity.code"
          class="rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs">
          {{ activity.code }} · {{ activity.description }}
        </p>
      </div>
    </div>
  </div>
</template>
