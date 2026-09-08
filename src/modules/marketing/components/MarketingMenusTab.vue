<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Plus, Save, Search, Trash2 } from 'lucide-vue-next'
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
const form = reactive<{
  id: string | null
  name: string
  location: string
  isActive: boolean
  items: NavigationMenuItemWriteRequest[]
}>({ id: null, name: 'Menú principal', location: 'header', isActive: true, items: [] })

const canEdit = () => authStore.hasScope(CONTENT_SCOPES.settings.edit)

function emptyMenu() {
  form.id = null
  form.name = form.location === 'header' ? 'Menú principal' : form.location
  form.isActive = true
  form.items.splice(0)
  loaded.value = true
}

async function load() {
  if (!form.location.trim()) return
  loading.value = true
  try {
    const menu = await ContentService.getMenu(form.location.trim(), props.siteKey || 'main')
    if (!menu) {
      emptyMenu()
      return
    }
    form.id = menu.id
    form.name = menu.name
    form.location = menu.location
    form.isActive = menu.isActive
    form.items.splice(0, form.items.length, ...menu.items.map((item) => ({
      label: item.label,
      url: item.url ?? '',
      contentId: item.contentId ?? '',
      parentId: item.parentId ?? '',
      sortOrder: item.sortOrder,
      target: item.target || '_self',
    })))
    loaded.value = true
  } catch {
    emptyMenu()
    toastStore.info('Menú nuevo', 'No se encontró un menú en esa ubicación. Puede crearlo ahora.')
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

async function save() {
  if (!canEdit() || !form.location.trim() || !form.name.trim()) return
  try {
    await ContentService.upsertMenu(form.location.trim(), {
      name: form.name.trim(),
      location: form.location.trim(),
      siteKey: props.siteKey || 'main',
      items: form.items
        .map((item, index) => ({
          label: item.label.trim(),
          url: item.url?.trim() || null,
          contentId: item.contentId?.trim() || null,
          parentId: item.parentId?.trim() || null,
          sortOrder: Number(item.sortOrder ?? index),
          target: item.target?.trim() || '_self',
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
    toastStore.success(form.isActive ? 'Menú activado' : 'Menú desactivado')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado del menú.')
  }
}
</script>

<template>
  <section class="dh-glass dh-liquid rounded-[32px] p-5">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><h2 class="text-xl font-black">Menús de navegación</h2><p class="text-sm opacity-60">Administre ubicaciones como header, footer o mobile para {{ siteKey || 'main' }}.</p></div>
      <div class="flex flex-wrap gap-2"><input v-model="form.location" class="field w-40" placeholder="header" @keyup.enter="load" /><button class="action" @click="load"><Search class="h-4 w-4" /> Cargar</button></div>
    </div>

    <div v-if="loading" class="p-12 text-center text-sm opacity-60">Cargando menú…</div>
    <div v-else-if="!loaded" class="mt-5 rounded-3xl border border-dashed border-[var(--dh-border)] p-12 text-center"><p class="font-black">Indique una ubicación y presione Cargar</p><p class="mt-1 text-sm opacity-60">Si no existe, podrá crearla usando el mismo formulario.</p></div>
    <div v-else class="mt-5 space-y-5">
      <div class="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]"><input v-model="form.name" class="field" placeholder="Nombre del menú" /><span class="flex items-center rounded-2xl bg-black/5 px-4 text-xs font-black dark:bg-white/10">{{ form.id ? (form.isActive ? 'ACTIVO' : 'INACTIVO') : 'NUEVO' }}</span><button v-if="form.id && canEdit()" class="action" @click="toggleActive">{{ form.isActive ? 'Desactivar' : 'Activar' }}</button><button v-if="canEdit()" class="action" @click="addItem"><Plus class="h-4 w-4" /> Ítem</button></div>

      <div class="space-y-3">
        <div v-for="(item, index) in form.items" :key="index" class="rounded-2xl border border-[var(--dh-border)] p-3">
          <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.2fr_1.4fr_.7fr_.7fr_auto]">
            <input v-model="item.label" class="field" placeholder="Etiqueta" />
            <input v-model="item.url" class="field" placeholder="/ruta o https://" />
            <input v-model="item.target" class="field" placeholder="_self" />
            <input v-model.number="item.sortOrder" class="field" type="number" placeholder="Orden" />
            <button class="rounded-xl p-2 text-red-500 hover:bg-red-500/10" @click="form.items.splice(index, 1)"><Trash2 class="h-4 w-4" /></button>
          </div>
          <div class="mt-2 grid gap-2 md:grid-cols-2"><input v-model="item.contentId" class="field" placeholder="Content ID opcional" /><input v-model="item.parentId" class="field" placeholder="Parent ID opcional" /></div>
        </div>
        <div v-if="!form.items.length" class="rounded-3xl border border-dashed border-[var(--dh-border)] p-10 text-center text-sm opacity-60">Este menú no tiene ítems.</div>
      </div>

      <button v-if="canEdit()" class="primary-action" @click="save"><Save class="h-4 w-4" /> Guardar menú</button>
    </div>
  </section>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:14px;background:color-mix(in srgb,var(--dh-surface) 86%,transparent);padding:.7rem .85rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 14%,transparent)}.action,.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border-radius:14px;padding:.65rem .85rem;font-size:.8rem;font-weight:800;transition:160ms}.action:hover{background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.primary-action{background:var(--dh-primary);color:#fff}
</style>
