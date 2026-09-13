<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Check, Clipboard, RefreshCw, Sparkles, WandSparkles } from 'lucide-vue-next'
import { AI_SCOPES, CONTENT_SCOPES } from '@/core/auth/scopes'
import { AiService } from '@/core/services/aiService'
import { ContentService } from '@/core/services/contentService'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import {
  MARKETING_AI_REQUIRES_HUMAN_APPROVAL,
  MARKETING_AI_TASKS,
  buildContentAiSource,
  buildMarketingAiRequest,
  buildMediaAiSource,
  marketingAiTaskDefinition,
  normalizeMarketingAiOutput,
  type MarketingAiTask,
} from '@/core/marketing/marketingAi'
import type { ContentItemDto, ContentItemListDto, MediaDto } from '@/core/interfaces/content'

const props = withDefaults(defineProps<{ siteKey?: string }>(), { siteKey: 'main' })

const authStore = useAuthStore()
const toastStore = useToastStore()
const loadingSources = ref(false)
const generating = ref(false)
const applying = ref(false)
const task = ref<MarketingAiTask>('suggest-title')
const contentItems = ref<ContentItemListDto[]>([])
const mediaItems = ref<MediaDto[]>([])
const selectedContentId = ref('')
const selectedMediaId = ref('')
const selectedContent = ref<ContentItemDto | null>(null)
const sourceText = ref('')
const result = ref('')
const approved = ref(false)
const executionInfo = ref<{ executionId: string; modelName: string } | null>(null)

const taskDefinition = computed(() => marketingAiTaskDefinition(task.value))
const isMediaTask = computed(() => taskDefinition.value.source === 'media')
const canUseAi = computed(() => authStore.hasScope(AI_SCOPES.executions.execute))
const canApplyAlt = computed(() => authStore.hasScope(CONTENT_SCOPES.edit))
const selectedMedia = computed(() => mediaItems.value.find((item) => item.id === selectedMediaId.value) ?? null)

function resetSuggestion() {
  result.value = ''
  approved.value = false
  executionInfo.value = null
}

function refreshSourceFromSelection() {
  resetSuggestion()
  if (isMediaTask.value) {
    sourceText.value = selectedMedia.value ? buildMediaAiSource(selectedMedia.value) : ''
    return
  }
  sourceText.value = selectedContent.value ? buildContentAiSource(selectedContent.value) : ''
}

async function loadSources() {
  loadingSources.value = true
  try {
    const [contentResponse, mediaResponse] = await Promise.all([
      ContentService.browseEditor({ pageNumber: 1, pageSize: 200, siteKey: props.siteKey }),
      ContentService.browseMedia({ pageNumber: 1, pageSize: 200, contentType: 'image/' }),
    ])
    contentItems.value = contentResponse.items
    mediaItems.value = mediaResponse.items
  } catch (error) {
    toastStore.backendWarning(error, 'No se pudo cargar todo el contexto disponible para el asistente IA.')
  } finally {
    loadingSources.value = false
  }
}

async function selectContent(id: string) {
  selectedContentId.value = id
  selectedContent.value = null
  resetSuggestion()
  if (!id) {
    sourceText.value = ''
    return
  }
  try {
    selectedContent.value = await ContentService.getEditorContent(id)
    sourceText.value = buildContentAiSource(selectedContent.value)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el contenido seleccionado.')
  }
}

function selectMedia(id: string) {
  selectedMediaId.value = id
  refreshSourceFromSelection()
}

async function generateSuggestion() {
  if (!canUseAi.value || generating.value) return
  if (!sourceText.value.trim()) {
    toastStore.warning('Falta contexto', 'Seleccione un contenido/archivo o escriba una fuente para la sugerencia.')
    return
  }

  generating.value = true
  resetSuggestion()
  try {
    const response = await AiService.executeChat(buildMarketingAiRequest(task.value, sourceText.value, {
      siteKey: props.siteKey,
      contentTitle: selectedContent.value?.title,
      contentType: selectedContent.value?.type?.toString(),
    }))
    result.value = normalizeMarketingAiOutput(task.value, response.content)
    executionInfo.value = { executionId: response.executionId, modelName: response.modelName }
  } catch (error) {
    toastStore.backendError(error, 'DholeAIService no pudo generar la sugerencia.')
  } finally {
    generating.value = false
  }
}

