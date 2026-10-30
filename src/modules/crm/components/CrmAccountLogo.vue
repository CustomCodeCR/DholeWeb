<script setup lang="ts">
import { computed, ref } from 'vue'
import { Camera, Trash2 } from 'lucide-vue-next'
import { StorageService } from '@/core/services/storageService'
import DhStorageImage from '@/shared/components/DhStorageImage.vue'
import { useAuthStore } from '@/core/stores/authStore'
import { crmError, crmPath, crmRequest, type CrmRow } from '../services/crmApi'

const props = defineProps<{ account: CrmRow }>()
const emit = defineEmits<{ (e: 'updated'): void }>()
const auth = useAuthStore()
const canEdit = computed(() => auth.hasScope('crm.account.update'))
const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref('')
const initials = computed(() =>
  String(props.account.displayName || props.account.legalName || 'Empresa')
    .trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() || '').join(''))
const logoId = computed(() => String(props.account.logoFileId ?? '').trim())

async function updateLogo(id: string | null) {
  await crmRequest(crmPath('accounts', String(props.account.id), 'logo'),
    'PATCH', { expectedVersion: props.account.rowVersion, logoFileId: id })
  emit('updated')
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.item(0)
  if (!file || !canEdit.value || busy.value) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    error.value = 'Usá PNG, JPG o WEBP de máximo 2 MB.'
    input.value = ''
    return
  }
  busy.value = true
  error.value = ''
  try {
    const stored = await StorageService.uploadFile({
      file, sourceService: 'DholeCRM', entityType: 'CrmAccount', entityId: String(props.account.id),
      metadataJson: JSON.stringify({ kind: 'account-logo' }),
    })
    await updateLogo(stored.id)
  } catch (cause) { error.value = crmError(cause) }
  finally { busy.value = false; input.value = '' }
}
async function remove() {
  if (busy.value || !logoId.value || !canEdit.value) return
  busy.value = true
  error.value = ''
  try { await updateLogo(null) }
  catch (cause) { error.value = crmError(cause) }
  finally { busy.value = false }
}
</script>

<template>
  <div class="relative shrink-0" data-crm-account-logo>
    <div class="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-shell)] text-lg font-extrabold text-[var(--dh-primary)] sm:h-16 sm:w-16">
      <DhStorageImage v-if="logoId" :file-id="logoId" :alt="'Logo de ' + (account.displayName || account.legalName)"
        class="h-full w-full !rounded-none !border-0" />
      <span v-else>{{ initials }}</span>
    </div>
    <div v-if="canEdit" class="absolute -bottom-2 -right-2 flex items-center gap-1">
      <button type="button" class="grid h-8 w-8 place-items-center rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-sm hover:text-[var(--dh-primary)]"
        :disabled="busy" title="Agregar o cambiar logo" aria-label="Agregar o cambiar logo"
        @click="fileInput?.click()">
        <Camera class="h-4 w-4" />
      </button>
      <button v-if="logoId" type="button" class="grid h-8 w-8 place-items-center rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-sm"
        :disabled="busy" title="Quitar logo" aria-label="Quitar logo" @click="remove"><Trash2 class="h-4 w-4" /></button>
    </div>
    <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="sr-only"
      aria-label="Seleccionar imagen del logo" @change="upload" />
    <p v-if="busy" role="status" class="absolute top-full mt-2 w-32 text-xs text-[var(--dh-text-muted)]">Guardando logo…</p>
    <p v-if="error" role="alert" class="absolute top-full z-30 mt-2 w-64 rounded-lg border border-red-500/30 bg-[var(--dh-card)] p-2 text-xs text-red-500">{{ error }}</p>
  </div>
</template>
