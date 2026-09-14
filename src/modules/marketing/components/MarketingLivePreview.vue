<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Image as ImageIcon, Play, Sparkles } from 'lucide-vue-next'
import { downloadFile } from '@/core/api/fetchConfig'
import type { PageBuilderBlock } from '@/core/interfaces/pageBuilder'
import { useLocale } from '@/core/stores/locale'
import DhEmptyState from '@/shared/components/atoms/DhEmptyState.vue'
import DhDevicePreview, { type DhDeviceKind } from '@/shared/components/molecules/DhDevicePreview.vue'
import { localizeMarketingBlock } from '@/modules/marketing/config/marketingBlockCatalog'
import { getMarketingBlockDefinitionForBuilderBlock } from '@/modules/marketing/config/marketingPageBuilder'

const props = withDefaults(defineProps<{
  blocks: PageBuilderBlock[]
  pageTitle?: string
  fallbackHtml?: string | null
  selectedBlockId?: string | null
}>(), {
  pageTitle: '',
  fallbackHtml: null,
  selectedBlockId: null,
})

const emit = defineEmits<{
  select: [block: PageBuilderBlock]
}>()

const localeStore = useLocale()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es
const mediaUrls = ref<Record<string, string>>({})
const failedMedia = ref<Record<string, boolean>>({})
const previewDevice = ref<DhDeviceKind>('desktop')

const deviceLabels = computed<Record<DhDeviceKind, string>>(() => ({
  desktop: tr('Desktop', 'Desktop'),
  tablet: tr('Tablet', 'Tablet'),
  mobile: tr('Mobile', 'Mobile'),
}))

const deviceWidths: Record<DhDeviceKind, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 390,
}

const visibleBlocks = computed(() => props.blocks.filter((block) => block.isVisible))
const mediaIds = computed(() => Array.from(new Set(visibleBlocks.value.flatMap((block) => {
  const id = block.data.editorMediaId
  return typeof id === 'string' && id.trim() ? [id] : []
}))))
const mediaKey = computed(() => [...mediaIds.value].sort().join('|'))

function blockKey(block: PageBuilderBlock) {
  const editorKey = block.data.editorBlockKey
  if (typeof editorKey === 'string' && editorKey) return editorKey
  return getMarketingBlockDefinitionForBuilderBlock(block)?.id ?? block.type.toLocaleLowerCase('en-US')
}

function blockTitle(block: PageBuilderBlock) {
  const definition = getMarketingBlockDefinitionForBuilderBlock(block)
  return definition
    ? localizeMarketingBlock(definition.title, localeStore.locale)
    : tr('Sección', 'Section')
}

function blockDescription(block: PageBuilderBlock) {
  const definition = getMarketingBlockDefinitionForBuilderBlock(block)
  return definition
    ? localizeMarketingBlock(definition.description, localeStore.locale)
    : tr('Contenido de la página.', 'Page content.')
}

function stringData(block: PageBuilderBlock, key: string) {
  const value = block.data[key]
  return typeof value === 'string' ? value : ''
}

function previewText(block: PageBuilderBlock) {
  const key = blockKey(block)
  const candidates = key === 'text'
    ? ['text', 'body', 'content', 'title']
    : key === 'button' || key === 'cta' || key === 'campaign'
      ? ['label', 'text', 'title', 'headline']
      : ['title', 'headline', 'heading', 'name', 'text', 'body', 'content', 'label']

  for (const candidate of candidates) {
    const value = stringData(block, candidate).trim()
    if (value) return value
  }

  return blockTitle(block)
}

function mediaId(block: PageBuilderBlock) {
  const value = block.data.editorMediaId
  return typeof value === 'string' && value.trim() ? value : null
}

function mediaUrl(block: PageBuilderBlock) {
  const id = mediaId(block)
  return id ? mediaUrls.value[id] ?? '' : ''
}

function alignmentClass(block: PageBuilderBlock) {
  const value = stringData(block, 'editorDesignAlignment') || 'left'
  if (value === 'center') return 'preview-align-center'
  if (value === 'right') return 'preview-align-right'
  return 'preview-align-left'
}

function spacingClass(block: PageBuilderBlock) {
  const value = stringData(block, 'editorDesignSpacing') || 'normal'
  if (value === 'small') return 'preview-spacing-small'
  if (value === 'large') return 'preview-spacing-large'
  if (value === 'xlarge') return 'preview-spacing-xlarge'
  return 'preview-spacing-normal'
}

function backgroundClass(block: PageBuilderBlock) {
  const value = stringData(block, 'editorDesignBackground') || 'white'
  if (value === 'light') return 'preview-bg-light'
  if (value === 'corporate') return 'preview-bg-corporate'
  if (value === 'dark') return 'preview-bg-dark'
  if (value === 'image') return 'preview-bg-image'
  if (value === 'gradient') return 'preview-bg-gradient'
  return 'preview-bg-white'
}

