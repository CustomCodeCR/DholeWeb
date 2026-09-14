<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RefreshCw, Save, Sparkles } from 'lucide-vue-next'
import { ContentService } from '@/core/services/contentService'
import { PageBuilderService } from '@/core/services/pageBuilderService'
import { useToastStore } from '@/core/stores/toastStore'
import {
  CMS_MOTION_EASINGS,
  CMS_MOTION_PRESETS,
  CMS_MOTION_TRIGGERS,
  type CmsAnimationConfig,
  type PageBuilderBlock,
} from '@/core/interfaces/pageBuilder'
import { normalizeCmsAnimation, parsePageBuilderBlocks, validateCmsAnimation } from '@/core/marketing/contentMotion'
import type { ContentItemListDto } from '@/core/interfaces/content'

const props = defineProps<{ siteKey: string }>()
const toastStore = useToastStore()
const loadingPages = ref(false)
const loadingBlocks = ref(false)
const pages = ref<ContentItemListDto[]>([])
const selectedPageId = ref('')
const blocks = ref<PageBuilderBlock[]>([])
const savingBlockId = ref('')

async function loadPages() {
  loadingPages.value = true
  try {
    const response = await ContentService.browseEditor({ pageNumber: 1, pageSize: 200, siteKey: props.siteKey || 'main', type: 'Page' })
    pages.value = response.items
    if (selectedPageId.value && !pages.value.some((page) => page.id === selectedPageId.value)) {
      selectedPageId.value = ''
      blocks.value = []
    }
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las páginas para configurar animaciones.')
  } finally {
    loadingPages.value = false
  }
}

async function loadBlocks() {
  if (!selectedPageId.value) {
    blocks.value = []
    return
  }
  loadingBlocks.value = true
  try {
    const document = await PageBuilderService.get(selectedPageId.value)
    blocks.value = parsePageBuilderBlocks(document.blocksJson)
  } catch (error) {
    blocks.value = []
    toastStore.backendError(error, 'No se pudieron cargar los bloques de la página.')
  } finally {
    loadingBlocks.value = false
  }
}

function animationFor(block: PageBuilderBlock): CmsAnimationConfig {
  if (!block.animation) block.animation = normalizeCmsAnimation()
  return block.animation
}

async function saveAnimation(block: PageBuilderBlock) {
  if (!selectedPageId.value || savingBlockId.value) return
  const animation = animationFor(block)
  const validation = validateCmsAnimation(animation)
  if (validation) {
    toastStore.warning('Animación inválida', validation)
    return
  }

  savingBlockId.value = block.id
  try {
    const normalized = normalizeCmsAnimation(animation)
    const document = await PageBuilderService.apply(selectedPageId.value, {
      operation: 'edit',
      blockId: block.id,
      animationJson: JSON.stringify(normalized),
    })
    blocks.value = parsePageBuilderBlocks(document.blocksJson)
    toastStore.success('Animación guardada')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la animación del bloque.')
  } finally {
    savingBlockId.value = ''
  }
}

onMounted(() => void loadPages())
</script>

<template>
  <section class="space-y-5">
    <div class="dh-glass dh-liquid rounded-[30px] p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[.18em] text-[var(--dh-primary)]">FASE 35</p>
          <h2 class="mt-1 text-2xl font-black">Animaciones por bloque</h2>
          <p class="mt-2 max-w-3xl text-sm opacity-60">
            Configure el preset y comportamiento de cada bloque. La ejecución visual se realizará en Fennec usando el Motion System central.
          </p>
        </div>
        <button class="secondary-action" :disabled="loadingPages" @click="loadPages">
          <RefreshCw class="h-4 w-4" /> Actualizar páginas
        </button>
      </div>

      <label class="mt-5 block text-sm font-bold">
        Página
        <select v-model="selectedPageId" class="field mt-2 w-full max-w-2xl" @change="loadBlocks">
          <option value="">Seleccione una página…</option>
          <option v-for="page in pages" :key="page.id" :value="page.id">{{ page.title }} · /{{ page.slug }}</option>
        </select>
      </label>
    </div>

    <div v-if="loadingBlocks" class="dh-glass dh-liquid rounded-[30px] p-10 text-center text-sm opacity-60">Cargando bloques…</div>

    <div v-else-if="selectedPageId && blocks.length" class="grid gap-4">
      <article v-for="block in blocks" :key="block.id" class="dh-glass dh-liquid rounded-[26px] p-5">
        <div class="flex flex-col gap-3 border-b border-[var(--dh-border)] pb-4 md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--dh-primary)_10%,transparent)] text-[var(--dh-primary)]"><Sparkles class="h-5 w-5" /></span>
            <div><h3 class="font-black">{{ block.type }}</h3><p class="text-xs opacity-45">{{ block.id }}</p></div>
          </div>
          <span class="rounded-full px-3 py-1 text-xs font-bold" :class="block.isVisible ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'">
            {{ block.isVisible ? 'Visible' : 'Oculto' }}
          </span>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label class="label">Preset
            <select v-model="animationFor(block).preset" class="field mt-2 w-full">
              <option v-for="preset in CMS_MOTION_PRESETS" :key="preset" :value="preset">{{ preset }}</option>
            </select>
          </label>
          <label class="label">Duración (ms)<input v-model.number="animationFor(block).duration" class="field mt-2 w-full" type="number" min="0" max="3000" step="1" /></label>
          <label class="label">Delay (ms)<input v-model.number="animationFor(block).delay" class="field mt-2 w-full" type="number" min="0" max="3000" step="1" /></label>
          <label class="label">Easing
            <select v-model="animationFor(block).easing" class="field mt-2 w-full">
              <option v-for="easing in CMS_MOTION_EASINGS" :key="easing" :value="easing">{{ easing }}</option>
            </select>
          </label>
          <label class="label">Stagger (ms)<input v-model.number="animationFor(block).stagger" class="field mt-2 w-full" type="number" min="0" max="1000" step="1" /></label>
          <label class="label">Trigger
            <select v-model="animationFor(block).trigger" class="field mt-2 w-full">
              <option v-for="trigger in CMS_MOTION_TRIGGERS" :key="trigger" :value="trigger">{{ trigger }}</option>
            </select>
          </label>
          <label class="label">Distancia (px)<input v-model.number="animationFor(block).distance" class="field mt-2 w-full" type="number" min="0" max="160" step="1" /></label>
          <label class="flex items-center gap-3 self-end rounded-xl border border-[var(--dh-border)] p-3 text-sm font-bold">
            <input v-model="animationFor(block).once" type="checkbox" /> Ejecutar una sola vez
          </label>
        </div>

        <div class="mt-5 flex justify-end">
          <button class="primary-action" :disabled="savingBlockId === block.id" @click="saveAnimation(block)">
            <Save class="h-4 w-4" /> {{ savingBlockId === block.id ? 'Guardando…' : 'Guardar animación' }}
          </button>
        </div>
      </article>
    </div>

    <div v-else-if="selectedPageId" class="dh-glass dh-liquid rounded-[30px] p-10 text-center text-sm opacity-60">
      Esta página todavía no tiene bloques configurables en Page Builder.
    </div>
  </section>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:12px;background:color-mix(in srgb,var(--dh-surface) 88%,transparent);padding:.7rem .8rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}.label{display:block;font-size:.8rem;font-weight:800}.primary-action,.secondary-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:12px;padding:.68rem .9rem;font-size:.8rem;font-weight:800;transition:160ms}.primary-action{background:var(--dh-primary);color:#fff}.secondary-action:hover:not(:disabled){background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.primary-action:disabled,.secondary-action:disabled{opacity:.4}
</style>
