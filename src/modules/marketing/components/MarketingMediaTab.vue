<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Save, Search, Trash2, Upload } from 'lucide-vue-next'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { ContentService } from '@/core/services/contentService'
import type { MediaDto } from '@/core/interfaces/content'

const authStore = useAuthStore()
const toastStore = useToastStore()
const loading = ref(false)
const items = ref<MediaDto[]>([])
const search = ref('')
const selected = ref<MediaDto | null>(null)
const file = ref<File | null>(null)
const altText = ref('')
const caption = ref('')
const metadataJson = ref('')

const canUpload = () => authStore.hasScope(CONTENT_SCOPES.media.upload)
const canEdit = () => authStore.hasScope(CONTENT_SCOPES.edit)
const canDelete = () => authStore.hasScope(CONTENT_SCOPES.media.delete)

function validateMetadata() {
  if (!metadataJson.value.trim()) return true
  try {
    JSON.parse(metadataJson.value)
    return true
  } catch {
    toastStore.warning('JSON inválido', 'La metadata debe ser JSON válido.')
    return false
  }
}

async function load() {
  loading.value = true
  try {
    const response = await ContentService.browseMedia({ pageNumber: 1, pageSize: 100, search: search.value || undefined })
    items.value = response.items
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los medios.')
  } finally {
    loading.value = false
  }
}

function select(item: MediaDto) {
  selected.value = item
  altText.value = item.altText ?? ''
  caption.value = item.caption ?? ''
  metadataJson.value = item.metadataJson ?? ''
}

function clearEditor() {
  selected.value = null
  file.value = null
  altText.value = ''
  caption.value = ''
  metadataJson.value = ''
}

async function upload() {
  if (!file.value || !canUpload() || !validateMetadata()) return
  try {
    await ContentService.uploadMedia(file.value, altText.value, caption.value, metadataJson.value)
    toastStore.success('Archivo cargado')
    clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el archivo.')
  }
}

async function saveMetadata() {
  if (!selected.value || !canEdit() || !validateMetadata()) return
  try {
    await ContentService.updateMedia(selected.value.id, {
      altText: altText.value || null,
      caption: caption.value || null,
      metadataJson: metadataJson.value || null,
    })
    toastStore.success('Metadata actualizada')
    clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo actualizar el medio.')
  }
}

async function remove(item: MediaDto) {
  if (!canDelete() || !window.confirm(`¿Eliminar “${item.fileName}”?`)) return
  try {
    await ContentService.deleteMedia(item.id)
    toastStore.success('Medio eliminado')
    if (selected.value?.id === item.id) clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar el medio.')
  }
}

onMounted(() => void load())
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div><h2 class="text-xl font-black">Biblioteca de medios</h2><p class="text-sm opacity-60">Carga real hacia Storage mediante ContentService.</p></div>
      <div class="mt-4 flex gap-2"><input v-model="search" class="field flex-1" placeholder="Buscar archivo" @keyup.enter="load" /><button class="action" @click="load"><Search class="h-4 w-4" /> Buscar</button></div>
      <div class="mt-4 space-y-2">
        <div v-if="loading" class="p-8 text-center text-sm opacity-60">Cargando medios…</div>
        <button v-for="item in items" v-else :key="item.id" class="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] p-3 text-left transition hover:bg-black/[.03] dark:hover:bg-white/[.04]" @click="select(item)">
          <div class="min-w-0"><p class="truncate font-bold">{{ item.fileName }}</p><p class="truncate text-xs opacity-50">{{ item.contentType }} · {{ item.storageFileId }}</p><p v-if="item.altText" class="mt-1 truncate text-xs opacity-70">ALT: {{ item.altText }}</p></div>
          <button v-if="canDelete()" class="rounded-xl p-2 text-red-500 hover:bg-red-500/10" title="Eliminar" @click.stop="remove(item)"><Trash2 class="h-4 w-4" /></button>
        </button>
        <div v-if="!loading && !items.length" class="p-10 text-center text-sm opacity-60">No hay medios registrados.</div>
      </div>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex items-center justify-between gap-3"><div><h2 class="text-xl font-black">{{ selected ? 'Editar metadata' : 'Subir archivo' }}</h2><p class="text-sm opacity-60">{{ selected ? selected.fileName : 'Imagen, PDF u otro archivo permitido por Storage.' }}</p></div><button v-if="selected" class="action" @click="clearEditor">Nuevo</button></div>
      <div class="mt-5 space-y-3">
        <input v-if="!selected && canUpload()" class="field w-full" type="file" @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null" />
        <label class="label">Texto alternativo<input v-model="altText" class="field w-full" /></label>
        <label class="label">Caption<textarea v-model="caption" class="field min-h-20 w-full" /></label>
        <label class="label">Metadata JSON<textarea v-model="metadataJson" class="field min-h-32 w-full font-mono text-xs" spellcheck="false" placeholder="{}" /></label>
        <button v-if="!selected && canUpload()" class="primary-action" :disabled="!file" @click="upload"><Upload class="h-4 w-4" /> Subir archivo</button>
        <button v-if="selected && canEdit()" class="primary-action" @click="saveMetadata"><Save class="h-4 w-4" /> Guardar metadata</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:14px;background:color-mix(in srgb,var(--dh-surface) 86%,transparent);padding:.7rem .85rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 14%,transparent)}.label{display:block;font-size:.8rem;font-weight:800}.action,.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border-radius:14px;padding:.65rem .85rem;font-size:.8rem;font-weight:800;transition:160ms}.action:hover{background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.primary-action{background:var(--dh-primary);color:#fff}.primary-action:disabled{opacity:.4}
</style>
