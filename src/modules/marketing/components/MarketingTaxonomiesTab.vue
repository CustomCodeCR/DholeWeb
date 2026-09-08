<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { Plus, Save, Search, Trash2 } from 'lucide-vue-next'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { ContentService } from '@/core/services/contentService'
import type { TaxonomyTermDto } from '@/core/interfaces/content'

const props = defineProps<{ siteKey: string }>()
const authStore = useAuthStore()
const toastStore = useToastStore()
const loading = ref(false)
const items = ref<TaxonomyTermDto[]>([])
const search = ref('')
const kindFilter = ref('')
const editingId = ref<string | null>(null)
const form = reactive({ kind: 'Category', name: '', slug: '', description: '', parentId: '', sortOrder: 0 })

const canEdit = () => authStore.hasScope(CONTENT_SCOPES.edit)
const canDelete = () => authStore.hasScope(CONTENT_SCOPES.delete)

async function load() {
  loading.value = true
  try {
    const response = await ContentService.browseTaxonomies({
      pageNumber: 1,
      pageSize: 200,
      siteKey: props.siteKey || 'main',
      kind: kindFilter.value || undefined,
      search: search.value || undefined,
    })
    items.value = response.items
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las taxonomías.')
  } finally {
    loading.value = false
  }
}

function edit(item?: TaxonomyTermDto) {
  editingId.value = item?.id ?? null
  Object.assign(form, {
    kind: item?.kind ?? 'Category',
    name: item?.name ?? '',
    slug: item?.slug ?? '',
    description: item?.description ?? '',
    parentId: item?.parentId ?? '',
    sortOrder: item?.sortOrder ?? 0,
  })
}

async function save() {
  if (!canEdit() || !form.name.trim()) {
    toastStore.warning('Datos incompletos', 'El nombre de la taxonomía es obligatorio.')
    return
  }
  const payload = {
    kind: form.kind.trim() || 'Category',
    name: form.name.trim(),
    slug: form.slug.trim() || null,
    description: form.description.trim() || null,
    parentId: form.parentId || null,
    sortOrder: Number(form.sortOrder) || 0,
    siteKey: props.siteKey || 'main',
  }
  try {
    if (editingId.value) await ContentService.updateTaxonomy(editingId.value, payload)
    else await ContentService.createTaxonomy(payload)
    toastStore.success(editingId.value ? 'Taxonomía actualizada' : 'Taxonomía creada')
    edit()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la taxonomía.')
  }
}

async function remove(item: TaxonomyTermDto) {
  if (!canDelete() || !window.confirm(`¿Eliminar “${item.name}”?`)) return
  try {
    await ContentService.deleteTaxonomy(item.id)
    toastStore.success('Taxonomía eliminada')
    if (editingId.value === item.id) edit()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar la taxonomía.')
  }
}

watch(() => props.siteKey, () => void load())
onMounted(() => void load())
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div><h2 class="text-xl font-black">Taxonomías</h2><p class="text-sm opacity-60">Categorías, etiquetas y clasificaciones por sitio.</p></div>
      <div class="mt-4 grid gap-2 md:grid-cols-[1fr_180px_auto]"><input v-model="search" class="field" placeholder="Buscar nombre o slug" @keyup.enter="load" /><input v-model="kindFilter" class="field" placeholder="Kind: Category, Tag…" @keyup.enter="load" /><button class="action" @click="load"><Search class="h-4 w-4" /> Buscar</button></div>
      <div class="mt-4 space-y-2">
        <div v-if="loading" class="p-8 text-center text-sm opacity-60">Cargando taxonomías…</div>
        <div v-for="item in items" v-else :key="item.id" class="flex items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] p-3">
          <button class="min-w-0 flex-1 text-left" @click="edit(item)"><div class="flex flex-wrap items-center gap-2"><strong>{{ item.name }}</strong><span class="rounded-full bg-black/5 px-2 py-1 text-[10px] font-black dark:bg-white/10">{{ item.kind }}</span></div><p class="mt-1 text-xs opacity-50">{{ item.slug }} · orden {{ item.sortOrder }}<span v-if="item.parentId"> · padre {{ item.parentId }}</span></p></button>
          <button v-if="canDelete()" class="rounded-xl p-2 text-red-500 hover:bg-red-500/10" @click="remove(item)"><Trash2 class="h-4 w-4" /></button>
        </div>
        <div v-if="!loading && !items.length" class="p-10 text-center text-sm opacity-60">No hay taxonomías registradas.</div>
      </div>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex items-center justify-between"><div><h2 class="text-xl font-black">{{ editingId ? 'Editar taxonomía' : 'Nueva taxonomía' }}</h2><p class="text-sm opacity-60">Site: {{ siteKey || 'main' }}</p></div><button v-if="editingId" class="action" @click="edit()"><Plus class="h-4 w-4" /> Nueva</button></div>
      <div class="mt-5 space-y-3">
        <label class="label">Kind<input v-model="form.kind" class="field w-full" placeholder="Category" /></label>
        <label class="label">Nombre<input v-model="form.name" class="field w-full" /></label>
        <label class="label">Slug<input v-model="form.slug" class="field w-full" placeholder="Opcional" /></label>
        <label class="label">Descripción<textarea v-model="form.description" class="field min-h-24 w-full" /></label>
        <label class="label">Padre<select v-model="form.parentId" class="field w-full"><option value="">Sin padre</option><option v-for="item in items.filter((x) => x.id !== editingId)" :key="item.id" :value="item.id">{{ item.kind }} · {{ item.name }}</option></select></label>
        <label class="label">Orden<input v-model.number="form.sortOrder" class="field w-full" type="number" /></label>
        <button v-if="canEdit()" class="primary-action" @click="save"><Save class="h-4 w-4" /> Guardar</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:14px;background:color-mix(in srgb,var(--dh-surface) 86%,transparent);padding:.7rem .85rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 14%,transparent)}.label{display:block;font-size:.8rem;font-weight:800}.action,.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border-radius:14px;padding:.65rem .85rem;font-size:.8rem;font-weight:800;transition:160ms}.action:hover{background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.primary-action{background:var(--dh-primary);color:#fff}
</style>
