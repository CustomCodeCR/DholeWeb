<script setup lang="ts">
import { operationsLabel } from '../utils/caseOverview'
import { openingFieldLabel, openingStatusLabel, openingStatusVariant } from '../utils/openingFieldValidation'
import { computed, ref, watch } from 'vue'
import { ShieldCheck, UsersRound, Pencil } from 'lucide-vue-next'
import { DhBadge, DhButton, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhTabs } from '@/shared/components/molecules'
import { useAuthStore } from '@/core/stores/authStore'
import { operationsApi, type ValidationPair, type OpeningCompleteness } from '../services/operationsApi'

const props = defineProps<{ caseId: string; version?: number; canEdit?: boolean }>()
const emit = defineEmits<{ updated: []; approved: [] }>()
const auth = useAuthStore()
const canAssign = computed(() => auth.hasScope('operations.aperture.validation.assign') && auth.hasScope('operations.team.manage'))
const pair = ref<ValidationPair | null>(null)
const completeness = ref<OpeningCompleteness | null>(null)
const group = ref('PENDIENTE_BLOQUEANTE')
const originOnly = new Set(['etm','eta','actualWeight','bookingNumber','blNumber','containerNumber'])
const apertureFields = computed(() => (completeness.value?.fields || []).filter(f => f.completionStatus === 'PENDIENTE_BLOQUEANTE' || !originOnly.has(f.fieldCode)))
const groups = computed(() => (['PENDIENTE_BLOQUEANTE','PENDIENTE_PERMITIDO','CONFIRMADO','NO_APLICA'] as const).map(status => ({key:status,label:openingStatusLabel(status) + ' (' + apertureFields.value.filter(f => f.completionStatus === status).length + ')'})))
const visibleFields = computed(() => apertureFields.value.filter(f => f.completionStatus === group.value))
const myPendingReview = computed(() => pair.value?.validators.some(v => v.canReview === true))
const busy = ref(false)
const error = ref('')
const comment = ref('')
let sequence = 0
async function load() {
  const current = ++sequence
  error.value = ''
  try {
    const [next, fields] = await Promise.all([operationsApi.validations(props.caseId), operationsApi.openingCompleteness(props.caseId)])
    if (sequence === current) { pair.value = next; completeness.value = fields }
  } catch (cause) {
    if (sequence === current) error.value = cause instanceof Error ? cause.message : 'No se pudo obtener la validación.'
  }
}
watch(() => [props.caseId, props.version, auth.userId], () => { pair.value = null; completeness.value = null; void load() }, { immediate: true })
async function assign() {
  if (!canAssign.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await operationsApi.assign(props.caseId)
    await load()
    emit('updated')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo asignar la validación.'
  } finally { busy.value = false }
}
async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
  if (!pair.value?.validators.some(v => v.id === id && v.canReview === true) || busy.value) return
  if (decision === 'APPROVED' && !completeness.value?.canPassFieldValidation) {
    error.value = 'Completa los campos bloqueantes antes de aprobar la apertura.'
    return
  }
  if (decision === 'REJECTED' && !comment.value.trim()) {
    error.value = 'Debe indicar el motivo de devolución.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    await operationsApi.decide(props.caseId, id, decision, comment.value.trim())
    comment.value = ''
    if (decision === 'APPROVED') {
      ++sequence
      pair.value = null
      emit('approved')
      return
    }
    await load()
    emit('updated')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo registrar la decisión.'
  } finally { busy.value = false }
}
function label(status: string) { return operationsLabel(status) }
</script>

<template>
  <DhCard :icon="ShieldCheck" title="Validación de Aperturas" subtitle="Revisa el resumen y la QUO aceptada antes de registrar tu decisión.">
    <p v-if="error" role="alert" class="mb-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-500">{{ error }}</p>
    <div v-if="pair">
      <div v-if="completeness" class="mb-3 space-y-2 rounded-xl border border-[var(--dh-border)] p-3" aria-live="polite">
        <p class="text-sm font-bold">Estados individuales de validación</p>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <DhBadge :variant="completeness.missingFields.length ? 'danger' : 'success'">{{ completeness.missingFields.length ? completeness.missingFields.length + ' campos bloqueantes' : 'Sin bloqueantes' }}</DhBadge>
          <RouterLink v-if="canEdit" :to="{ name: 'operations-case-edit', params: { id: caseId } }"><DhButton size="sm" :icon="Pencil" label="Completar datos de apertura" /></RouterLink>
        </div>
        <DhTabs v-model="group" :items="groups" aria-label="Estados de validación de Aperturas" />
        <div class="max-h-64 overflow-y-auto space-y-2">
        <div v-for="field in visibleFields" :key="field.fieldCode" class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dh-border)] py-2">
          <span class="text-xs font-medium">{{ openingFieldLabel(field.fieldCode) }}</span>
          <DhBadge :variant="openingStatusVariant(field.completionStatus)">{{ openingStatusLabel(field.completionStatus) }}</DhBadge>
        </div>
        <p v-if="!visibleFields.length" class="py-2 text-xs text-[var(--dh-text-muted)]">No hay campos en este estado.</p>
        </div>
      </div>
      <p v-if="myPendingReview" class="mb-3 text-sm font-semibold text-[var(--dh-primary)]">Tienes una validación asignada. Tu aprobación enviará el expediente a Coordinación Origen.</p>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <DhBadge variant="neutral">{{ label(pair.stage.status) }}</DhBadge>
        <DhButton v-if="canAssign && !pair.validators.length && pair.stage.status === 'PENDING_VALIDATION'"
          :icon="UsersRound" label="Asignar operativo" :loading="busy" @click="assign" />
      </div>
      <p v-if="!pair.validators.length" class="text-sm text-[var(--dh-text-muted)]">Pendiente de asignar un operativo autorizado.</p>
      <div v-for="validator in pair.validators" :key="validator.id" class="mb-3 space-y-3 rounded-xl border border-[var(--dh-border)] p-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-bold">Validación de apertura</p>
          <DhBadge :variant="validator.status === 'APPROVED' ? 'success' : validator.status === 'REJECTED' ? 'danger' : 'warning'">{{ label(validator.status) }}</DhBadge>
        </div>
        <p v-if="validator.comment" class="whitespace-pre-wrap text-sm text-[var(--dh-text-soft)]">{{ validator.comment }}</p>
        <div v-if="validator.canReview === true">
          <DhTextarea v-model="comment" label="Observación de validación" :rows="2" />
          <div class="mt-2 flex flex-wrap gap-2">
            <DhButton size="sm" label="Aprobar apertura" :disabled="!completeness?.canPassFieldValidation" :loading="busy" @click="decide(validator.id, 'APPROVED')" />
            <DhButton size="sm" variant="danger" label="Solicitar cambios" :disabled="busy || !comment.trim()" @click="decide(validator.id, 'REJECTED')" />
          </div>
        </div>
      </div>
    </div>
  </DhCard>
</template>
