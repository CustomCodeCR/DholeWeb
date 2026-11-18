<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, FileText, RefreshCw, Upload } from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { useModalStore } from '@/core/stores/modalStore'
import { StorageService, storagePreviewKind } from '@/core/services/storageService'
import type { StorageFileDto } from '@/core/interfaces/storage'
import StorageFileViewer from '@/modules/storage/components/StorageFileViewer.vue'
import CrmFileDropzone from '@/modules/crm/components/CrmFileDropzone.vue'

const props = defineProps<{ supplierId: string; kind: 'credit' | 'tariff'; language?: string }>()
const auth = useAuthStore()
const modal = useModalStore()
const files = ref<StorageFileDto[]>([])
const selectedFiles = ref<File[]>([])
const description = ref('')
const validFrom = ref('')
const validTo = ref('')
const loading = ref(false)
const uploading = ref(false)
const downloading = ref('')
const error = ref('')
const notice = ref('')
let requestSequence = 0
const en = computed(() => props.language === 'en')
const validId = computed(() => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(props.supplierId))
const canRead = computed(() => auth.hasScope('srm.supplier.read') && auth.hasScope('storage.files.view'))
const canDownload = computed(() => canRead.value && auth.hasScope('storage.files.download'))
const canUpload = computed(() => validId.value && auth.hasScope('srm.supplier.update') && auth.hasScope('storage.files.create'))
const entityType = computed(() => props.kind === 'credit' ? 'srm.supplier.credit' : 'srm.supplier.tariff')
const isTariff = computed(() => props.kind === 'tariff')
function detail(file: StorageFileDto) {
  if (!file.metadataJson) return ''
  try {
    const data = JSON.parse(file.metadataJson) as { description?: string; validFrom?: string; validTo?: string }
    return [data.description, data.validFrom && ('Desde ' + data.validFrom), data.validTo && ('Hasta ' + data.validTo)]
      .filter(Boolean).join(' · ')
  } catch { return '' }
}
function filePreviewable(file: StorageFileDto) {
  return ['image', 'pdf', 'text'].includes(storagePreviewKind({
    id: file.id, fileName: file.originalFileName, extension: file.extension, contentType: file.contentType,
  }))
}
function preview(file: StorageFileDto) {
  if (!canDownload.value || !filePreviewable(file)) return
  modal.open({
    title: file.originalFileName, component: StorageFileViewer, size: 'xl',
    props: { id: file.id, fileName: file.originalFileName, contentType: file.contentType,
      extension: file.extension, sizeInBytes: file.sizeInBytes },
  })
}
async function download(file: StorageFileDto) {
  if (!canDownload.value || downloading.value) return
  downloading.value = file.id
  error.value = ''
  try { await StorageService.downloadFile({ id: file.id, fileName: file.originalFileName }) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Error al descargar.' }
  finally { downloading.value = '' }
}
async function refresh() {
  const sequence = ++requestSequence
  files.value = []
  error.value = ''
  if (!validId.value || !canRead.value) return
  loading.value = true
  try {
    const response = await StorageService.getFilesByEntity('DholeConfigService', entityType.value, props.supplierId)
    if (sequence === requestSequence) files.value = response
  } catch (cause) {
    if (sequence === requestSequence) error.value = cause instanceof Error ? cause.message : 'Error al consultar documentos.'
  } finally { if (sequence === requestSequence) loading.value = false }
}
async function upload() {
  if (!canUpload.value || uploading.value || !selectedFiles.value.length) return
  if (validFrom.value && validTo.value && validFrom.value > validTo.value) {
    error.value = 'La fecha de inicio de la tarifa no puede superar su vencimiento.'
    return
  }
  const extensionAllowed = /\.(pdf|png|jpe?g|webp|gif|docx?|xlsx?|xls|csv|txt)$/i
  if (selectedFiles.value.some(file => !extensionAllowed.test(file.name) || file.size === 0 || file.size > 100 * 1024 * 1024)) {
    error.value = 'Usá documentos o imágenes PDF, JPG, PNG, WEBP, Word, Excel, CSV o TXT (máximo 100 MB).'
    return
  }
  const targetId = props.supplierId
  const targetEntity = entityType.value
  uploading.value = true
  error.value = ''
  notice.value = ''
  try {
    for (const file of [...selectedFiles.value]) {
      await StorageService.uploadFile({
        file, sourceService: 'DholeConfigService', entityType: targetEntity, entityId: targetId,
        metadataJson: JSON.stringify({
          description: description.value.trim().slice(0, 500),
          validFrom: isTariff.value ? validFrom.value || null : null,
          validTo: isTariff.value ? validTo.value || null : null,
        }),
      })
      selectedFiles.value = selectedFiles.value.filter(row => row !== file)
    }
    description.value = ''
    validFrom.value = ''
    validTo.value = ''
    if (targetId === props.supplierId && targetEntity === entityType.value) {
      await refresh()
      notice.value = en.value ? 'Files attached successfully.' : 'Archivos adjuntados correctamente.'
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Error al adjuntar archivos.' }
  finally { uploading.value = false }
}
watch(() => [props.supplierId, props.kind, canRead.value], () => {
  selectedFiles.value = []
  notice.value = ''
  void refresh()
}, { immediate: true })
</script>

<template>
  <section class="space-y-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" :data-srm-supplier-files="kind">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="flex items-center gap-2 text-sm font-extrabold">
          <FileText class="h-4 w-4 text-[var(--dh-primary)]" />
          {{ isTariff ? (en ? 'Agreed supplier tariffs' : 'Tarifas acordadas con el proveedor') :
            (en ? 'Credit supporting documents' : 'Documentos de respaldo de crédito') }}
          ({{ files.length }})
        </h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          {{ isTariff ? (en ? 'Attach rate sheets, images, conditions and validity.' : 'Tarifarios, imágenes, acuerdos, condiciones y vigencias.') :
            (en ? 'Credit applications, approvals, contracts and supporting documents.' : 'Solicitudes, aprobaciones, contratos y respaldos del crédito.') }}
        </p>
      </div>
      <button v-if="canRead && validId" type="button" :disabled="loading || uploading"
        class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold"
        @click="refresh"><RefreshCw class="mr-1 inline h-3.5 w-3.5" />{{ en ? 'Refresh' : 'Actualizar' }}</button>
    </div>
    <p v-if="!validId" class="text-xs text-[var(--dh-text-muted)]">
      {{ en ? 'Save the supplier before attaching files.' : 'Guardá primero el proveedor para adjuntar archivos.' }}
    </p>
    <p v-else-if="!canRead" class="text-xs text-[var(--dh-text-muted)]">
      {{ en ? 'Storage read permission is required.' : 'Se requiere el permiso storage.files.view para consultar archivos.' }}
    </p>
    <p v-if="error" role="alert" class="text-xs text-red-400">{{ error }}</p>
    <p v-if="notice" role="status" class="text-xs text-emerald-500">{{ notice }}</p>
    <p v-if="loading" class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'Loading attachments...' : 'Cargando adjuntos...' }}</p>
    <ul v-else-if="files.length" class="space-y-2">
      <li v-for="file in files" :key="file.id" class="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--dh-border)] p-3">
        <FileText class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
        <div class="min-w-0 flex-1">
          <p class="break-all text-xs font-bold">{{ file.originalFileName }}</p>
          <p class="text-[11px] text-[var(--dh-text-muted)]">{{ new Date(file.createdAt).toLocaleDateString(en ? 'en-US' : 'es-CR') }} · {{ Math.ceil(file.sizeInBytes / 1024) }} KB</p>
          <p v-if="detail(file)" class="mt-1 break-words text-[11px]">{{ detail(file) }}</p>
        </div>
        <button v-if="canDownload && filePreviewable(file)" type="button"
          class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold" @click="preview(file)">
          {{ en ? 'View' : 'Ver' }}
        </button>
        <button v-if="canDownload" type="button" :disabled="Boolean(downloading)"
          class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold" @click="download(file)">
          <Download class="mr-1 inline h-3.5 w-3.5" />{{ en ? 'Download' : 'Descargar' }}
        </button>
      </li>
    </ul>
    <p v-else-if="canRead && validId && !error" class="text-xs text-[var(--dh-text-muted)]">
      {{ en ? 'No attachments registered.' : 'Sin archivos registrados.' }}
    </p>
    <div v-if="canUpload" class="space-y-3 border-t border-[var(--dh-border)] pt-3">
      <label class="block text-xs font-semibold">{{ en ? 'Description (optional)' : 'Descripción (opcional)' }}
        <input v-model="description" maxlength="500" class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-3" />
      </label>
      <div v-if="isTariff" class="grid gap-3 sm:grid-cols-2">
        <label class="text-xs font-semibold">{{ en ? 'Valid from (optional)' : 'Válida desde (opcional)' }}
          <input v-model="validFrom" type="date" class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-3" />
        </label>
        <label class="text-xs font-semibold">{{ en ? 'Valid to (optional)' : 'Válida hasta (opcional)' }}
          <input v-model="validTo" type="date" class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-3" />
        </label>
      </div>
      <CrmFileDropzone v-model="selectedFiles" :disabled="uploading" :label="isTariff ? 'Adjuntar tarifarios o imágenes' : 'Adjuntar documentos de crédito'" />
      <button type="button" :disabled="uploading || !selectedFiles.length"
        class="inline-flex items-center gap-2 rounded-lg bg-[var(--dh-primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        @click="upload"><Upload class="h-4 w-4" />{{ uploading ? (en ? 'Uploading...' : 'Adjuntando...') : (en ? 'Save attachments' : 'Guardar adjuntos') }}</button>
    </div>
  </section>
</template>