function safeColor(value: unknown) {
  if (typeof value !== 'string') return ''
  const color = value.trim()
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) return color
  if (/^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color)) return color
  return ''
}

function firstSafeColor(block: PageBuilderBlock, keys: string[]) {
  for (const key of keys) {
    const color = safeColor(block.data[key])
    if (color) return color
  }
  return ''
}

function sectionStyle(block: PageBuilderBlock): Record<string, string> {
  const style: Record<string, string> = {
    '--preview-duration': `${block.animation?.duration ?? 600}ms`,
    '--preview-distance': `${block.animation?.distance ?? 32}px`,
  }
  const color = firstSafeColor(block, ['editorDesignColor', 'editorColor', 'textColor', 'color'])
  const backgroundColor = firstSafeColor(block, ['editorBackgroundColor', 'backgroundColor'])
  if (color) style.color = color
  if (backgroundColor) style.backgroundColor = backgroundColor
  return style
}

function animationClass(block: PageBuilderBlock) {
  const preset = block.animation?.preset ?? 'none'
  return preset === 'none' ? '' : `preview-motion-${preset}`
}

function animationKey(block: PageBuilderBlock) {
  const animation = block.animation
  return `${block.id}:${animation?.preset ?? 'none'}:${animation?.duration ?? 600}:${animation?.distance ?? 32}`
}

function heroLayout(block: PageBuilderBlock) {
  return stringData(block, 'editorLayoutPreset') || 'hero-centered-text'
}

function heroLayoutClass(block: PageBuilderBlock) {
  const layout = heroLayout(block)
  if (layout === 'hero-text-image') return 'preview-hero-text-image'
  if (layout === 'hero-image-text') return 'preview-hero-image-text'
  return 'preview-hero-centered'
}

function servicesPreset(block: PageBuilderBlock) {
  return stringData(block, 'editorBlockPreset') || 'services-3-cards'
}

function servicesCount(block: PageBuilderBlock) {
  return servicesPreset(block) === 'services-4-cards' ? 4 : 3
}

function releaseUrl(id: string) {
  const url = mediaUrls.value[id]
  if (url) URL.revokeObjectURL(url)
}

async function loadMedia(id: string) {
  if (mediaUrls.value[id] || failedMedia.value[id]) return
  try {
    const response = await downloadFile(`/api/content/media/${id}/content`, `preview-${id}`)
    const url = URL.createObjectURL(response.blob)
    if (!mediaIds.value.includes(id)) {
      URL.revokeObjectURL(url)
      return
    }
    mediaUrls.value = { ...mediaUrls.value, [id]: url }
  } catch {
    failedMedia.value = { ...failedMedia.value, [id]: true }
  }
}

function syncMedia() {
  const active = new Set(mediaIds.value)
  for (const id of Object.keys(mediaUrls.value)) {
    if (active.has(id)) continue
    releaseUrl(id)
    const next = { ...mediaUrls.value }
    delete next[id]
    mediaUrls.value = next
  }
  for (const id of mediaIds.value) void loadMedia(id)
}

watch(mediaKey, syncMedia, { immediate: true })

onBeforeUnmount(() => {
  for (const id of Object.keys(mediaUrls.value)) releaseUrl(id)
})
</script>

