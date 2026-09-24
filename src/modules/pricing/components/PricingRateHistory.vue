<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { History, MessageSquareText, PencilLine, ShieldCheck, UserRound } from 'lucide-vue-next'
import { DhBadge } from '@/shared/components/atoms'
import { AuditLogsService } from '@/core/services/auditLogsService'
import type { AuditEventDto } from '@/core/interfaces/auditLogs'

type JsonRecord = Record<string, unknown>

interface HistoryGroup {
  id: string
  root: AuditEventDto
  details: AuditEventDto[]
}

interface FieldChange {
  field: string
  label: string
  before: unknown
  after: unknown
}

const props = defineProps<{ rateId: string }>()

const loading = ref(false)
const error = ref('')
const events = ref<AuditEventDto[]>([])

const fieldLabels: Record<string, string> = {
  RateName: 'Nombre de tarifa',
  AgentName: 'Agente',
  CarrierName: 'Naviera / proveedor',
  PolName: 'POL',
  PoeName: 'POE',
  PodName: 'POD',
  ContainerTypeName: 'Equipo',
  ContainerQuantity: 'Cantidad de equipo',
  ShipmentMode: 'Modalidad',
  TotalPackages: 'Bultos',
  TotalPallets: 'Pallets',
  TotalWeightKg: 'Peso (kg)',
  TotalVolumeCbm: 'Volumen (CBM)',
  KgPerCbm: 'Kg por CBM',
  ChargeableQuantity: 'Cantidad cobrable',
  IncotermName: 'Incoterm',
  PickupAddress: 'Dirección de recolección',
  CurrencyName: 'Moneda',
  ExchangeRateApplied: 'Tipo de cambio aplicado',
  FreeDays: 'Días libres',
  ValidFrom: 'Vigencia desde',
  ValidTo: 'Vigencia hasta',
  ClientName: 'Cliente',
  IdtraNumber: 'IDTRA',
  QuoNumber: 'QUO',
  Includes: 'Incluye',
  SubjectTo: 'Sujeto a',
  Excludes: 'No incluye',
  TransitTime: 'Tiempo de tránsito',
  RateType: 'Tipo de tarifa',
  TotalCostAmount: 'Costo total',
  TotalSaleAmount: 'Venta total',
  TotalUtilityAmount: 'Utilidad total',
  MarginPercentage: 'Margen',
  RequiredApproval: 'Requiere aprobación',
  Status: 'Estado',
  Containers: 'Contenedores',
  FinalBackupStorageIds: 'Respaldos finales',
  Name: 'Rubro',
  CostDetailType: 'Tipo de rubro',
  CostType: 'Tipo de costo',
  ChargeBasis: 'Base de cobro',
  CurrencyCode: 'Moneda',
  CostAmount: 'Costo unitario',
  SaleAmount: 'Venta unitaria',
  UtilityAmount: 'Utilidad unitaria',
  Quantity: 'Cantidad',
  Notes: 'Notas',
}

const ignoredHeaderFields = new Set([
  'Id',
  'SourceImportFclRateId',
  'AgentId',
  'AgentCode',
  'CarrierId',
  'CarrierCode',
  'PolId',
  'PolCode',
  'PoeId',
  'PoeCode',
  'PodId',
  'PodCode',
  'ContainerTypeId',
  'ContainerTypeCode',
  'IncotermId',
  'IncotermCode',
  'WarehouseId',
  'CurrencyId',
  'CurrencyCode',
  'ExchangeRateCapturedAtUtc',
  'ExchangeRateSource',
  'ExchangeRateManualOverride',
  'CargoLinesJson',
  'RateDetails',
])

const ignoredDetailFields = new Set(['Id', 'RateHeaderId', 'CostId'])

function parseRecord(value?: string | null): JsonRecord {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : {}
  } catch {
    return {}
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim()
}

function labelFor(field: string): string {
  return fieldLabels[field] || humanize(field)
}

