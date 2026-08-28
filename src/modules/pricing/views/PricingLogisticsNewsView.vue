<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Eye, RefreshCw, Sparkles } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhTextarea } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import {
  LogisticsNewsService,
  type LogisticsNewsDto,
  type LogisticsNewsImpactDto,
} from '@/core/services/logisticsNewsService'
import { useToastStore } from '@/core/stores/toastStore'
import { formatDate } from '@/modules/pricing/utils/pricingFormat'

const toastStore = useToastStore()
const rows = ref<LogisticsNewsDto[]>([])
const impacts = ref<LogisticsNewsImpactDto[]>([])
const selectedNewsId = ref('')
const loading = ref(false)
const saving = ref(false)
const processingId = ref('')
const loadingImpacts = ref(false)

const form = reactive({
  title: '',
  sourceCountry: '',
  sourceOffice: '',
  receivedDate: new Date().toISOString().slice(0, 10),
  content: '',
})

const selectedNews = computed(() => rows.value.find((row) => row.id === selectedNewsId.value) ?? null)

function statusLabel(status: string) {
  return ({
    PendingAnalysis: 'Pendiente IA',
    Applied: 'Aplicada',
    NoMatches: 'Sin coincidencias',
    Failed: 'Fallida',
    Inactive: 'Inactiva',
  } as Record<string, string>)[status] ?? status
}

function statusVariant(status: string): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Applied') return 'success'
  if (status === 'Failed') return 'danger'
  if (status === 'NoMatches') return 'warning'
  if (status === 'PendingAnalysis') return 'primary'
  return 'neutral'
}

function severityLabel(severity?: string | null) {
  return ({
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    critical: 'Crítica',
  } as Record<string, string>)[String(severity ?? '').toLowerCase()] ?? '—'
}

function severityVariant(severity?: string | null): 'success' | 'warning' | 'danger' | 'neutral' {
  const normalized = String(severity ?? '').toLowerCase()
  if (normalized === 'critical' || normalized === 'high') return 'danger'
  if (normalized === 'medium') return 'warning'
  if (normalized === 'low') return 'success'
  return 'neutral'
}

async function load() {
  loading.value = true
  try {
    rows.value = await LogisticsNewsService.list()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las noticias logísticas.')
  } finally {
    loading.value = false
  }
}

async function createNews() {
  if (!form.content.trim()) {
    toastStore.warning('Noticia requerida', 'Ingrese la información logística recibida.')
    return
  }

  saving.value = true
  try {
    const created = await LogisticsNewsService.create({
      content: form.content.trim(),
      title: form.title.trim() || null,
      sourceCountry: form.sourceCountry.trim() || null,
      sourceOffice: form.sourceOffice.trim() || null,
      receivedAtUtc: form.receivedDate ? `${form.receivedDate}T12:00:00Z` : null,
    })

    form.title = ''
    form.content = ''
    form.sourceCountry = ''
    form.sourceOffice = ''
    form.receivedDate = new Date().toISOString().slice(0, 10)

    await load()

    if (created.status === 'Applied') {
      toastStore.success(
        'Noticia procesada',
        `La IA y Pricing aplicaron la alerta a ${created.appliedRateCount} tarifa(s) aprobada(s) y vigente(s).`,
      )
    } else if (created.status === 'NoMatches') {
      toastStore.warning(
        'Sin tarifas coincidentes',
        'La noticia quedó registrada, pero no hay tarifas aprobadas y vigentes que coincidan con la naviera/ruta detectada.',
      )
    } else if (created.status === 'Failed') {
      toastStore.warning(
        'Noticia registrada',
        created.processingError || 'La noticia se guardó, pero la IA no pudo procesarla. Puede reprocesarla.',
      )
    }
  } catch (error) {
    toastStore.backendError(error, 'No se pudo registrar la noticia logística.')
  } finally {
    saving.value = false
  }
}

