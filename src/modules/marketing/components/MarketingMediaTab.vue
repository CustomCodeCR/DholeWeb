<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { File, FileImage, Plus, Save, Search, Trash2, Upload } from 'lucide-vue-next'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { ContentService } from '@/core/services/contentService'
import type { MediaDto } from '@/core/interfaces/content'

const authStore = useAuthStore()
const toastStore = useToastStore()
const loading = ref(false)
const uploading = ref(false)
const items = ref<MediaDto[]>([])
const search = ref('')
const selected = ref<MediaDto | null>(null)
const file = ref<File | null>(null)
const altText = ref('')
const caption = ref('')
const dragActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const canUpload = () => authStore.hasScope(CONTENT_SCOPES.media.upload)
const canEdit = () => authStore.hasScope(CONTENT_SCOPES.edit)
const canDelete = () => authStore.hasScope(CONTENT_SCOPES.media.delete)

async function load() {
  loading.value = true
  try {
    const response = await ContentService.browseMedia({
      pageNumber: 1,
      pageSize: 150,
      search: search.value.trim() || undefined,
    })
    items.value = response.items
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la biblioteca multimedia.')
  } finally {
    loading.value = false
  }
}

function select(item: MediaDto) {
  selected.value = item
  file.value = null
  altText.value = item.altText ?? ''
  caption.value = item.caption ?? ''
}