function approveResult() {
  if (!result.value.trim()) return
  approved.value = true
  toastStore.success('Resultado aprobado por el usuario')
}

async function copyApprovedResult() {
  if (!approved.value || !result.value.trim()) return
  try {
    await navigator.clipboard.writeText(result.value)
    toastStore.success('Resultado aprobado copiado al portapapeles')
  } catch {
    toastStore.warning('No se pudo copiar', 'Seleccione el resultado y cópielo manualmente.')
  }
}

async function applyApprovedAlt() {
  const media = selectedMedia.value
  if (!media || task.value !== 'alt-text' || !approved.value || !canApplyAlt.value || applying.value) return
  applying.value = true
  try {
    await ContentService.updateMedia(media.id, {
      altText: result.value.trim() || null,
      caption: media.caption ?? null,
      metadataJson: media.metadataJson ?? null,
    })
    media.altText = result.value.trim()
    sourceText.value = buildMediaAiSource(media)
    toastStore.success('ALT aprobado aplicado al archivo')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aplicar el ALT aprobado.')
  } finally {
    applying.value = false
  }
}

watch(task, () => refreshSourceFromSelection())
watch(sourceText, () => {
  if (result.value || approved.value) resetSuggestion()
})

onMounted(() => void loadSources())
</script>

<template>
  <div class="space-y-5">
    <section class="dh-glass dh-liquid rounded-[30px] p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div class="flex items-center gap-2 text-[var(--dh-primary)]">
            <Sparkles class="h-5 w-5" />
            <p class="text-xs font-black uppercase tracking-[.18em]">DholeAIService</p>
          </div>
          <h2 class="mt-2 text-2xl font-black">Asistente IA de Mercadeo</h2>
          <p class="mt-2 max-w-3xl text-sm opacity-60">
            Genera sugerencias editoriales y SEO. La IA nunca guarda, programa ni publica contenido; cada resultado debe ser revisado y aprobado por una persona.
          </p>
        </div>
        <button class="secondary-action" :disabled="loadingSources" @click="loadSources">
          <RefreshCw class="h-4 w-4" /> Actualizar contexto
        </button>
      </div>

      <div v-if="!canUseAi" class="warning-card mt-5">
        Para usar el asistente el usuario necesita el scope <code>ai.execution.execute</code>. Los permisos CMS continúan controlando las ediciones de Mercadeo.
      </div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
      <div class="dh-glass dh-liquid rounded-[30px] p-5">
        <h3 class="text-lg font-black">1. Seleccione la ayuda</h3>
        <div class="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <button
            v-for="entry in MARKETING_AI_TASKS"
            :key="entry.key"
            class="task-card"
            :class="{ 'task-card-active': task === entry.key }"
            @click="task = entry.key"
          >
            <strong>{{ entry.label }}</strong>
            <span>{{ entry.description }}</span>
          </button>
        </div>
      </div>

      <div class="dh-glass dh-liquid rounded-[30px] p-5">
        <h3 class="text-lg font-black">2. Contexto autorizado</h3>
        <p class="mt-1 text-sm opacity-55">La IA recibe únicamente el texto mostrado en este campo.</p>

        <div class="mt-4">
          <label v-if="!isMediaTask" class="label">
            Cargar contenido existente
            <select class="field mt-2 w-full" :value="selectedContentId" @change="selectContent(($event.target as HTMLSelectElement).value)">
              <option value="">Contexto manual</option>
              <option v-for="item in contentItems" :key="item.id" :value="item.id">
                {{ item.title }} · {{ item.type }} · {{ item.status }}
              </option>
            </select>
          </label>

          <label v-else class="label">
            Cargar imagen existente
            <select class="field mt-2 w-full" :value="selectedMediaId" @change="selectMedia(($event.target as HTMLSelectElement).value)">
              <option value="">Contexto manual</option>
              <option v-for="item in mediaItems" :key="item.id" :value="item.id">{{ item.fileName }}</option>
            </select>
          </label>

          <label class="label mt-4">
            Fuente
            <textarea
              v-model="sourceText"
              class="field mt-2 min-h-56 w-full font-mono text-xs"
              :placeholder="isMediaTask ? 'Nombre del archivo, caption y contexto visual disponible…' : 'Pegue o cargue el contenido que la IA puede usar…'"
            />
          </label>

          <button class="primary-action mt-4" :disabled="!canUseAi || generating || !sourceText.trim()" @click="generateSuggestion">
            <WandSparkles class="h-4 w-4" /> {{ generating ? 'Generando…' : `Generar: ${taskDefinition.label}` }}
          </button>
        </div>
      </div>
    </section>

    <section v-if="result" class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[.16em] text-[var(--dh-primary)]">3. Revisión humana</p>
          <h3 class="mt-1 text-xl font-black">Resultado pendiente de aprobación</h3>
          <p v-if="executionInfo" class="mt-1 text-xs opacity-45">{{ executionInfo.modelName }} · ejecución {{ executionInfo.executionId }}</p>
        </div>
        <span class="approval-badge" :class="approved ? 'approval-badge-ok' : ''">
          <Check v-if="approved" class="h-4 w-4" /> {{ approved ? 'Aprobado por humano' : 'Pendiente de aprobación' }}
        </span>
      </div>

      <textarea v-model="result" class="field mt-4 min-h-56 w-full" />

      <div class="mt-4 flex flex-wrap gap-2">
        <button v-if="MARKETING_AI_REQUIRES_HUMAN_APPROVAL && !approved" class="primary-action" @click="approveResult">
          <Check class="h-4 w-4" /> Aprobar resultado
        </button>
        <button class="secondary-action" :disabled="!approved" @click="copyApprovedResult">
          <Clipboard class="h-4 w-4" /> Copiar resultado aprobado
        </button>
        <button
          v-if="task === 'alt-text' && selectedMedia"
          class="secondary-action"
          :disabled="!approved || !canApplyAlt || applying"
          @click="applyApprovedAlt"
        >
          <Check class="h-4 w-4" /> {{ applying ? 'Aplicando…' : 'Aplicar ALT aprobado' }}
        </button>
      </div>

      <p class="mt-4 text-xs opacity-50">
        Aprobar una sugerencia no publica contenido. Para títulos, texto, SEO, JSON-LD, resúmenes y traducciones, copie el resultado aprobado al editor correspondiente y use el flujo editorial normal.
      </p>
    </section>
  </div>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:12px;background:color-mix(in srgb,var(--dh-surface) 88%,transparent);padding:.7rem .8rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}.label{display:block;font-size:.8rem;font-weight:800}.primary-action,.secondary-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:12px;padding:.68rem .9rem;font-size:.8rem;font-weight:800;transition:160ms}.primary-action{background:var(--dh-primary);color:#fff}.secondary-action:hover{background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.primary-action:disabled,.secondary-action:disabled{opacity:.4;cursor:not-allowed}.task-card{display:flex;min-height:92px;flex-direction:column;align-items:flex-start;border:1px solid var(--dh-border);border-radius:16px;padding:.9rem;text-align:left;transition:160ms}.task-card span{margin-top:.35rem;font-size:.72rem;line-height:1.35;opacity:.55}.task-card:hover,.task-card-active{border-color:color-mix(in srgb,var(--dh-primary) 55%,var(--dh-border));background:color-mix(in srgb,var(--dh-primary) 7%,transparent)}.task-card-active strong{color:var(--dh-primary)}.warning-card{border:1px solid rgb(245 158 11 / .35);border-radius:16px;background:rgb(245 158 11 / .08);padding:1rem;font-size:.82rem}.warning-card code{font-weight:800}.approval-badge{display:inline-flex;align-items:center;gap:.35rem;border-radius:999px;background:rgb(245 158 11 / .12);padding:.45rem .7rem;font-size:.72rem;font-weight:900;color:#b45309}.approval-badge-ok{background:rgb(16 185 129 / .12);color:#047857}
</style>
