<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Plus, Save, Search, Tag, Trash2 } from 'lucide-vue-next'
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
const filter = ref('')
const editingId = ref<string | null>(null)
const form = reactive({ type: 'Category', name: '', slug: '', description: '', parentId: '' })

const canEdit = () => authStore.hasScope(CONTENT_SCOPES.edit)
const canDelete = () => authStore.hasScope(CONTENT_SCOPES.delete)
const possibleParents = computed(() => items.value.filter((item) => item.id !== editingId.value && item.kind === form.type))

function typeLabel(kind: string) {
  return kind.toLowerCase() === 'tag' ? 'Etiqueta' : 'Categoría'
}

async function load() {
  loading.value = true
  try {
    const response = await ContentService.browseTaxonomies({
      pageNumber: 1,
      pageSize: 250,
      siteKey: props.siteKey || 'main',
      kind: filter.value || undefined,
      search: search.value.trim() || undefined,
    })
    items.value = response.items
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las categorías y etiquetas.')
  } finally {
    loading.value = false
  }
}

function edit(item?: TaxonomyTermDto) {
  editingId.value = item?.id ?? null
  Object.assign(form, {
    type: item?.kind ?? 'Category',
    name: item?.name ?? '',
    slug: item?.slug ?? '',
    description: item?.description ?? '',
    parentId: item?.parentId ?? '',
  })
}

async function save() {
  if (!canEdit() || !form.name.trim()) {
    toastStore.warning('Falta el nombre', 'Escriba un nombre para continuar.')
    return
  }

  const payload = {
    kind: form.type,
    name: form.name.trim(),
    slug: form.slug.trim() || null,
    description: form.description.trim() || null,
    parentId: form.type === 'Category' ? form.parentId || null : null,
    sortOrder: 0,
    siteKey: props.siteKey || 'main',
  }

  try {
    if (editingId.value) await ContentService.updateTaxonomy(editingId.value, payload)
    else await ContentService.createTaxonomy(payload)
    toastStore.success(editingId.value ? 'Cambios guardados' : `${typeLabel(form.type)} creada`)
    edit()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar.')
  }
}

async function remove(item: TaxonomyTermDto) {
  if (!canDelete() || !window.confirm(`¿Eliminar “${item.name}”?`)) return
  try {
    await ContentService.deleteTaxonomy(item.id)
    toastStore.success(`${typeLabel(item.kind)} eliminada`)
    if (editingId.value === item.id) edit()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar.')
  }
}

watch(() => props.siteKey, () => void load())
watch(() => form.type, () => { form.parentId = '' })
onMounted(() => void load())
</script>

<template>
  <div class="space-y-5">
    <section class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-2xl font-black">Categorías y etiquetas</h2>
          <p class="mt-1 text-sm opacity-60">Organice las páginas y noticias para que sean más fáciles de encontrar.</p>
        </div>
        <button v-if="canEdit()" class="primary-action" @click="edit()"><Plus class="h-4 w-4" /> Agregar nueva</button>
      </div>

      <div class="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]">
        <label class="relative">
          <Search class="pointer-events-none absolute left-3 top-3.5 h-4 w-4 opacity-45" />
          <input v-model="search" class="field w-full pl-10" placeholder="Buscar por nombre…" @keyup.enter="load" />
        </label>
        <select v-model="filter" class="field" @change="load">
          <option value="">Todas</option>
          <option value="Category">Categorías</option>
          <option value="Tag">Etiquetas</option>
        </select>
        <button class="secondary-action" @click="load">Buscar</button>
      </div>

      <div class="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <div v-if="loading" class="col-span-full p-10 text-center text-sm opacity-60">Cargando…</div>
        <div v-for="item in items" v-else :key="item.id" class="term-card">
          <button class="min-w-0 flex-1 text-left" @click="edit(item)">
            <div class="flex items-center gap-2">
              <Tag class="h-4 w-4 text-[var(--dh-primary)]" />
              <strong class="truncate">{{ item.name }}</strong>
            </div>
            <div class="mt-2 flex items-center gap-2">
              <span class="type-pill">{{ typeLabel(item.kind) }}</span>
              <span class="truncate text-xs opacity-45">/{{ item.slug }}</span>
            </div>
          </button>
          <button v-if="canDelete()" class="delete-button" title="Eliminar" @click="remove(item)">
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
        <div v-if="!loading && !items.length" class="col-span-full p-10 text-center text-sm opacity-60">
          No hay categorías ni etiquetas todavía.
        </div>
      </div>
    </section>

    <section class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-xl font-black">{{ editingId ? 'Editar' : 'Agregar nueva' }}</h3>
          <p class="mt-1 text-sm opacity-60">Use categorías para agrupar contenido y etiquetas para describir temas.</p>
        </div>
        <button v-if="editingId" class="secondary-action" @click="edit()"><Plus class="h-4 w-4" /> Nueva</button>
      </div>

      <div class="mt-5 grid gap-4 lg:grid-cols-2">
        <label class="label">
          Tipo
          <select v-model="form.type" class="field mt-2 w-full">
            <option value="Category">Categoría</option>
            <option value="Tag">Etiqueta</option>
          </select>
        </label>
        <label class="label">
          Nombre
          <input v-model="form.name" class="field mt-2 w-full" placeholder="Ej. Transporte marítimo" />
        </label>
        <label class="label">
          Dirección <span class="font-normal opacity-45">(opcional)</span>
          <input v-model="form.slug" class="field mt-2 w-full" placeholder="transporte-maritimo" />
        </label>
        <label v-if="form.type === 'Category'" class="label">
          Categoría superior <span class="font-normal opacity-45">(opcional)</span>
          <select v-model="form.parentId" class="field mt-2 w-full">
            <option value="">Ninguna</option>
            <option v-for="item in possibleParents" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>
        <label class="label lg:col-span-2">
          Descripción <span class="font-normal opacity-45">(opcional)</span>
          <textarea v-model="form.description" class="field mt-2 min-h-24 w-full" placeholder="Una explicación corta para el equipo de Mercadeo." />
        </label>
      </div>

      <button v-if="canEdit()" class="primary-action mt-5" @click="save"><Save class="h-4 w-4" /> Guardar</button>
    </section>
  </div>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:12px;background:color-mix(in srgb,var(--dh-surface) 88%,transparent);padding:.7rem .8rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}.label{display:block;font-size:.8rem;font-weight:800}.primary-action,.secondary-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:12px;padding:.68rem .9rem;font-size:.8rem;font-weight:800;transition:160ms}.primary-action{background:var(--dh-primary);color:#fff}.secondary-action:hover{background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.term-card{display:flex;align-items:center;gap:.5rem;border:1px solid var(--dh-border);border-radius:16px;padding:.85rem;transition:160ms}.term-card:hover{border-color:color-mix(in srgb,var(--dh-primary) 50%,var(--dh-border));background:color-mix(in srgb,var(--dh-primary) 4%,transparent)}.type-pill{border-radius:999px;background:color-mix(in srgb,var(--dh-primary) 10%,transparent);padding:.25rem .5rem;color:var(--dh-primary);font-size:.68rem;font-weight:800}.delete-button{display:grid;height:34px;width:34px;flex:none;place-items:center;border-radius:10px;color:#dc2626;transition:150ms}.delete-button:hover{background:rgb(239 68 68 / .1)}
</style>
