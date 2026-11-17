<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { BadgeCheck, FileCheck2, Search } from 'lucide-vue-next'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { crmRequest } from '../services/crmApi'
import { crmHaciendaErrorMessage, isMatchingCrmHaciendaResult, retryCrmHaciendaNetwork } from '../utils/crmHacienda'

export interface HaciendaResult {
  identification: string
  name: string
  identificationType: string | null
  regime: string | null
  verifiedAt: string
  activities: { code: string; description: string; type: string }[]
}

const props = withDefaults(defineProps<{
  countryId: string
  taxId: string
  active?: boolean
}>(), { active: true })
const emit = defineEmits<{ resolved: [data: HaciendaResult] }>()
const costaRicaId = ref('')
const loading = ref(false)
const error = ref('')
const result = ref<HaciendaResult | null>(null)
let lookupVersion = 0
let debounce: ReturnType<typeof setTimeout> | null = null
let inFlight: { identification: string; countryId: string; promise: Promise<boolean> } | null = null

const digits = computed(() => props.taxId.replace(/[\s-]/g, ''))
const isCostaRica = computed(() => !!props.countryId && costaRicaId.value === props.countryId)
const canLookup = computed(() => props.active && isCostaRica.value && /^\d{9,12}$/.test(digits.value))
const applied = computed(() => !!result.value &&
  result.value.identification.replace(/[\s-]/g, '') === digits.value)
const primaryActivity = computed(() => result.value?.activities?.find(item =>
  String(item.type || '').toLowerCase().includes('principal')) ||
  result.value?.activities?.[0] || null)

async function loadCountry() {
  try {
    const list = await CatalogItemsService.select({ catalogGroupSlug: 'countries' })
    const cr = list.find(x => x.isActive !== false &&
      [x.label, x.value, x.code, x.slug].some(v =>
        ['cr', 'cri', 'crc', 'costa rica', 'costa-rica']
          .includes(String(v ?? '').trim().toLowerCase())))
    costaRicaId.value = cr?.id ?? ''
  } catch {
    costaRicaId.value = ''
  }
}
void loadCountry()

function cancelDebounce() {
  if (debounce !== null) {
    clearTimeout(debounce)
    debounce = null
  }
}

/** The promise is shared with Save, so manual submission cannot race a lookup. */
async function lookup(force = false): Promise<boolean> {
  if (!canLookup.value) return false
  const identification = digits.value
  const countryId = props.countryId
  if (!force && applied.value) return true
  if (inFlight && inFlight.identification === identification &&
    inFlight.countryId === countryId) return inFlight.promise

  const version = ++lookupVersion
  cancelDebounce()
  loading.value = true
  error.value = ''
  result.value = null
  const task = (async () => {
    try {
      const params = new URLSearchParams({ identificacion: identification, countryId })
      const response = await retryCrmHaciendaNetwork(
        () => crmRequest<HaciendaResult>('/api/crm/hacienda/lookup?' + params.toString()),
        () => version === lookupVersion && props.active &&
          props.countryId === countryId && digits.value === identification,
      )
      if (!isMatchingCrmHaciendaResult(response, identification)) {
        if (version === lookupVersion) error.value = 'Hacienda devolvió información incompleta. Volvé a consultar'
        return false
      }
      if (version !== lookupVersion || !props.active || props.countryId !== countryId ||
        digits.value !== identification ||
        response.identification.replace(/[\s-]/g, '') !== identification ||
        !response.name?.trim()) return false
      result.value = response
      // CRM and SRM both apply the official values immediately without an extra button.
      emit('resolved', response)
      return true
    } catch (cause) {
      if (version === lookupVersion) {
        result.value = null
        error.value = crmHaciendaErrorMessage(cause)
      }
      return false
    } finally {
      if (version === lookupVersion) {
        loading.value = false
        inFlight = null
      }
    }
  })()
  inFlight = { identification, countryId, promise: task }
  return task
}

/** If Hacienda is unavailable the form remains editable; no fabricated fields. */
async function ensureVerified(): Promise<boolean> {
  if (!canLookup.value) return false
  if (applied.value) return true
  if (inFlight?.countryId === props.countryId &&
      inFlight.identification === digits.value) return inFlight.promise
  // Preserve an earlier failure instead of looping an unavailable service on every save.
  if (error.value) return false
  return lookup()
}
defineExpose({ ensureVerified })

watch([digits, () => props.countryId, isCostaRica, () => props.active], (_next, _prev, onCleanup) => {
  ++lookupVersion
  cancelDebounce()
  inFlight = null
  loading.value = false
  error.value = ''
  result.value = null
  if (canLookup.value) debounce = setTimeout(() => {
    debounce = null
    void lookup()
  }, 650)
  onCleanup(cancelDebounce)
}, { immediate: true })
onBeforeUnmount(() => {
  ++lookupVersion
  cancelDebounce()
})
</script>

<template>
  <section v-if="isCostaRica" data-crm-hacienda-auto
    class="space-y-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-card)] text-[var(--dh-primary)]">
          <FileCheck2 class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-extrabold text-[var(--dh-text)]">Verificación oficial de Hacienda</h3>
          <p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">
            Al ingresar una cédula válida se completan automáticamente la razón social y el tipo de identificación.
          </p>
        </div>
      </div>
      <button type="button" :disabled="!canLookup || loading"
        class="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-2 text-xs font-bold hover:border-[var(--dh-primary)] disabled:opacity-50"
        @click="lookup(true)">
        <Search class="h-4 w-4" />
        {{ loading ? 'Consultando…' : 'Volver a consultar' }}
      </button>
    </div>
    <p v-if="!canLookup" class="text-xs text-[var(--dh-text-muted)]">
      Ingresá una identificación de 9 a 12 dígitos para consultar Hacienda automáticamente.
    </p>
    <p v-else-if="loading" role="status" class="text-xs font-semibold text-[var(--dh-text-muted)]">
      Verificando contribuyente…
    </p>
    <p v-else-if="error" role="alert"
      class="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500">
      {{ error }}. Podés continuar ingresando los datos manualmente.
    </p>
    <div v-if="applied && result" role="status" class="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
      <p class="flex items-center gap-2 text-sm font-bold">
        <BadgeCheck class="h-4 w-4 shrink-0 text-emerald-500" />
        <span class="break-words">{{ result.name }}</span>
      </p>
      <p class="text-xs text-[var(--dh-text-muted)]">Los datos oficiales se aplicaron automáticamente a la ficha.</p>
      <div class="flex flex-wrap gap-2 text-xs text-[var(--dh-text-muted)]">
        <span v-if="result.identificationType" class="rounded-lg border border-[var(--dh-border)] px-2 py-1">
          Tipo de identificación: {{ result.identificationType }}
        </span>
        <span v-if="result.regime" class="rounded-lg border border-[var(--dh-border)] px-2 py-1">
          Régimen: {{ result.regime }}
        </span>
        <span v-if="primaryActivity" class="rounded-lg border border-[var(--dh-border)] px-2 py-1">
          Actividad principal: {{ primaryActivity.code }}
        </span>
      </div>
      <div v-if="result.activities.length" class="grid gap-2 sm:grid-cols-2">
        <div v-for="activity in result.activities" :key="activity.code"
          class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 text-xs">
          <strong class="text-[var(--dh-primary)]">{{ activity.code }}</strong>
          <span class="ml-2">{{ activity.description }}</span>
        </div>
      </div>
      <p v-else class="text-xs text-[var(--dh-text-muted)]">
        Hacienda no devolvió actividades económicas; no se completó ningún código.
      </p>
    </div>
  </section>
</template>