function diffRecords(before: JsonRecord, after: JsonRecord, ignored: Set<string>): FieldChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys]
    .filter((field) => !ignored.has(field))
    .filter((field) => !sameValue(before[field], after[field]))
    .map((field) => ({
      field,
      label: labelFor(field),
      before: before[field],
      after: after[field],
    }))
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString('es-CR')
      : value.toLocaleString('es-CR', { maximumFractionDigits: 4 })
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value.map((item) => {
      if (item && typeof item === 'object') {
        const record = item as JsonRecord
        const name = record.ContainerTypeName ?? record.Name ?? record.name
        const quantity = record.Quantity ?? record.quantity
        if (name) return quantity ? `${quantity} × ${name}` : String(name)
      }
      return typeof item === 'object' ? JSON.stringify(item) : String(item)
    }).join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('es-CR')
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const date = new Date(text)
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('es-CR')
  }
  return text
}

function actor(event: AuditEventDto): string {
  return event.userName || event.userId || 'Sistema'
}

function actionLabel(event: AuditEventDto): string {
  const action = (event.action || '').toLowerCase()
  if (action === 'approved') return 'Aprobó'
  if (action === 'rejected') return 'Rechazó'
  if (action === 'created') return 'Creó'
  if (action === 'updated') return 'Modificó'
  return humanize(action || 'Evento')
}

function actionVariant(event: AuditEventDto): 'success' | 'danger' | 'primary' | 'neutral' {
  const action = (event.action || '').toLowerCase()
  if (action === 'approved') return 'success'
  if (action === 'rejected') return 'danger'
  if (action === 'updated') return 'primary'
  return 'neutral'
}

function editReason(event: AuditEventDto): string {
  const payload = parseRecord(event.payloadJson)
  const value = payload.UpdateReason ?? payload.updateReason ?? payload.Reason ?? payload.reason
  return typeof value === 'string' ? value.trim() : ''
}

function headerChanges(event: AuditEventDto): FieldChange[] {
  return diffRecords(parseRecord(event.beforeJson), parseRecord(event.afterJson), ignoredHeaderFields)
}

function detailName(event: AuditEventDto): string {
  const after = parseRecord(event.afterJson)
  const before = parseRecord(event.beforeJson)
  return String(after.Name ?? before.Name ?? 'Rubro de tarifa')
}

function detailChanges(event: AuditEventDto): FieldChange[] {
  return diffRecords(parseRecord(event.beforeJson), parseRecord(event.afterJson), ignoredDetailFields)
}

function detailAction(event: AuditEventDto): string {
  const action = (event.action || '').toLowerCase()
  if (action === 'added') return 'Agregó'
  if (action === 'removed') return 'Eliminó'
  return 'Modificó'
}

function occurredAt(event: AuditEventDto): string {
  const date = new Date(event.occurredAt)
  return Number.isNaN(date.getTime()) ? event.occurredAt : date.toLocaleString('es-CR')
}

const history = computed<HistoryGroup[]>(() => {
  const detailEventsByCorrelation = new Map<string, AuditEventDto[]>()
  for (const event of events.value.filter((item) => item.entityType === 'RateDetail')) {
    const key = event.correlationId || event.id
    const bucket = detailEventsByCorrelation.get(key) ?? []
    bucket.push(event)
    detailEventsByCorrelation.set(key, bucket)
  }

  return events.value
    .filter((event) => event.entityType === 'RateHeader')
    .filter((event) => ['updated', 'approved', 'rejected', 'created'].includes((event.action || '').toLowerCase()))
    .map((root) => {
      const action = (root.action || '').toLowerCase()
      const details = action === 'updated' || action === 'created'
        ? detailEventsByCorrelation.get(root.correlationId || root.id) ?? []
        : []

      return {
        id: root.id,
        root,
        details,
      }
    })
    .sort((a, b) => new Date(b.root.occurredAt).getTime() - new Date(a.root.occurredAt).getTime())
})

async function loadHistory() {
  if (!props.rateId) return
  try {
    loading.value = true
    error.value = ''
    events.value = await AuditLogsService.getPricingRateHistory(props.rateId)
  } catch (cause) {
    console.error('[PricingRateHistory] Could not load quotation history.', cause)
    error.value = 'No se pudo cargar el historial de esta cotización.'
  } finally {
    loading.value = false
  }
}