<template>
  <DhDevicePreview
    v-model="previewDevice"
    :labels="deviceLabels"
    :widths="deviceWidths"
    :framed="false"
    class="marketing-device-preview"
  >
    <template #default="{ device }">
      <div class="marketing-live-preview" :class="`preview-device-${device}`">
        <template v-if="visibleBlocks.length">
          <section
            v-for="block in visibleBlocks"
            :key="animationKey(block)"
            class="live-preview-section"
            :class="[
              alignmentClass(block),
              spacingClass(block),
              backgroundClass(block),
              animationClass(block),
              { 'preview-selected': selectedBlockId === block.id },
            ]"
            :style="sectionStyle(block)"
            @click="emit('select', block)"
          >
            <template v-if="blockKey(block) === 'divider'">
              <hr class="preview-divider" />
            </template>

            <template v-else-if="blockKey(block) === 'image'">
              <img
                v-if="mediaUrl(block)"
                :src="mediaUrl(block)"
                :alt="previewText(block)"
                class="preview-image"
              />
              <div v-else class="preview-media-placeholder">
                <ImageIcon class="h-7 w-7" />
                <span>{{ tr('Imagen', 'Image') }}</span>
              </div>
            </template>

            <template v-else-if="blockKey(block) === 'video' || (blockKey(block) === 'hero' && heroLayout(block) === 'hero-full-video')">
              <div class="preview-video-placeholder">
                <span class="preview-play"><Play class="h-5 w-5 fill-current" /></span>
                <div>
                  <p class="preview-eyebrow">{{ blockTitle(block) }}</p>
                  <p class="preview-copy-text">{{ previewText(block) }}</p>
                </div>
              </div>
            </template>

            <template v-else-if="blockKey(block) === 'gallery' || blockKey(block) === 'slider' || (blockKey(block) === 'hero' && heroLayout(block) === 'hero-slider')">
              <div class="preview-gallery">
                <div v-for="n in 3" :key="n" class="preview-gallery-card">
                  <ImageIcon class="h-5 w-5" />
                </div>
              </div>
            </template>

            <template v-else-if="blockKey(block) === 'services'">
              <div>
                <p class="preview-eyebrow">{{ blockTitle(block) }}</p>
                <h2 class="preview-heading">{{ previewText(block) }}</h2>
                <div class="preview-services" :class="{ 'preview-services-four': servicesCount(block) === 4 }">
                  <div v-for="n in servicesCount(block)" :key="n" class="preview-service-card">
                    <Sparkles class="h-5 w-5" />
                    <span>{{ tr('Servicio', 'Service') }} {{ n }}</span>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="blockKey(block) === 'hero'">
              <div class="preview-hero" :class="heroLayoutClass(block)">
                <div class="preview-hero-copy">
                  <p class="preview-eyebrow">{{ blockTitle(block) }}</p>
                  <h2 class="preview-heading preview-heading-hero">{{ previewText(block) }}</h2>
                  <p class="preview-description">{{ blockDescription(block) }}</p>
                </div>
                <div v-if="heroLayout(block) !== 'hero-centered-text'" class="preview-hero-media">
                  <img v-if="mediaUrl(block)" :src="mediaUrl(block)" :alt="previewText(block)" class="preview-image" />
                  <ImageIcon v-else class="h-8 w-8" />
                </div>
              </div>
            </template>

            <template v-else>
              <p class="preview-eyebrow">{{ blockTitle(block) }}</p>
              <button v-if="['button', 'cta', 'campaign'].includes(blockKey(block))" type="button" class="preview-button">
                {{ previewText(block) }}
              </button>
              <h2 v-else-if="blockKey(block) === 'heading'" class="preview-heading">{{ previewText(block) }}</h2>
              <p v-else class="preview-copy-text">{{ previewText(block) }}</p>
            </template>
          </section>
        </template>

        <iframe
          v-else-if="fallbackHtml"
          :title="tr('Vista publicada de respaldo', 'Published fallback preview')"
          :srcdoc="fallbackHtml"
          sandbox=""
          class="h-[440px] w-full border-0 bg-white"
        />

        <DhEmptyState
          v-else
          class="min-h-[320px]"
          :icon="Sparkles"
          :title="pageTitle || tr('Vista previa de la página', 'Page preview')"
          :description="tr('Agregue una sección para comenzar a ver los cambios aquí.', 'Add a section to start seeing changes here.')"
        />
      </div>
    </template>
  </DhDevicePreview>
</template>

