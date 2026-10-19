<script setup lang="ts">
import { computed, ref } from 'vue'
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import type { RateDto } from '@/core/interfaces/pricing'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

type ModificationAction = 'Add' | 'Change' | 'Remove'
type ModificationItem = { id: number; action: ModificationAction; field: string; details: string }
const props = defineProps<{ rate: RateDto; onSaved?: () => void | Promise<void> }>()
const modal = useModalStore()
const toast = useToastStore()
const priority = ref('Green')
const notes = ref('')
const items = ref<ModificationItem[]>([{ id: 1, action: 'Change', field: '', details: '' }])
const submitting = ref(false)
const attempted = ref(false)
let nextId = 2

const actionOptions = [
  { label: 'Agregar', value: 'Add' },
  { label: 'Modificar', value: 'Change' },
  { label: 'Eliminar', value: 'Remove' },
]
const priorityOptions = [
  { label: 'Verde · Regular (48–72 h)', value: 'Green' },
  { label: 'Amarillo · Prioritario (24–48 h)', value: 'Yellow' },
  { label: 'Rojo · Urgente (0–24 h)', value: 'Red' },
]
const valid = computed(() => items.value.length > 0
  && items.value.every(item => item.field.trim() && item.details.trim())
  && notes.value.length <= 4000)
const concepts = computed(() => [...new Set((props.rate.rateDetails ?? []).map(item => item.name).filter(Boolean))].slice(0, 8).join(', '))

function setAction(item: ModificationItem, value: string | number) {
  if (value === 'Add' || value === 'Change' || value === 'Remove') item.action = value
}
function addItem() {
  if (items.value.length >= 20) return
  items.value.push({ id: nextId++, action: 'Add', field: '', details: '' })
}
async function submit() {
  attempted.value = true
  if (!valid.value || submitting.value) return
  submitting.value = true
  try {
    await callEndpoint<unknown>({
      method: 'POST',
      path: `/api/pricing/seller-rates/${encodeURIComponent(props.rate.id)}/modification-requests`,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, {
      body: {
        priority: priority.value,
        notes: notes.value.trim() || null,
        items: items.value.map(item => ({
          action: item.action,
          field: item.field.trim(),
          details: item.details.trim(),
        })),
      },
    })
    toast.success('Modificación enviada a Pricing', 'Se creó una solicitud vinculada a esta tarifa. Pricing preparará una nueva revisión.')
    modal.close()
    await props.onSaved?.()
  } catch (error) {
    toast.backendError(error, 'No se pudo enviar la solicitud de modificación.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-sm">
      <p class="font-black">{{ rate.quoNumber || rate.rateCode }} · {{ rate.clientName || 'Sin cliente' }}</p>
      <p class="mt-1 text-[var(--dh-text-muted)]">Solicite agregar, cambiar o eliminar conceptos. La cotización y sus importes no se alteran hasta que Pricing revise y guarde una nueva versión.</p>
      <p class="mt-2 font-semibold text-[var(--dh-text-muted)]">Revisión actual: {{ rate.revisionNumber || 1 }}</p>
    </div>
    <DhSelect v-model="priority" label="Prioridad de la solicitud" :options="priorityOptions" />
    <p v-if="concepts" class="text-xs text-[var(--dh-text-muted)]">Conceptos existentes: {{ concepts }}</p>
    <div v-for="(item, index) in items" :key="item.id" class="space-y-3 rounded-2xl border border-[var(--dh-border)] p-4">
      <div class="flex items-center justify-between">
        <strong class="text-sm">Cambio {{ index + 1 }}</strong>
        <DhButton v-if="items.length > 1" type="button" variant="secondary" size="sm" label="Quitar cambio" :disabled="submitting" @click="items.splice(index, 1)" />
      </div>
      <DhSelect :model-value="item.action" label="Acción" :options="actionOptions" @update:model-value="setAction(item, $event)" />
      <DhInput v-model="item.field" label="Concepto o parte de la tarifa" placeholder="Ej.: Flete, ruta, transporte interno, días libres..." :error="attempted && !item.field.trim() ? 'Indique qué se debe cambiar.' : undefined" />
      <DhTextarea v-model="item.details" label="Instrucciones para Pricing" :rows="3" placeholder="Especifique qué agregar, el valor actual y nuevo, o qué eliminar y por qué." :error="attempted && !item.details.trim() ? 'Describa el cambio solicitado.' : undefined" />
    </div>
    <DhButton type="button" variant="secondary" label="Agregar otro cambio" :disabled="submitting || items.length >= 20" @click="addItem" />
    <DhTextarea v-model="notes" label="Observaciones generales (opcional)" :rows="3" placeholder="Información adicional para el operativo de Pricing." :error="attempted && notes.length > 4000 ? 'Máximo 4000 caracteres.' : undefined" />
    <div class="flex justify-end gap-2">
      <DhButton type="button" variant="secondary" label="Cancelar" :disabled="submitting" @click="modal.close()" />
      <DhButton type="submit" label="Enviar solicitud a Pricing" :loading="submitting" />
    </div>
  </form>
</template>
