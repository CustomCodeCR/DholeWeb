<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { DhButton, DhInput, DhSwitch } from '@/shared/components/atoms'
import { createUuid } from '@/core/utils/id'

const props = defineProps<{
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

interface ContactDirectoryRow {
  id: string
  name: string
  role: string
  email: string
  phone: string
  shipmentModesText: string
  routesText: string
  isPrimary: boolean
  isActive: boolean
}

const contacts = ref<ContactDirectoryRow[]>([])
const syncing = ref(false)

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return []
}

function uniqueList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  )
}

function parseContacts(value?: string | null): ContactDirectoryRow[] {
  if (!value?.trim()) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
      .map((entry) => ({
        id: createUuid(),
        name: text(entry.name),
        role: text(entry.role),
        email: text(entry.email),
        phone: text(entry.phone),
        shipmentModesText: list(entry.shipmentModes ?? entry.modalities).join(', '),
        routesText: list(entry.routes).join(', '),
        isPrimary: bool(entry.isPrimary, false),
        isActive: bool(entry.isActive, true),
      }))
  } catch {
    return []
  }
}

function serializeContacts() {
  const payload = contacts.value.map((contact) => {
    const shipmentModes = uniqueList(contact.shipmentModesText).map((entry) => entry.toUpperCase())
    const routes = uniqueList(contact.routesText)

    return {
      name: contact.name.trim(),
      role: contact.role.trim() || undefined,
      email: contact.email.trim() || undefined,
      phone: contact.phone.trim() || undefined,
      shipmentModes,
      // Se conserva modalities para compatibilidad con consumidores anteriores.
      modalities: shipmentModes,
      routes,
      isPrimary: contact.isPrimary,
      isActive: contact.isActive,
    }
  })

  return JSON.stringify(payload)
}

function addContact() {
  contacts.value.push({
    id: createUuid(),
    name: '',
    role: '',
    email: '',
    phone: '',
    shipmentModesText: '',
    routesText: '',
    isPrimary: contacts.value.length === 0,
    isActive: true,
  })
}

function removeContact(id: string) {
  contacts.value = contacts.value.filter((contact) => contact.id !== id)

  if (contacts.value.length && !contacts.value.some((contact) => contact.isPrimary)) {
    contacts.value[0]!.isPrimary = true
  }
}

function markPrimary(id: string, value: boolean) {
  if (!value) {
    const activePrimaryCount = contacts.value.filter((contact) => contact.isPrimary).length
    if (activePrimaryCount <= 1) return
  }

  contacts.value.forEach((contact) => {
    contact.isPrimary = contact.id === id ? value : false
  })
}

watch(
  () => props.modelValue,
  (value) => {
    const incoming = parseContacts(value)
    const currentComparable = contacts.value.map(({ id: _id, ...contact }) => contact)
    const incomingComparable = incoming.map(({ id: _id, ...contact }) => contact)

    if (JSON.stringify(currentComparable) === JSON.stringify(incomingComparable)) return

    syncing.value = true
    contacts.value = incoming
    queueMicrotask(() => {
      syncing.value = false
    })
  },
  { immediate: true },
)

watch(
  contacts,
  () => {
    if (syncing.value) return
    const value = serializeContacts()
    if (value !== (props.modelValue ?? '')) emit('update:modelValue', value)
  },
  { deep: true },
)
</script>

<template>
  <section class="space-y-3 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">
          Contactos del WHS
        </p>
        <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
          Puede registrar varios contactos y definir cuáles aplican por modalidad FCL/LCL o por ruta.
        </p>
      </div>

      <DhButton :icon="Plus" label="Contacto" size="sm" variant="secondary" @click="addContact" />
    </div>

    <div
      v-if="contacts.length === 0"
      class="rounded-2xl border border-dashed border-[var(--dh-border)] p-4 text-center text-xs font-bold text-[var(--dh-text-muted)]"
    >
      Sin contactos. Agregue el primero para que pueda resolverse automáticamente en el QR y en Pricing.
    </div>

    <article
      v-for="(contact, index) in contacts"
      :key="contact.id"
      class="space-y-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-black text-[var(--dh-text)]">Contacto {{ index + 1 }}</p>
        <button
          type="button"
          class="rounded-xl p-2 text-red-500 transition hover:bg-red-500/10"
          title="Eliminar contacto"
          @click="removeContact(contact.id)"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <DhInput v-model="contact.name" label="Nombre" placeholder="Nombre del contacto" />
        <DhInput v-model="contact.role" label="Cargo / función" placeholder="Ej. Operaciones" />
        <DhInput v-model="contact.email" label="Correo" placeholder="correo@agente.com" />
        <DhInput v-model="contact.phone" label="Teléfono" placeholder="+86 ..." />
        <DhInput
          v-model="contact.shipmentModesText"
          label="Modalidades"
          placeholder="FCL, LCL"
          class="md:col-span-2"
        />
        <DhInput
          v-model="contact.routesText"
          label="Rutas"
          placeholder="QINGDAO>CALDERA, QINGDAO>PANAMA"
          class="md:col-span-2"
        />
      </div>

      <div class="flex flex-wrap gap-5">
        <DhSwitch
          :model-value="contact.isPrimary"
          label="Contacto principal"
          @update:model-value="markPrimary(contact.id, $event)"
        />
        <DhSwitch v-model="contact.isActive" label="Activo" />
      </div>
    </article>
  </section>
</template>