watch(() => props.rateId, loadHistory)
onMounted(loadHistory)
</script>

<template>
  <section class="mt-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
    <div class="flex items-start gap-3">
      <div class="rounded-xl bg-[var(--dh-primary-soft)] p-2 text-[var(--dh-primary)]">
        <History class="h-5 w-5" />
      </div>
      <div>
        <h3 class="text-sm font-black">Historial de la cotización</h3>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Quién aprobó o modificó la cotización, el motivo indicado antes de editar y los cambios realizados.
        </p>
      </div>
    </div>

    <p v-if="loading" class="mt-4 text-xs font-bold text-[var(--dh-text-muted)]">Cargando historial…</p>
    <p v-else-if="error" class="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-300">{{ error }}</p>
    <p v-else-if="history.length === 0" class="mt-4 text-xs font-bold text-[var(--dh-text-muted)]">Todavía no hay aprobaciones o modificaciones auditadas para esta cotización.</p>

    <div v-else class="mt-4 space-y-2">
      <details
        v-for="entry in history"
        :key="entry.id"
        class="group rounded-xl border border-[var(--dh-border)] bg-[var(--dh-bg)] px-3 py-3"
      >
        <summary class="cursor-pointer list-none">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <ShieldCheck v-if="entry.root.action === 'approved'" class="h-4 w-4 shrink-0 text-emerald-500" />
              <PencilLine v-else class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
              <DhBadge :label="actionLabel(entry.root)" :variant="actionVariant(entry.root)" />
              <div class="min-w-0">
                <p class="truncate text-xs font-black">{{ actor(entry.root) }}</p>
                <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">{{ occurredAt(entry.root) }}</p>
              </div>
            </div>
            <span class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Ver detalle</span>
          </div>

          <div v-if="editReason(entry.root)" class="mt-3 flex gap-2 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2">
            <MessageSquareText class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
            <div>
              <p class="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Motivo / mensaje</p>
              <p class="mt-0.5 whitespace-pre-wrap text-xs font-bold">{{ editReason(entry.root) }}</p>
            </div>
          </div>
        </summary>

        <div class="mt-4 space-y-4 border-t border-[var(--dh-border)] pt-4">
          <section v-if="headerChanges(entry.root).length">
            <h4 class="mb-2 flex items-center gap-2 text-xs font-black"><UserRound class="h-4 w-4" />Cambios generales</h4>
            <div class="space-y-2">
              <div
                v-for="change in headerChanges(entry.root)"
                :key="change.field"
                class="grid gap-1 rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs md:grid-cols-[180px_1fr_24px_1fr]"
              >
                <strong>{{ change.label }}</strong>
                <span class="break-words text-[var(--dh-text-muted)]">{{ formatValue(change.before) }}</span>
                <span class="hidden text-center font-black md:block">→</span>
                <span class="break-words font-bold">{{ formatValue(change.after) }}</span>
              </div>
            </div>
          </section>

          <section v-if="entry.details.length">
            <h4 class="mb-2 text-xs font-black">Cambios en rubros / cargos</h4>
            <div class="space-y-2">
              <article v-for="detail in entry.details" :key="detail.id" class="rounded-lg border border-[var(--dh-border)] p-3">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <DhBadge :label="detailAction(detail)" variant="neutral" />
                  <strong>{{ detailName(detail) }}</strong>
                </div>
                <div v-if="detailChanges(detail).length" class="mt-2 space-y-1.5">
                  <div v-for="change in detailChanges(detail)" :key="change.field" class="grid gap-1 text-[11px] md:grid-cols-[150px_1fr_24px_1fr]">
                    <span class="font-black">{{ change.label }}</span>
                    <span class="break-words text-[var(--dh-text-muted)]">{{ formatValue(change.before) }}</span>
                    <span class="hidden text-center font-black md:block">→</span>
                    <span class="break-words font-bold">{{ formatValue(change.after) }}</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <p v-if="!headerChanges(entry.root).length && !entry.details.length" class="text-xs font-semibold text-[var(--dh-text-muted)]">
            El evento quedó auditado sin diferencias de campos adicionales.
          </p>
        </div>
      </details>
    </div>
  </section>
</template>
