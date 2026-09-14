<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlignCenter, AlignLeft, AlignRight, Copy, FileText, Image as ImageIcon, PanelRight, Palette, Sparkles, Trash2 } from 'lucide-vue-next'
import DhBadge from '@/shared/components/atoms/DhBadge.vue'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhEmptyState from '@/shared/components/atoms/DhEmptyState.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhSwitch from '@/shared/components/atoms/DhSwitch.vue'
import DhTextarea from '@/shared/components/atoms/DhTextarea.vue'
import type { CmsMotionPreset, PageBuilderBlock } from '@/core/interfaces/pageBuilder'
import { useLocale } from '@/core/stores/locale'
import MarketingAnimationLevelControls from '@/modules/marketing/components/MarketingAnimationLevelControls.vue'
import MarketingAnimationPicker from '@/modules/marketing/components/MarketingAnimationPicker.vue'
import MarketingBlockPresetPicker from '@/modules/marketing/components/MarketingBlockPresetPicker.vue'
import MarketingLayoutPresetPicker from '@/modules/marketing/components/MarketingLayoutPresetPicker.vue'
import MarketingMediaPicker, { type MarketingMediaSelection } from '@/modules/marketing/components/MarketingMediaPicker.vue'
import { localizeMarketingBlock } from '@/modules/marketing/config/marketingBlockCatalog'
import { getMarketingBlockDefinitionForBuilderBlock } from '@/modules/marketing/config/marketingPageBuilder'

export interface MarketingPropertyTextField {
  key: string
  value: string
  placeholder: string
}

export interface MarketingAnimationSettingsPatch {
  distance?: number
  duration?: number
}

type DesignPropertyKey = 'editorDesignAlignment' | 'editorDesignSpacing' | 'editorDesignBackground' | 'editorLayoutPreset' | 'editorBlockPreset'

const props = withDefaults(defineProps<{
  block: PageBuilderBlock | null
  textField?: MarketingPropertyTextField | null
  activeSection: string
  disabled?: boolean
}>(), {
  textField: null,
  disabled: false,
})

const emit = defineEmits<{
  'preview-text': [payload: { key: string; value: string }]
  'save-text': [payload: { key: string; value: string }]
  'save-animation': [preset: CmsMotionPreset]
  'save-animation-settings': [payload: MarketingAnimationSettingsPatch]
  'set-visibility': [value: boolean]
  duplicate: []
  delete: []
}>()

const localeStore = useLocale()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es
const draft = ref('')
const mediaPickerOpen = ref(false)

watch(
  [() => props.block?.id, () => props.textField?.value],
  ([blockId], [previousBlockId]) => {
    draft.value = props.textField?.value ?? ''
    if (blockId !== previousBlockId) mediaPickerOpen.value = false
  },
  { immediate: true },
)

const definition = computed(() => props.block ? getMarketingBlockDefinitionForBuilderBlock(props.block) : null)
const blockName = computed(() => definition.value
  ? localizeMarketingBlock(definition.value.title, localeStore.locale)
  : tr('Sección', 'Section'))
const blockDescription = computed(() => definition.value
  ? localizeMarketingBlock(definition.value.description, localeStore.locale)
  : tr('Contenido de la página.', 'Page content.'))
const isLongText = computed(() => ['text', 'body', 'content'].includes(props.textField?.key ?? ''))
const contentLabel = computed(() => {
  const key = props.textField?.key
  if (key === 'label') return tr('Texto del botón', 'Button text')
  if (isLongText.value) return tr('Texto', 'Text')
  return tr('Título', 'Title')
})
const animationPreset = computed<CmsMotionPreset>(() => props.block?.animation?.preset ?? 'none')
const animationConfigured = computed(() => animationPreset.value !== 'none')
const animationDistance = computed(() => props.block?.animation?.distance ?? 32)
const animationDuration = computed(() => props.block?.animation?.duration ?? 600)

const editorBlockKey = computed(() => typeof props.block?.data.editorBlockKey === 'string'
  ? props.block.data.editorBlockKey
  : null)