<style scoped>
.marketing-device-preview{padding:1rem}.marketing-live-preview{min-height:440px;background:#fff;color:#111827}
.live-preview-section{position:relative;overflow:hidden;border-bottom:1px solid #e5e7eb;transition:box-shadow .2s ease,outline-color .2s ease;animation-duration:var(--preview-duration);animation-fill-mode:both;animation-timing-function:ease-out}
.live-preview-section:last-child{border-bottom:0}.preview-selected{z-index:1;outline:2px solid var(--dh-primary);outline-offset:-2px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dh-primary) 28%,transparent)}
.preview-align-left{text-align:left}.preview-align-center{text-align:center}.preview-align-right{text-align:right}
.preview-spacing-small{padding:1rem 1.25rem}.preview-spacing-normal{padding:2rem 1.5rem}.preview-spacing-large{padding:3rem 2rem}.preview-spacing-xlarge{padding:4rem 2.5rem}
.preview-bg-white{background:#fff}.preview-bg-light{background:#f8fafc}.preview-bg-corporate{background:var(--dh-primary);color:#fff}.preview-bg-dark{background:#111827;color:#fff}.preview-bg-image{background:linear-gradient(135deg,#f8fafc,#e2e8f0)}.preview-bg-gradient{background:linear-gradient(135deg,#111827,#334155,#64748b);color:#fff}
.preview-eyebrow{margin:0 0 .5rem;font-size:.65rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase;opacity:.65}.preview-heading{margin:0;font-size:clamp(1.35rem,3vw,2rem);font-weight:900;line-height:1.1}.preview-heading-hero{font-size:clamp(1.8rem,5vw,3.6rem)}.preview-description{margin:.8rem 0 0;max-width:46rem;font-size:.9rem;line-height:1.6;opacity:.72}.preview-copy-text{margin:0;font-size:1rem;line-height:1.7;white-space:pre-wrap}.preview-button{border:0;border-radius:999px;background:var(--dh-primary);padding:.75rem 1.15rem;color:#fff;font:inherit;font-weight:800}.preview-divider{margin:0;border:0;border-top:1px solid currentColor;opacity:.22}
.preview-image{display:block;max-height:360px;width:100%;border-radius:1rem;object-fit:cover}.preview-media-placeholder,.preview-video-placeholder{display:flex;min-height:180px;align-items:center;justify-content:center;gap:.75rem;border:1px dashed currentColor;border-radius:1rem;opacity:.72}.preview-play{display:grid;height:3rem;width:3rem;place-items:center;border-radius:999px;background:currentColor;color:#fff;mix-blend-mode:multiply}.preview-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem}.preview-gallery-card{display:grid;min-height:130px;place-items:center;border-radius:1rem;background:rgba(148,163,184,.18)}
.preview-hero{display:grid;align-items:center;gap:1.5rem}.preview-hero-centered{justify-items:center;text-align:center}.preview-hero-text-image,.preview-hero-image-text{grid-template-columns:minmax(0,1.1fr) minmax(180px,.9fr)}.preview-hero-image-text .preview-hero-media{order:-1}.preview-hero-media{display:grid;min-height:190px;place-items:center;overflow:hidden;border-radius:1rem;background:rgba(148,163,184,.18)}
.preview-services{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;margin-top:1rem}.preview-services-four{grid-template-columns:repeat(4,minmax(0,1fr))}.preview-service-card{display:flex;min-height:100px;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;border:1px solid rgba(148,163,184,.3);border-radius:1rem;background:rgba(255,255,255,.62);padding:.8rem;font-size:.8rem;font-weight:800;color:#334155}
.preview-motion-fade{animation-name:preview-fade}.preview-motion-fade-up,.preview-motion-slide-up{animation-name:preview-up}.preview-motion-fade-down{animation-name:preview-down}.preview-motion-fade-left,.preview-motion-slide-left{animation-name:preview-left}.preview-motion-fade-right,.preview-motion-slide-right{animation-name:preview-right}.preview-motion-zoom-in,.preview-motion-scale{animation-name:preview-zoom-in}.preview-motion-zoom-out{animation-name:preview-zoom-out}.preview-motion-blur-in{animation-name:preview-blur}
@keyframes preview-fade{from{opacity:0}to{opacity:1}}@keyframes preview-up{from{opacity:0;transform:translateY(var(--preview-distance))}to{opacity:1;transform:none}}@keyframes preview-down{from{opacity:0;transform:translateY(calc(var(--preview-distance) * -1))}to{opacity:1;transform:none}}@keyframes preview-left{from{opacity:0;transform:translateX(calc(var(--preview-distance) * -1))}to{opacity:1;transform:none}}@keyframes preview-right{from{opacity:0;transform:translateX(var(--preview-distance))}to{opacity:1;transform:none}}@keyframes preview-zoom-in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}@keyframes preview-zoom-out{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:none}}@keyframes preview-blur{from{opacity:0;filter:blur(8px)}to{opacity:1;filter:none}}
.preview-device-tablet .preview-services,.preview-device-tablet .preview-services-four{grid-template-columns:repeat(2,minmax(0,1fr))}
.preview-device-mobile .preview-hero-text-image,.preview-device-mobile .preview-hero-image-text{grid-template-columns:1fr}.preview-device-mobile .preview-hero-image-text .preview-hero-media{order:0}.preview-device-mobile .preview-services,.preview-device-mobile .preview-services-four{grid-template-columns:1fr}.preview-device-mobile .preview-gallery{grid-template-columns:1fr}.preview-device-mobile .preview-spacing-large{padding:2rem 1.25rem}.preview-device-mobile .preview-spacing-xlarge{padding:3rem 1.25rem}.preview-device-mobile .preview-heading-hero{font-size:2rem}
@media (max-width:720px){.preview-hero-text-image,.preview-hero-image-text{grid-template-columns:1fr}.preview-hero-image-text .preview-hero-media{order:0}.preview-services,.preview-services-four{grid-template-columns:repeat(2,minmax(0,1fr))}.preview-gallery{grid-template-columns:1fr}.preview-spacing-xlarge{padding:3rem 1.25rem}}
@media (prefers-reduced-motion:reduce){.live-preview-section{animation:none!important}}
</style>