function clearEditor() {
  selected.value = null
  file.value = null
  altText.value = ''
  caption.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

function chooseFile() {
  if (canUpload()) fileInput.value?.click()
}

function setFile(nextFile?: File | null) {
  file.value = nextFile ?? null
  if (nextFile) {
    selected.value = null
    if (!altText.value) altText.value = nextFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
  }
}

function handleInput(event: Event) {
  setFile((event.target as HTMLInputElement).files?.[0])
}

function handleDrop(event: DragEvent) {
  dragActive.value = false
  if (!canUpload()) return
  setFile(event.dataTransfer?.files?.[0])
}

function readableType(contentType: string) {
  if (contentType.startsWith('image/')) return 'Imagen'
  if (contentType === 'application/pdf') return 'PDF'
  if (contentType.startsWith('video/')) return 'Video'
  return 'Archivo'
}

async function upload() {
  if (!file.value || !canUpload() || uploading.value) return
  uploading.value = true
  try {
    await ContentService.uploadMedia(file.value, altText.value, caption.value)
    toastStore.success('Archivo agregado a Multimedia')
    clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo subir el archivo.')
  } finally {
    uploading.value = false
  }
}

async function saveDetails() {
  if (!selected.value || !canEdit() || uploading.value) return
  uploading.value = true
  try {
    await ContentService.updateMedia(selected.value.id, {
      altText: altText.value.trim() || null,
      caption: caption.value.trim() || null,
      metadataJson: selected.value.metadataJson ?? null,
    })
    toastStore.success('Detalles actualizados')
    clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron guardar los detalles.')
  } finally {
    uploading.value = false
  }
}

async function remove(item: MediaDto) {
  if (!canDelete() || !window.confirm(`¿Eliminar “${item.fileName}”?`)) return
  try {
    await ContentService.deleteMedia(item.id)
    toastStore.success('Archivo eliminado')
    if (selected.value?.id === item.id) clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar el archivo.')
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="space-y-5">
    <section class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-2xl font-black">Multimedia</h2>
          <p class="mt-1 text-sm opacity-60">Imágenes, documentos y videos usados en el sitio.</p>
        </div>
        <button v-if="canUpload()" class="primary-action" @click="clearEditor(); chooseFile()">
          <Plus class="h-4 w-4" /> Agregar archivo
        </button>
      </div>

      <div class="mt-5 flex gap-2">
        <label class="relative flex-1">
          <Search class="pointer-events-none absolute left-3 top-3.5 h-4 w-4 opacity-45" />
          <input v-model="search" class="field w-full pl-10" placeholder="Buscar en Multimedia…" @keyup.enter="load" />
        </label>
        <button class="secondary-action" @click="load">Buscar</button>
      </div>

      <div class="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <div v-if="loading" class="col-span-full p-10 text-center text-sm opacity-60">Cargando archivos…</div>
        <div
          v-for="item in items"
          v-else
          :key="item.id"
          class="media-card"
          :class="{ 'media-card-active': selected?.id === item.id }"
        >
          <button class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="select(item)">
            <span class="file-icon">
              <FileImage v-if="item.contentType.startsWith('image/')" class="h-5 w-5" />
              <File v-else class="h-5 w-5" />
            </span>
            <span class="min-w-0">
              <strong class="block truncate text-sm">{{ item.fileName }}</strong>
              <span class="mt-1 block text-xs opacity-50">{{ readableType(item.contentType) }}</span>
            </span>
          </button>
          <button
            v-if="canDelete()"
            class="delete-button"
            title="Eliminar"
            @click="remove(item)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
        <div v-if="!loading && !items.length" class="col-span-full p-10 text-center text-sm opacity-60">
          No hay archivos todavía.
        </div>
      </div>
    </section>

    <section class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 class="text-xl font-black">{{ selected ? 'Detalles del archivo' : 'Subir archivo' }}</h3>
          <p class="mt-1 text-sm opacity-60">
            {{ selected ? selected.fileName : 'Arrastre un archivo aquí o selecciónelo desde su equipo.' }}
          </p>
        </div>
        <button v-if="selected" class="secondary-action" @click="clearEditor">
          <Upload class="h-4 w-4" /> Subir otro
        </button>
      </div>

      <input ref="fileInput" class="hidden" type="file" @change="handleInput" />

      <button
        v-if="!selected && canUpload()"
        type="button"
        class="drop-zone mt-5"
        :class="{ 'drop-zone-active': dragActive }"
        @click="chooseFile"
        @dragenter.prevent="dragActive = true"
        @dragover.prevent="dragActive = true"
        @dragleave.prevent="dragActive = false"
        @drop.prevent="handleDrop"
      >
        <Upload class="h-8 w-8 text-[var(--dh-primary)]" />
        <strong class="mt-3">{{ file ? file.name : 'Arrastre un archivo o haga clic para seleccionar' }}</strong>
        <span class="mt-1 text-xs opacity-50">Imágenes, PDF, videos y otros formatos permitidos.</span>
      </button>

      <div class="mt-5 grid gap-4 lg:grid-cols-2">
        <label class="label">
          Texto alternativo
          <input v-model="altText" class="field mt-2 w-full" placeholder="Describa brevemente la imagen" />
        </label>
        <label class="label">
          Descripción
          <textarea v-model="caption" class="field mt-2 min-h-24 w-full" placeholder="Descripción opcional" />
        </label>
      </div>

      <div class="mt-5 flex gap-2">
        <button v-if="!selected && canUpload()" class="primary-action" :disabled="!file || uploading" @click="upload">
          <Upload class="h-4 w-4" /> Subir archivo
        </button>
        <button v-if="selected && canEdit()" class="primary-action" :disabled="uploading" @click="saveDetails">
          <Save class="h-4 w-4" /> Guardar cambios
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:12px;background:color-mix(in srgb,var(--dh-surface) 88%,transparent);padding:.7rem .8rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}.label{display:block;font-size:.8rem;font-weight:800}.primary-action,.secondary-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:12px;padding:.68rem .9rem;font-size:.8rem;font-weight:800;transition:160ms}.primary-action{background:var(--dh-primary);color:#fff}.secondary-action:hover{background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.primary-action:disabled{opacity:.4}.media-card{display:flex;align-items:center;gap:.5rem;border:1px solid var(--dh-border);border-radius:16px;padding:.75rem;transition:160ms}.media-card:hover,.media-card-active{border-color:color-mix(in srgb,var(--dh-primary) 55%,var(--dh-border));background:color-mix(in srgb,var(--dh-primary) 5%,transparent)}.file-icon{display:grid;height:42px;width:42px;flex:none;place-items:center;border-radius:12px;background:color-mix(in srgb,var(--dh-primary) 10%,transparent);color:var(--dh-primary)}.delete-button{display:grid;height:34px;width:34px;flex:none;place-items:center;border-radius:10px;color:#dc2626;transition:150ms}.delete-button:hover{background:rgb(239 68 68 / .1)}.drop-zone{display:flex;width:100%;min-height:180px;flex-direction:column;align-items:center;justify-content:center;border:2px dashed var(--dh-border);border-radius:18px;padding:1.5rem;text-align:center;transition:160ms}.drop-zone:hover,.drop-zone-active{border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 5%,transparent)}
</style>