const isHeroLayoutBlock = computed(() => editorBlockKey.value === 'hero' || props.block?.type.toLocaleLowerCase('en-US') === 'hero')
const isServicesPresetBlock = computed(() => editorBlockKey.value === 'services' || props.block?.type.toLocaleLowerCase('en-US') === 'servicesgrid')
const isImageMediaBlock = computed(() => editorBlockKey.value === 'image' || props.block?.type.toLocaleLowerCase('en-US') === 'image')
const selectedMediaId = computed(() => typeof props.block?.data.editorMediaId === 'string' ? props.block.data.editorMediaId : null)
const layoutPreset = computed(() => typeof props.block?.data.editorLayoutPreset === 'string'
  ? props.block.data.editorLayoutPreset
  : 'hero-centered-text')
const blockPreset = computed(() => typeof props.block?.data.editorBlockPreset === 'string'
  ? props.block.data.editorBlockPreset
  : 'services-3-cards')
const designAlignment = computed(() => typeof props.block?.data.editorDesignAlignment === 'string'
  ? props.block.data.editorDesignAlignment
  : 'left')
const designSpacing = computed(() => typeof props.block?.data.editorDesignSpacing === 'string'
  ? props.block.data.editorDesignSpacing
  : 'normal')
const designBackground = computed(() => typeof props.block?.data.editorDesignBackground === 'string'
  ? props.block.data.editorDesignBackground
  : 'white')

const alignmentOptions = computed(() => [
  { value: 'left', label: tr('Izquierda', 'Left'), icon: AlignLeft },
  { value: 'center', label: tr('Centro', 'Center'), icon: AlignCenter },
  { value: 'right', label: tr('Derecha', 'Right'), icon: AlignRight },
])

const spacingOptions = computed(() => [
  { value: 'small', label: tr('Pequeño', 'Small') },
  { value: 'normal', label: tr('Normal', 'Normal') },
  { value: 'large', label: tr('Grande', 'Large') },
  { value: 'xlarge', label: tr('Muy grande', 'Extra large') },
])

const backgroundOptions = computed(() => [
  { value: 'white', label: tr('Blanco', 'White') },
  { value: 'light', label: tr('Claro', 'Light') },
  { value: 'corporate', label: tr('Corporativo', 'Corporate') },
  { value: 'dark', label: tr('Oscuro', 'Dark') },
  { value: 'image', label: tr('Imagen', 'Image') },
  { value: 'gradient', label: tr('Gradiente', 'Gradient') },
])

function previewText(value: unknown) {
  if (!props.textField) return
  emit('preview-text', { key: props.textField.key, value: String(value ?? '') })
}

function saveText() {
  if (!props.textField) return
  const value = draft.value.trim()
  if (value === props.textField.value) return
  emit('save-text', { key: props.textField.key, value })
}

function saveDesignPreference(key: DesignPropertyKey, value: string, current: string) {
  if (props.disabled || value === current) return
  emit('save-text', { key, value })
}

function saveLayoutPreset(value: string) {
  saveDesignPreference('editorLayoutPreset', value, layoutPreset.value)
}

function saveBlockPreset(value: string) {
  saveDesignPreference('editorBlockPreset', value, blockPreset.value)
}

function saveMediaSelection(value: MarketingMediaSelection) {
  mediaPickerOpen.value = false
  if (props.disabled || value.id === selectedMediaId.value) return
  emit('save-text', { key: 'editorMediaId', value: value.id })
}

function saveAnimation(preset: CmsMotionPreset) {
  if (props.disabled || preset === animationPreset.value) return
  emit('save-animation', preset)
}

function saveAnimationDistance(distance: number) {
  if (props.disabled || distance === animationDistance.value) return
  emit('save-animation-settings', { distance })
}

function saveAnimationDuration(duration: number) {
  if (props.disabled || duration === animationDuration.value) return
  emit('save-animation-settings', { duration })
}
</script>

