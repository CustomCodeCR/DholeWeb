<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, FileText, Paperclip, RefreshCw, Upload } from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { StorageService, storagePreviewKind } from '@/core/services/storageService'
import type { StorageFileDto } from '@/core/interfaces/storage'
import { useModalStore } from '@/core/stores/modalStore'
import StorageFileViewer from '@/modules/storage/components/StorageFileViewer.vue'
import { crmPath, crmRequest, crmError } from '../services/crmApi'
import CrmFileDropzone from './CrmFileDropzone.vue'

type CrmDocumentKind = 'account' | 'lead' | 'contact' | 'activity' | 'followup' | 'procedure'
const props = defineProps<{ kind: CrmDocumentKind; recordId: string }>()
const auth = useAuthStore()
const modal = useModalStore()
const files = ref<StorageFileDto[]>([])
const selectedFiles = ref<File[]>([])
const loading = ref(false)
const uploading = ref(false)
const uploadProgress = ref({ done: 0, total: 0 })
const downloading = ref('')
const error = ref('')
const notice = ref('')
const recordMayUpload = ref(false)
let refreshSequence = 0
const canView = computed(() => auth.hasScope('storage.files.view'))
const canDownload = computed(() => auth.hasScope('storage.files.download'))
const canUpload = computed(() => recordMayUpload.value && auth.hasScope('storage.files.create'))
const validRecord = computed(() => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(props.recordId))
const entityType = computed(() => 'crm.' + props.kind)

function fileSize(bytes: number): string {
  return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB'
    : Math.max(1, Math.ceil(bytes / 1024)) + ' KB'
}
async function refresh() {
  const sequence = ++refreshSequence
  const recordId = props.recordId
  const kind = props.kind
  files.value = []
  recordMayUpload.value = false
  notice.value = ''
  error.value = ''
  if (!validRecord.value) return
  loading.value = true
  try {
    const access = await crmRequest<{ canUpload: boolean }>(
      crmPath('documents/' + kind, recordId, 'access'))
    if (sequence !== refreshSequence) return
    recordMayUpload.value = access.canUpload === true
    if (!canView.value) {
      error.value = 'Para consultar los documentos necesitás el permiso storage.files.view.'
      return
    }
    const found = await StorageService.getFilesByEntity('DholeCRMService', 'crm.' + kind, recordId)
    if (sequence === refreshSequence) files.value = found
  } catch (cause) {
    if (sequence === refreshSequence) error.value = crmError(cause)
  } finally {
    if (sequence === refreshSequence) loading.value = false
  }
}
async function upload() {
  if (!canUpload.value || !validRecord.value || uploading.value || !selectedFiles.value.length) return
  uploading.value = true
  uploadProgress.value = { done: 0, total: selectedFiles.value.length }
  error.value = ''
  notice.value = ''
  try {
    // Recheck authorization at save time, not only when the panel was opened.
    const access = await crmRequest<{ canUpload: boolean }>(
      crmPath('documents/' + props.kind, props.recordId, 'access'))
    if (!access.canUpload) throw new Error('No tenés autorización para adjuntar documentos a este registro.')
    for (const file of [...selectedFiles.value]) {
      if (file.size > 100 * 1024 * 1024)
        throw new Error('El archivo ' + file.name + ' excede el límite de 100 MB.')
      await StorageService.uploadFile({
        file, sourceService: 'DholeCRMService', entityType: entityType.value,
        entityId: props.recordId,
      })
      selectedFiles.value = selectedFiles.value.filter(item => item !== file)
      uploadProgress.value.done++
    }
    await refresh()
    notice.value = 'Documentos adjuntados correctamente.'
  } catch (cause) { error.value = crmError(cause) }
  finally { uploading.value = false }
}
function canPreview(file: StorageFileDto): boolean {
  const kind = storagePreviewKind({
    id: file.id, fileName: file.originalFileName,
    contentType: file.contentType, extension: file.extension,
  })
  return kind === 'pdf' || kind === 'image' || kind === 'text'
}
function preview(file: StorageFileDto) {
  if (!canDownload.value || !canPreview(file)) return
  modal.open({
    title: file.originalFileName,
    component: StorageFileViewer,
    size: 'xl',
    props: {
      id: file.id, fileName: file.originalFileName,
      contentType: file.contentType, extension: file.extension, sizeInBytes: file.sizeInBytes,
    },
  })
}
async function download(file: StorageFileDto) {
  if (!canDownload.value || downloading.value) return
  downloading.value = file.id
  error.value = ''
  try { await StorageService.downloadFile({ id: file.id, fileName: file.originalFileName }) }
  catch (cause) { error.value = crmError(cause) }
  finally { downloading.value = '' }
}
watch(() => [props.kind, props.recordId], () => void refresh(), { immediate: true })
</script>

<template>
  <section class="space-y-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5"
    data-crm-documents>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="flex items-center gap-2 text-sm font-extrabold"><Paperclip class="h-4 w-4 text-[var(--dh-primary)]" />Documentos adjuntos ({{ files.length }})</h2>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Archivos asociados únicamente a este registro del CRM.</p>
      </div>
      <button type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-bold"
        :disabled="loading || uploading" @click="refresh"><RefreshCw class="mr-1 inline h-3.5 w-3.5" />Actualizar</button>
    </div>
    <p v-if="error" role="alert" class="text-xs text-red-500">{{ error }}</p>
    <p v-if="notice" role="status" class="text-xs text-emerald-500">{{ notice }}</p>
    <p v-if="loading" class="text-xs text-[var(--dh-text-muted)]">Consultando documentos…</p>
    <ul v-else-if="files.length" class="space-y-2">
      <li v-for="file in files" :key="file.id"
        class="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
        <FileText class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
        <div class="min-w-0 flex-1">
          <p class="break-all text-xs font-bold">{{ file.originalFileName }}</p>
          <p class="text-[11px] text-[var(--dh-text-muted)]">
            {{ fileSize(file.sizeInBytes) }} · {{ new Date(file.createdAt).toLocaleDateString('es-CR') }}
          </p>
        </div>
        <button v-if="canDownload && canPreview(file)" type="button"
          class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold"
          :disabled="Boolean(downloading)" @click="preview(file)">
          Ver
        </button>
        <button v-if="canDownload" type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold"
          :disabled="Boolean(downloading)" @click="download(file)">
          <Download class="mr-1 inline h-3.5 w-3.5" />Descargar
        </button>
      </li>
    </ul>
    <p v-else-if="canView && !error" class="text-xs text-[var(--dh-text-muted)]">Todavía no hay documentos adjuntos.</p>
    <div v-if="canUpload" class="space-y-2 border-t border-[var(--dh-border)] pt-4">
      <CrmFileDropzone v-model="selectedFiles" :disabled="uploading" label="Adjuntar documentos" />
      <p v-if="uploading" role="status" class="text-xs text-[var(--dh-text-muted)]">
        Subiendo {{ uploadProgress.done }} de {{ uploadProgress.total }} documentos…
      </p>
      <button type="button" class="inline-flex items-center gap-2 rounded-lg bg-[var(--dh-primary)] px-4 py-2 text-xs font-bold text-white"
        :disabled="uploading || !selectedFiles.length" @click="upload">
        <Upload class="h-3.5 w-3.5" />{{ uploading ? 'Adjuntando…' : 'Guardar documentos' }}
      </button>
    </div>
    <p v-else-if="!loading && canView" class="text-xs text-[var(--dh-text-muted)]">
      Para adjuntar documentos necesitás permisos de edición del registro y storage.files.create.
    </p>
  </section>
</template>
