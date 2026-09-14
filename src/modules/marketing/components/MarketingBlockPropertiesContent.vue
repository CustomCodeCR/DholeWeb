<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlignCenter, AlignLeft, AlignRight, Copy, FileText, PanelRight, Palette, Sparkles, Trash2 } from 'lucide-vue-next'
import DhBadge from '@/shared/components/atoms/DhBadge.vue'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhEmptyState from '@/shared/components/atoms/DhEmptyState.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhSwitch from '@/shared/components/atoms/DhSwitch.vue'
import DhTextarea from '@/shared/components/atoms/DhTextarea.vue'
import type { PageBuilderBlock } from '@/core/interfaces/pageBuilder'
import { useLocale } from '@/core/stores/locale'
import { localizeMarketingBlock } from '@/modules/marketing/config/marketingBlockCatalog'
import { getMarketingBlockDefinitionForBuilderBlock } from '@/modules/marketing/config/marketingPageBuilder'

export interface MarketingPropertyTextField {
  key: string
  value: string
  placeholder: string
}

type DesignPropertyKey = 'editorDesignAlignment' | 'editorDesignSpacing' | 'editorDesignBackground'

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
  'save-text': [payload: { key: string; value: string }]
  'set-visibility': [value: boolean]
  duplicate: []
  delete: []
}>()

const localeStore = useLocale()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es
const draft = ref('')

watch(
  [() => props.block?.id, () => props.textField?.value],
  () => { draft.value = props.textField?.value ?? '' },
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
const animationConfigured = computed(() => Boolean(props.block?.animation && props.block.animation.preset !== 'none'))

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
      <div v-if="textField" class="space-y-3">
        <DhTextarea
          v-if="isLongText"
          v-model="draft"
          :label="contentLabel"
          :placeholder="textField.placeholder"
          :disabled="disabled"
          :rows="5"
        />
        <DhInput
          v-else
          v-model="draft"
          :label="contentLabel"
          :placeholder="textField.placeholder"
          :disabled="disabled"
        />
        <DhButton
          :label="tr('Guardar contenido', 'Save content')"
          :icon="FileText"
          size="sm"
          :disabled="disabled || draft.trim() === textField.value"
          @click="saveText"
        />
      </div>
      <DhEmptyState
        v-else
        :icon="FileText"
        :title="tr('Sin texto directo', 'No direct text')"
        :description="tr('Este tipo de sección no tiene un campo de texto principal para editar desde aquí.', 'This section type does not have a primary text field to edit here.')"
      />
    </template>

    <template v-else-if="activeSection === 'design'">
      <div class="space-y-5">
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
      <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <Sparkles class="h-4 w-4 text-[var(--dh-primary)]" />
            <span class="text-sm font-black text-[var(--dh-text)]">{{ tr('Animación', 'Animation') }}</span>
          </div>
          <DhBadge :label="animationConfigured ? tr('Configurada', 'Configured') : tr('Sin animación', 'No animation')" :variant="animationConfigured ? 'primary' : 'neutral'" />
        </div>
        <p class="mt-3 text-xs leading-5 text-[var(--dh-text-muted)]">
          {{ tr('La animación se administrará mediante opciones visuales comprensibles.', 'Animation is managed through understandable visual options.') }}
        </p>
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
