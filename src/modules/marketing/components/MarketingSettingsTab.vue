<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { Plus, Save, Trash2 } from 'lucide-vue-next'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { ContentService } from '@/core/services/contentService'
import type { SiteSettingDto } from '@/core/interfaces/content'

const props = defineProps<{ siteKey: string }>()
const authStore = useAuthStore()
const toastStore = useToastStore()
const loading = ref(false)
const items = ref<SiteSettingDto[]>([])
const editingId = ref<string | null>(null)
const form = reactive({ key: '', valueJson: '{}', isPublic: false })

const canEdit = () => authStore.hasScope(CONTENT_SCOPES.settings.edit)

async function load() {
  loading.value = true
  try {
    items.value = await ContentService.getSettings(props.siteKey || 'main')
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los ajustes del sitio.')
  } finally {
    loading.value = false
  }
}

function edit(item?: SiteSettingDto) {
  editingId.value = item?.id ?? null
  form.key = item?.key ?? ''
  form.valueJson = item?.valueJson ?? '{}'
  form.isPublic = item?.isPublic ?? false
}

function validJson() {
  try {
    JSON.parse(form.valueJson)
    return true
  } catch {
    toastStore.warning('JSON inválido', 'El valor del ajuste debe ser JSON válido.')
    return false
  }
}

async function save() {
  if (!canEdit() || !form.key.trim() || !validJson()) return
  try {
    await ContentService.upsertSetting(form.key.trim(), {
      key: form.key.trim(),
      valueJson: form.valueJson.trim(),
      isPublic: form.isPublic,
      siteKey: props.siteKey || 'main',
    })
    toastStore.success('Ajuste guardado')
    edit()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el ajuste.')
  }
}

async function remove(item: SiteSettingDto) {
  if (!canEdit() || !window.confirm(`¿Eliminar el ajuste “${item.key}”?`)) return
  try {
    await ContentService.deleteSetting(item.id)
    toastStore.success('Ajuste eliminado')
    if (editingId.value === item.id) edit()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar el ajuste.')
  }
}

watch(() => props.siteKey, () => void load())
onMounted(() => void load())
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div><h2 class="text-xl font-black">Ajustes del sitio</h2><p class="text-sm opacity-60">Valores JSON públicos o internos para {{ siteKey || 'main' }}.</p></div>
      <div class="mt-4 space-y-2">
        <div v-if="loading" class="p-8 text-center text-sm opacity-60">Cargando ajustes…</div>
        <div v-for="item in items" v-else :key="item.id" class="flex items-start justify-between gap-3 rounded-2xl border border-[var(--dh-border)] p-3">
          <button class="min-w-0 flex-1 text-left" @click="edit(item)"><div class="flex flex-wrap items-center gap-2"><strong>{{ item.key }}</strong><span class="rounded-full px-2 py-1 text-[10px] font-black" :class="item.isPublic ? 'bg-emerald-500/10 text-emerald-600' : 'bg-black/5 dark:bg-white/10'">{{ item.isPublic ? 'PÚBLICO' : 'INTERNO' }}</span></div><pre class="mt-2 max-h-20 overflow-hidden whitespace-pre-wrap text-xs opacity-60">{{ item.valueJson }}</pre></button>
          <button v-if="canEdit()" class="rounded-xl p-2 text-red-500 hover:bg-red-500/10" @click="remove(item)"><Trash2 class="h-4 w-4" /></button>
        </div>
        <div v-if="!loading && !items.length" class="p-10 text-center text-sm opacity-60">No hay ajustes registrados.</div>
      </div>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex items-center justify-between"><div><h2 class="text-xl font-black">{{ editingId ? 'Editar ajuste' : 'Nuevo ajuste' }}</h2><p class="text-sm opacity-60">El backend conserva el valor como JSON.</p></div><button v-if="editingId" class="action" @click="edit()"><Plus class="h-4 w-4" /> Nuevo</button></div>
      <div class="mt-5 space-y-3">
        <label class="label">Clave<input v-model="form.key" class="field w-full" :disabled="Boolean(editingId)" /></label>
        <label class="label">Valor JSON<textarea v-model="form.valueJson" class="field min-h-56 w-full font-mono text-xs" spellcheck="false" /></label>
        <label class="flex items-center gap-2 text-sm font-bold"><input v-model="form.isPublic" type="checkbox" /> Exponer como ajuste público</label>
        <button v-if="canEdit()" class="primary-action" @click="save"><Save class="h-4 w-4" /> Guardar ajuste</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:14px;background:color-mix(in srgb,var(--dh-surface) 86%,transparent);padding:.7rem .85rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 14%,transparent)}.field:disabled{opacity:.55}.label{display:block;font-size:.8rem;font-weight:800}.action,.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border-radius:14px;padding:.65rem .85rem;font-size:.8rem;font-weight:800;transition:160ms}.action:hover{background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.primary-action{background:var(--dh-primary);color:#fff}
</style>