async function reprocess(row: LogisticsNewsDto) {
  processingId.value = row.id
  try {
    const updated = await LogisticsNewsService.reprocess(row.id)
    await load()
    toastStore.success(
      'Noticia reprocesada',
      updated.appliedRateCount > 0
        ? `Quedó asociada a ${updated.appliedRateCount} tarifa(s).`
        : 'No se encontraron nuevas tarifas aprobadas y vigentes para esta noticia.',
    )
  } catch (error) {
    toastStore.backendError(error, 'No se pudo reprocesar la noticia.')
  } finally {
    processingId.value = ''
  }
}

async function toggleActive(row: LogisticsNewsDto) {
  processingId.value = row.id
  try {
    await LogisticsNewsService.setActive(row.id, !row.isActive)
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado de la noticia.')
  } finally {
    processingId.value = ''
  }
}

async function showImpacts(row: LogisticsNewsDto) {
  selectedNewsId.value = row.id
  loadingImpacts.value = true
  impacts.value = []
  try {
    impacts.value = await LogisticsNewsService.impacts(row.id)
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron consultar las tarifas afectadas.')
  } finally {
    loadingImpacts.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="space-y-5">
    <DhPageHeader
      title="Noticias logísticas"
      description="Registre alertas recibidas de China y otras oficinas. La IA interpreta la noticia y Pricing la aplica únicamente a tarifas importadas aprobadas y vigentes que coincidan con la naviera y la ruta."
    >
      <template #actions>
        <DhButton variant="secondary" :disabled="loading" @click="load">
          <RefreshCw class="h-4 w-4" />
          Actualizar
        </DhButton>
      </template>
    </DhPageHeader>

    <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-4">
        <p class="text-base font-black text-[var(--dh-text)]">Ingresar noticia</p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          Ejemplo: EMC no está liberando espacios desde Ningbo a Balboa.
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DhInput v-model="form.title" label="Título (opcional)" placeholder="Situación de espacio EMC" />
        <DhInput v-model="form.sourceCountry" label="País / fuente" placeholder="China" />
        <DhInput v-model="form.sourceOffice" label="Oficina / agente (opcional)" placeholder="Ningbo" />
        <DhInput v-model="form.receivedDate" type="date" label="Fecha recibida" />
      </div>

      <div class="mt-4">
        <DhTextarea
          v-model="form.content"
          label="Noticia logística"
          placeholder="Pegue aquí la información recibida sobre espacio, roleos, congestión, cambios de itinerario, restricciones u otra situación logística..."
          :rows="5"
        />
      </div>

      <div class="mt-4 flex justify-end">
        <DhButton :loading="saving" :disabled="saving" @click="createNews">
          <Sparkles class="h-4 w-4" />
          Analizar y aplicar con IA
        </DhButton>
      </div>
    </section>

    <section class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <div class="border-b border-[var(--dh-border)] px-5 py-4">
        <p class="font-black text-[var(--dh-text)]">Historial de noticias</p>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
          Se conserva la noticia, el análisis y las tarifas afectadas para trazabilidad.
        </p>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-[var(--dh-input)] text-left text-xs uppercase tracking-wide text-[var(--dh-text-muted)]">
            <tr>
              <th class="px-4 py-3">Fecha / fuente</th>
              <th class="px-4 py-3">Noticia</th>
              <th class="px-4 py-3">IA</th>
              <th class="px-4 py-3">Tarifas</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--dh-border)]">
            <tr v-if="loading">
              <td colspan="6" class="px-4 py-10 text-center font-semibold text-[var(--dh-text-muted)]">
                Cargando noticias...
              </td>
            </tr>
            <tr v-else-if="rows.length === 0">
              <td colspan="6" class="px-4 py-10 text-center font-semibold text-[var(--dh-text-muted)]">
                Todavía no hay noticias logísticas registradas.
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id" class="align-top">
              <td class="whitespace-nowrap px-4 py-4">
                <p class="font-black text-[var(--dh-text)]">{{ formatDate(row.receivedAtUtc) }}</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ row.sourceCountry || 'Sin país' }}<span v-if="row.sourceOffice"> · {{ row.sourceOffice }}</span>
                </p>
              </td>
              <td class="max-w-[420px] px-4 py-4">
                <p class="font-black text-[var(--dh-text)]">{{ row.title }}</p>
                <p class="mt-1 line-clamp-3 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
                  {{ row.content }}
                </p>
                <p v-if="row.processingError" class="mt-2 text-xs font-bold text-red-600 dark:text-red-400">
                  {{ row.processingError }}
                </p>
              </td>
              <td class="max-w-[330px] px-4 py-4">
                <div class="flex flex-wrap items-center gap-2">
                  <DhBadge v-if="row.severity" :label="severityLabel(row.severity)" :variant="severityVariant(row.severity)" />
                  <DhBadge v-if="row.eventType" :label="row.eventType" variant="neutral" />
                </div>
                <p v-if="row.aiSummary" class="mt-2 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
                  {{ row.aiSummary }}
                </p>
              </td>
              <td class="whitespace-nowrap px-4 py-4">
                <p class="font-black text-[var(--dh-text)]">{{ row.appliedRateCount }} aplicadas</p>
                <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.matchedRateCount }} coincidencias actuales</p>
              </td>
              <td class="whitespace-nowrap px-4 py-4">
                <DhBadge :label="statusLabel(row.status)" :variant="statusVariant(row.status)" />
              </td>
              <td class="px-4 py-4">
                <div class="flex justify-end gap-2">
                  <DhButton variant="ghost" size="sm" @click="showImpacts(row)">
                    <Eye class="h-4 w-4" />
                    Tarifas
                  </DhButton>
                  <DhButton
                    v-if="row.isActive"
                    variant="secondary"
                    size="sm"
                    :disabled="processingId === row.id"
                    @click="reprocess(row)"
                  >
                    Reprocesar
                  </DhButton>
                  <DhButton
                    variant="ghost"
                    size="sm"
                    :disabled="processingId === row.id"
                    @click="toggleActive(row)"
                  >
                    {{ row.isActive ? 'Desactivar' : 'Activar' }}
                  </DhButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-if="selectedNews"
      class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]"
    >
      <div class="border-b border-[var(--dh-border)] px-5 py-4">
        <p class="font-black text-[var(--dh-text)]">Tarifas afectadas · {{ selectedNews.title }}</p>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
          Estas son las tarifas donde se agregó la alerta al campo de observaciones/espacio.
        </p>
      </div>

      <div v-if="loadingImpacts" class="px-5 py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
        Consultando impactos...
      </div>
      <div v-else-if="impacts.length === 0" class="px-5 py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
        Esta noticia todavía no ha sido aplicada a ninguna tarifa.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-[var(--dh-input)] text-left text-xs uppercase tracking-wide text-[var(--dh-text-muted)]">
            <tr>
              <th class="px-4 py-3">Naviera</th>
              <th class="px-4 py-3">Ruta</th>
              <th class="px-4 py-3">Equipo</th>
              <th class="px-4 py-3">Vigencia</th>
              <th class="px-4 py-3">Comentario aplicado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--dh-border)]">
            <tr v-for="impact in impacts" :key="impact.id" class="align-top">
              <td class="px-4 py-4 font-black text-[var(--dh-text)]">{{ impact.carrier }}</td>
              <td class="px-4 py-4 font-semibold text-[var(--dh-text)]">
                {{ impact.pol }} → {{ impact.poe }} → {{ impact.pod }}
              </td>
              <td class="px-4 py-4 font-semibold text-[var(--dh-text)]">{{ impact.containerType }}</td>
              <td class="whitespace-nowrap px-4 py-4 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ formatDate(impact.validFrom) }} – {{ formatDate(impact.validTo) }}
              </td>
              <td class="max-w-[520px] px-4 py-4 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
                {{ impact.appliedComment }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
