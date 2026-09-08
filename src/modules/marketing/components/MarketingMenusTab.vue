<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-vue-next'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { ContentService } from '@/core/services/contentService'
import type { NavigationMenuItemWriteRequest } from '@/core/interfaces/content'

const props = defineProps<{ siteKey: string }>()
const authStore = useAuthStore()
const toastStore = useToastStore()
const loading = ref(false)
const loaded = ref(false)

const locations = [
  { value: 'header', label: 'Menú principal' },
  { value: 'footer', label: 'Pie de página' },
  { value: 'mobile', label: 'Menú móvil' },
]

const form = reactive<{
  id: string | null
  location: string
  isActive: boolean
  items: NavigationMenuItemWriteRequest[]
}>({ id: null, location: 'header', isActive: true, items: [] })

const canEdit = () => authStore.hasScope(CONTENT_SCOPES.settings.edit)

function menuName() {
  return locations.find((item) => item.value === form.location)?.label ?? 'Menú del sitio'
}

function emptyMenu() {
  form.id = null
  form.isActive = true
  form.items.splice(0)
  loaded.value = true
}

async function load() {
  loading.value = true
  try {
    const menu = await ContentService.getMenu(form.location, props.siteKey || 'main')
    if (!menu) {
      emptyMenu()
      return
    }
    form.id = menu.id
    form.isActive = menu.isActive
    form.items.splice(0, form.items.length, ...menu.items.map((item, index) => ({
      label: item.label,
      url: item.url ?? '',
      contentId: '',
      parentId: '',
      sortOrder: index,
      target: item.target || '_self',
    })))
    loaded.value = true
  } catch {
    emptyMenu()
  } finally {
    loading.value = false
  }
}

function addItem() {
  form.items.push({
    label: '',
    url: '',
    contentId: '',
    parentId: '',
    sortOrder: form.items.length,
    target: '_self',
  })
}

function move(index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= form.items.length) return
  const current = form.items[index]
  const next = form.items[nextIndex]
  if (!current || !next) return
  form.items[index] = next
  form.items[nextIndex] = current
}

async function save() {
  if (!canEdit()) return
  try {
    await ContentService.upsertMenu(form.location, {
      name: menuName(),
      location: form.location,
      siteKey: props.siteKey || 'main',
      items: form.items
        .map((item, index) => ({
          label: item.label.trim(),
          url: item.url?.trim() || null,
          contentId: null,
          parentId: null,
          sortOrder: index,
          target: item.target === '_blank' ? '_blank' : '_self',
        }))
        .filter((item) => item.label.length > 0),
    })
    toastStore.success('Menú guardado')
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el menú.')
  }
}

async function toggleActive() {
  if (!form.id || !canEdit()) return
  try {
    await ContentService.setMenuActive(form.id, !form.isActive)
    form.isActive = !form.isActive
    toastStore.success(form.isActive ? 'Menú visible' : 'Menú oculto')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar la visibilidad del menú.')
  }
}

watch(() => form.location, () => void load())
watch(() => props.siteKey, () => void load())
onMounted(() => void load())
</script>

<template>
  <section class="dh-glass dh-liquid rounded-[30px] p-5">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 class="text-2xl font-black">Menús</h2>
        <p class="mt-1 text-sm opacity-60">Defina los enlaces que aparecen en la navegación del sitio.</p>
      </div>
      <select v-model="form.location" class="field w-full sm:w-52">
        <option v-for="location in locations" :key="location.value" :value="location.value">{{ location.label }}</option>
      </select>
    </div>

    <div v-if="loading" class="p-12 text-center text-sm opacity-60">Cargando menú…</div>
    <div v-else-if="loaded" class="mt-6 space-y-5">
      <div class="flex flex-col gap-3 rounded-2xl border border-[var(--dh-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong>{{ menuName() }}</strong>
          <p class="mt-1 text-xs opacity-50">{{ form.id ? (form.isActive ? 'Visible en el sitio' : 'Oculto') : 'Se creará al guardar' }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-if="form.id && canEdit()" class="secondary-action" @click="toggleActive">
            {{ form.isActive ? 'Ocultar menú' : 'Mostrar menú' }}
          </button>
          <button v-if="canEdit()" class="secondary-action" @click="addItem"><Plus class="h-4 w-4" /> Agregar enlace</button>
        </div>
      </div>

      <div class="space-y-3">
        <div v-for="(item, index) in form.items" :key="index" class="menu-item">
          <div class="grid min-w-0 flex-1 gap-3 lg:grid-cols-[.9fr_1.4fr_auto] lg:items-center">
            <label class="label">Texto<input v-model="item.label" class="field mt-1.5 w-full" placeholder="Ej. Servicios" /></label>
            <label class="label">Enlace<input v-model="item.url" class="field mt-1.5 w-full" placeholder="/servicios o https://..." /></label>
            <label class="flex items-center gap-2 pt-5 text-xs font-bold">
              <input :checked="item.target === '_blank'" type="checkbox" @change="item.target = ($event.target as HTMLInputElement).checked ? '_blank' : '_self'" />
              Nueva pestaña
            </label>
          </div>
          <div class="flex shrink-0 gap-1 pt-5">
            <button class="icon-action" :disabled="index === 0" title="Subir" @click="move(index, -1)"><ArrowUp class="h-4 w-4" /></button>
            <button class="icon-action" :disabled="index === form.items.length - 1" title="Bajar" @click="move(index, 1)"><ArrowDown class="h-4 w-4" /></button>
            <button class="delete-button" title="Eliminar" @click="form.items.splice(index, 1)"><Trash2 class="h-4 w-4" /></button>
          </div>
        </div>
        <div v-if="!form.items.length" class="rounded-2xl border border-dashed border-[var(--dh-border)] p-10 text-center">
          <p class="font-bold">Este menú está vacío.</p>
          <p class="mt-1 text-sm opacity-55">Agregue enlaces y ordénelos con las flechas.</p>
        </div>
      </div>

      <button v-if="canEdit()" class="primary-action" @click="save"><Save class="h-4 w-4" /> Guardar menú</button>
    </div>
  </section>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:12px;background:color-mix(in srgb,var(--dh-surface) 88%,transparent);padding:.7rem .8rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}.label{display:block;font-size:.76rem;font-weight:800}.primary-action,.secondary-action,.icon-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:12px;padding:.68rem .9rem;font-size:.8rem;font-weight:800;transition:160ms}.primary-action{background:var(--dh-primary);color:#fff}.secondary-action:hover,.icon-action:hover:not(:disabled){background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.icon-action{padding:.55rem}.icon-action:disabled{opacity:.25}.menu-item{display:flex;gap:.75rem;border:1px solid var(--dh-border);border-radius:16px;padding:.9rem}.delete-button{display:grid;height:34px;width:34px;place-items:center;border-radius:10px;color:#dc2626;transition:150ms}.delete-button:hover{background:rgb(239 68 68 / .1)}
</style>