<template>
  <DhEmptyState
    v-if="!block"
    :icon="PanelRight"
    :title="tr('Seleccione una sección', 'Select a section')"
    :description="tr('Haga clic en una sección de la página para ver sus propiedades.', 'Click a page section to view its properties.')"
  />

  <div v-else class="space-y-4">
    <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
      <p class="text-sm font-black text-[var(--dh-text)]">{{ blockName }}</p>
      <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ blockDescription }}</p>
    </div>

    <template v-if="activeSection === 'content'">
      <div class="space-y-4">
        <div v-if="textField" class="space-y-3">
          <DhTextarea
            v-if="isLongText"
            v-model="draft"
            :label="contentLabel"
            :placeholder="textField.placeholder"
            :disabled="disabled"
            :rows="5"
            @update:model-value="previewText"
          />
          <DhInput
            v-else
            v-model="draft"
            :label="contentLabel"
            :placeholder="textField.placeholder"
            :disabled="disabled"
            @update:model-value="previewText"
          />
          <DhButton
            :label="tr('Guardar contenido', 'Save content')"
            :icon="FileText"
            size="sm"
            :disabled="disabled || draft.trim() === textField.value"
            @click="saveText"
          />
        </div>

        <section v-if="isImageMediaBlock" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <div class="flex items-start gap-3">
            <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black/[0.05] text-[var(--dh-primary)] dark:bg-white/[0.08]">
              <ImageIcon class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-black text-[var(--dh-text)]">{{ tr('Imagen', 'Image') }}</p>
              <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">
                {{ selectedMediaId ? tr('Hay una imagen seleccionada para esta sección.', 'An image is selected for this section.') : tr('Seleccione una imagen desde la biblioteca multimedia.', 'Choose an image from the media library.') }}
              </p>
              <DhButton
                class="mt-3"
                :label="selectedMediaId ? tr('Cambiar imagen', 'Change image') : tr('Seleccionar imagen', 'Select image')"
                :icon="ImageIcon"
                variant="secondary"
                size="sm"
                :disabled="disabled"
                @click="mediaPickerOpen = true"
              />
            </div>
          </div>
        </section>

        <DhEmptyState
          v-if="!textField && !isImageMediaBlock"
          :icon="FileText"
          :title="tr('Sin texto directo', 'No direct text')"
          :description="tr('Este tipo de sección no tiene un campo de texto principal para editar desde aquí.', 'This section type does not have a primary text field to edit here.')"
        />
      </div>

      <MarketingMediaPicker
        v-if="isImageMediaBlock"
        :open="mediaPickerOpen"
        :model-value="selectedMediaId"
        :disabled="disabled"
        @select="saveMediaSelection"
        @close="mediaPickerOpen = false"
      />
    </template>

    <template v-else-if="activeSection === 'design'">
      <div class="space-y-5">
        <section v-if="isHeroLayoutBlock" class="space-y-2">
          <div>
            <p class="text-xs font-black uppercase tracking-[.1em] text-[var(--dh-text)]">{{ tr('Diseño del Hero', 'Hero layout') }}</p>
            <p class="mt-1 text-[11px] leading-5 text-[var(--dh-text-muted)]">{{ tr('Elija un diseño visual. No necesita configurar columnas manualmente.', 'Choose a visual layout. You do not need to configure columns manually.') }}</p>
          </div>
          <MarketingLayoutPresetPicker :model-value="layoutPreset" :disabled="disabled" @select="saveLayoutPreset" />
        </section>

        <section v-if="isServicesPresetBlock" class="space-y-2">
          <div>
            <p class="text-xs font-black uppercase tracking-[.1em] text-[var(--dh-text)]">{{ tr('Diseño de Servicios', 'Services design') }}</p>
            <p class="mt-1 text-[11px] leading-5 text-[var(--dh-text-muted)]">{{ tr('Elija un diseño preparado para presentar sus servicios.', 'Choose a prepared design for presenting your services.') }}</p>
          </div>
          <MarketingBlockPresetPicker :model-value="blockPreset" :disabled="disabled" @select="saveBlockPreset" />
        </section>

        <section class="space-y-2">
          <div>
            <p class="text-xs font-black uppercase tracking-[.1em] text-[var(--dh-text)]">{{ tr('Alineación', 'Alignment') }}</p>
            <p class="mt-1 text-[11px] leading-5 text-[var(--dh-text-muted)]">{{ tr('Elija cómo se acomoda el contenido principal.', 'Choose how the main content is aligned.') }}</p>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <DhButton
              v-for="option in alignmentOptions"
              :key="option.value"
              :label="option.label"
              :icon="option.icon"
              :variant="designAlignment === option.value ? 'primary' : 'secondary'"
              size="sm"
              :disabled="disabled"
              @click="saveDesignPreference('editorDesignAlignment', option.value, designAlignment)"
            />
          </div>
        </section>

        <section class="space-y-2">
          <div>
            <p class="text-xs font-black uppercase tracking-[.1em] text-[var(--dh-text)]">{{ tr('Espaciado', 'Spacing') }}</p>
            <p class="mt-1 text-[11px] leading-5 text-[var(--dh-text-muted)]">{{ tr('Controle cuánto aire tiene la sección sin usar medidas técnicas.', 'Control how much breathing room the section has without technical measurements.') }}</p>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <DhButton
              v-for="option in spacingOptions"
              :key="option.value"
              :label="option.label"
              :variant="designSpacing === option.value ? 'primary' : 'secondary'"
              size="sm"
              :disabled="disabled"
              @click="saveDesignPreference('editorDesignSpacing', option.value, designSpacing)"
            />
          </div>
        </section>

        <section class="space-y-2">
          <div class="flex items-center gap-2">
            <Palette class="h-4 w-4 text-[var(--dh-primary)]" />
            <p class="text-xs font-black uppercase tracking-[.1em] text-[var(--dh-text)]">{{ tr('Fondo', 'Background') }}</p>
          </div>
          <p class="text-[11px] leading-5 text-[var(--dh-text-muted)]">{{ tr('Seleccione el estilo general del fondo de la sección.', 'Choose the section’s overall background style.') }}</p>
          <div class="grid grid-cols-2 gap-2">
            <DhButton
              v-for="option in backgroundOptions"
              :key="option.value"
              :label="option.label"
              :variant="designBackground === option.value ? 'primary' : 'secondary'"
              size="sm"
              :disabled="disabled"
              @click="saveDesignPreference('editorDesignBackground', option.value, designBackground)"
            />
          </div>
        </section>
      </div>
    </template>

    <template v-else-if="activeSection === 'animation'">
      <div class="space-y-4">
        <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Sparkles class="h-4 w-4 text-[var(--dh-primary)]" />
              <span class="text-sm font-black text-[var(--dh-text)]">{{ tr('Animación', 'Animation') }}</span>
            </div>
            <DhBadge :label="animationConfigured ? tr('Configurada', 'Configured') : tr('Sin animación', 'No animation')" :variant="animationConfigured ? 'primary' : 'neutral'" />
          </div>
          <p class="mt-3 text-xs leading-5 text-[var(--dh-text-muted)]">
            {{ tr('Pase el cursor sobre cada opción para ver una vista previa y haga clic para aplicarla.', 'Hover over each option to preview it, then click to apply it.') }}
          </p>
        </div>

        <MarketingAnimationPicker
          :model-value="animationPreset"
          :disabled="disabled"
          @select="saveAnimation"
        />

        <MarketingAnimationLevelControls
          :distance="animationDistance"
          :duration="animationDuration"
          :disabled="disabled"
          @update-distance="saveAnimationDistance"
          @update-duration="saveAnimationDuration"
        />
      </div>
    </template>

    <template v-else-if="activeSection === 'advanced'">
      <div class="space-y-4">
        <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <DhSwitch
            :model-value="block.isVisible"
            :label="tr('Mostrar sección', 'Show section')"
            :description="tr('Controle si esta sección aparece en la página.', 'Control whether this section appears on the page.')"
            :disabled="disabled"
            @update:model-value="emit('set-visibility', $event)"
          />
        </div>
        <div class="grid gap-2">
          <DhButton
            :label="tr('Duplicar sección', 'Duplicate section')"
            :icon="Copy"
            variant="secondary"
            size="sm"
            :disabled="disabled"
            @click="emit('duplicate')"
          />
          <DhButton
            :label="tr('Eliminar sección', 'Delete section')"
            :icon="Trash2"
            variant="danger"
            size="sm"
            :disabled="disabled"
            @click="emit('delete')"
          />
        </div>
      </div>
    </template>
  </div>
</template>
