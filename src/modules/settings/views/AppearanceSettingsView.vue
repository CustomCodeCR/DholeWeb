<script setup lang="ts">
import {
  Check,
  HardDrive,
  Image,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Sun,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhColorPicker, DhRange } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useThemeStore, type ThemeMode } from '@/core/stores/themeStore'
import { useLocale, type LocaleCode } from '@/core/stores/locale'
import { useShortcutStore } from '@/core/stores/shortcutStore'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'
import { useBrandingStore } from '@/core/stores/brandingStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DEFAULT_CLIENT_BRANDING, type ClientBrandingSettings } from '@/core/interfaces/branding'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'

const { t } = useI18n()
const themeStore = useThemeStore()
const localeStore = useLocale()
const shortcutStore = useShortcutStore()
const tabsStore = useWorkspaceTabsStore()
const brandingStore = useBrandingStore()
const toastStore = useToastStore()
const backgroundInput = ref<HTMLInputElement | null>(null)

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'appearance.light', icon: Sun },
  { value: 'dark', label: 'appearance.dark', icon: Moon },
  { value: 'system', label: 'appearance.system', icon: Monitor },
]

const localeOptions: { value: LocaleCode; label: string }[] = [
  { value: 'es', label: 'appearance.spanish' },
  { value: 'en', label: 'appearance.english' },
]

const brandingForm = ref<ClientBrandingSettings>({ ...DEFAULT_CLIENT_BRANDING })

const overlayPercent = computed(() =>
  Math.round(Number(brandingForm.value.backgroundOverlayOpacity ?? 0) * 100),
)

const brandingPreviewStyle = computed(() => ({
  backgroundColor: brandingForm.value.primaryColor,
  backgroundImage: brandingStore.localBackgroundUrl
    ? `linear-gradient(rgb(0 0 0 / ${brandingForm.value.backgroundOverlayOpacity ?? 0.5}), rgb(0 0 0 / ${brandingForm.value.backgroundOverlayOpacity ?? 0.5})), url("${brandingStore.localBackgroundUrl.replace(/["\\\n\r]/g, '')}")`
    : undefined,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
}))

function syncBrandingForm() {
  brandingForm.value = {
    ...DEFAULT_CLIENT_BRANDING,
    ...brandingStore.settings,
    backgroundImageUrl: null,
    backgroundOverlayOpacity: brandingStore.localBackgroundOverlayOpacity,
  }
}

function previewBranding() {
  brandingStore.preview(brandingForm.value)
}

function resetBranding() {
  brandingForm.value = {
    ...DEFAULT_CLIENT_BRANDING,
    clientId: brandingStore.settings.clientId,
    clientCode: brandingStore.settings.clientCode,
    clientName: brandingStore.settings.clientName,
    backgroundImageUrl: null,
    backgroundOverlayOpacity: brandingStore.localBackgroundOverlayOpacity,
  }

  previewBranding()
}

async function saveBranding() {
  const result = await brandingStore.saveForCurrentClient({
    clientId: brandingForm.value.clientId,
    clientCode: brandingForm.value.clientCode,
    primaryColor: brandingForm.value.primaryColor,
  })

  syncBrandingForm()

  if (result.synced) {
    toastStore.success(
      t('appearance.toasts.brandingSavedTitle'),
      t('appearance.toasts.brandingSavedMessage'),
    )
    return
  }

  toastStore.warning(
    t('appearance.toasts.brandingLocalTitle'),
    t('appearance.toasts.brandingLocalMessage'),
  )
}

function openBackgroundPicker() {
  backgroundInput.value?.click()
}

async function handleBackgroundSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    await brandingStore.setLocalBackground(
      file,
      Number(brandingForm.value.backgroundOverlayOpacity ?? 0.5),
    )
    syncBrandingForm()
    toastStore.success(
      t('appearance.toasts.backgroundSavedTitle'),
      t('appearance.toasts.backgroundSavedMessage'),
    )
  } catch (error) {
    toastStore.error(
      t('appearance.toasts.backgroundErrorTitle'),
      error instanceof Error ? error.message : t('appearance.toasts.backgroundErrorMessage'),
    )
  } finally {
    input.value = ''
  }
}

function previewOverlay(value?: number) {
  if (typeof value === 'number') {
    brandingForm.value.backgroundOverlayOpacity = value
  }

  brandingStore.previewLocalBackgroundOverlay(
    Number(brandingForm.value.backgroundOverlayOpacity ?? 0.5),
  )
}

async function persistOverlay(value?: number) {
  if (typeof value === 'number') {
    brandingForm.value.backgroundOverlayOpacity = value
  }

  if (!brandingStore.hasLocalBackground) return

  try {
    await brandingStore.persistLocalBackgroundOverlay(
      Number(brandingForm.value.backgroundOverlayOpacity ?? 0.5),
    )
  } catch {
    toastStore.error(
      t('appearance.toasts.overlayErrorTitle'),
      t('appearance.toasts.overlayErrorMessage'),
    )
  }
}

async function removeBackground() {
  try {
    await brandingStore.removeLocalBackground()
    brandingForm.value.backgroundOverlayOpacity = brandingStore.localBackgroundOverlayOpacity
    toastStore.success(
      t('appearance.toasts.backgroundRemovedTitle'),
      t('appearance.toasts.backgroundRemovedMessage'),
    )
  } catch {
    toastStore.error(
      t('appearance.toasts.backgroundRemoveErrorTitle'),
      t('appearance.toasts.backgroundRemoveErrorMessage'),
    )
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function refreshAppearanceSettings() {
  await brandingStore.loadCurrentClientBranding()
  syncBrandingForm()
}

useViewShortcuts({ save: saveBranding, refresh: refreshAppearanceSettings, autoRefresh: false })

onMounted(refreshAppearanceSettings)
</script>

<template>
  <section class="space-y-4 sm:space-y-6">
    <DhPageHeader
      :title="t('appearance.title')"
      :subtitle="t('appearance.subtitle')"
      :icon="Palette"
    />

    <section class="grid gap-4 xl:grid-cols-2">
      <DhCard :title="t('appearance.theme')" :subtitle="t('appearance.themeHelp')">
        <div class="grid gap-3 sm:grid-cols-3">
          <DhCard
            v-for="option in themeOptions"
            :key="option.value"
            as="button"
            :interactive="true"
            padding="sm"
            class="relative"
            :class="themeStore.mode === option.value && 'dh-primary-selected'"
            @click="themeStore.setTheme(option.value)"
          >
            <component :is="option.icon" class="h-5 w-5 text-[var(--dh-primary)]" />
            <p class="mt-3 text-sm font-black text-[var(--dh-text)]">{{ t(option.label) }}</p>
            <Check
              v-if="themeStore.mode === option.value"
              class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]"
            />
          </DhCard>
        </div>
      </DhCard>

      <DhCard :title="t('appearance.language')" :subtitle="t('appearance.languageHelp')">
        <div class="grid gap-3 sm:grid-cols-2">
          <DhCard
            v-for="option in localeOptions"
            :key="option.value"
            as="button"
            :interactive="true"
            padding="sm"
            class="relative"
            :class="localeStore.locale === option.value && 'dh-primary-selected'"
            @click="localeStore.setLocale(option.value)"
          >
            <p class="text-sm font-black text-[var(--dh-text)]">{{ t(option.label) }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ option.value.toUpperCase() }}
            </p>
            <Check
              v-if="localeStore.locale === option.value"
              class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]"
            />
          </DhCard>
        </div>
      </DhCard>
    </section>

    <DhCard
      :title="t('appearance.liquidCrystal')"
      :subtitle="t('appearance.liquidCrystalHelp')"
    >
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <DhRange
          :model-value="themeStore.liquidBlur"
          :label="t('appearance.blur')"
          :value-label="t('appearance.blurValue', { value: themeStore.liquidBlur })"
          :help="t('appearance.blurHelp')"
          :min="0"
          :max="48"
          :step="1"
          @update:model-value="themeStore.setLiquidBlur"
        />
        <DhButton
          :label="t('appearance.resetBlur')"
          variant="secondary"
          :icon="RotateCcw"
          @click="themeStore.resetLiquidBlur()"
        />
      </div>
    </DhCard>

    <DhCard
      :title="t('appearance.brandingTitle')"
      :subtitle="t('appearance.brandingSubtitle')"
    >
      <template #actions>
        <span class="hidden text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)] md:block">
          {{ t('appearance.activeClient', { client: brandingStore.clientLabel }) }}
        </span>
      </template>

      <div class="flex flex-wrap gap-2 sm:gap-3">
        <DhButton
          :label="t('appearance.previewColor')"
          variant="secondary"
          :icon="Image"
          @click="previewBranding"
        />
        <DhButton
          :label="t('appearance.restoreColor')"
          variant="secondary"
          :icon="RotateCcw"
          @click="resetBranding"
        />
        <DhButton
          :label="t('appearance.saveColor')"
          :icon="Save"
          :loading="brandingStore.saving"
          @click="saveBranding"
        />
      </div>

      <p class="mt-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)] md:hidden">
        {{ t('appearance.activeClient', { client: brandingStore.clientLabel }) }}
      </p>

      <div class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="space-y-5">
          <DhColorPicker
            v-model="brandingForm.primaryColor"
            :label="t('appearance.primaryColor')"
            @update:model-value="previewBranding"
          />

          <DhCard
            :title="t('appearance.localBackground')"
            :subtitle="t('appearance.localBackgroundHelp')"
            :icon="HardDrive"
            padding="sm"
          >
            <div class="flex flex-wrap gap-2">
              <input
                ref="backgroundInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleBackgroundSelected"
              />
              <DhButton
                :label="brandingStore.hasLocalBackground ? t('appearance.changeImage') : t('appearance.selectImage')"
                variant="secondary"
                :icon="Upload"
                :loading="brandingStore.localBackgroundLoading"
                @click="openBackgroundPicker"
              />
              <DhButton
                v-if="brandingStore.hasLocalBackground"
                :label="t('appearance.removeBackground')"
                variant="secondary"
                :icon="Trash2"
                @click="removeBackground"
              />
            </div>

            <div
              v-if="brandingStore.localBackgroundInfo"
              class="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]"
            >
              <span class="max-w-full truncate font-black text-[var(--dh-text)]">
                {{ brandingStore.localBackgroundInfo.fileName }}
              </span>
              <span>{{ formatBytes(brandingStore.localBackgroundInfo.size) }}</span>
              <span>{{ brandingStore.localBackgroundInfo.mimeType }}</span>
            </div>
          </DhCard>

          <DhRange
            :model-value="Number(brandingForm.backgroundOverlayOpacity ?? 0.5)"
            :label="t('appearance.overlayLabel')"
            :value-label="t('appearance.overlayValue', { value: overlayPercent })"
            :help="t('appearance.overlayHelp')"
            :min="0"
            :max="0.95"
            :step="0.05"
            :disabled="!brandingStore.hasLocalBackground"
            @update:model-value="previewOverlay"
            @change="persistOverlay"
          />
        </div>

        <aside
          class="min-h-64 rounded-[32px] border border-[var(--dh-border)] p-4 shadow-[var(--dh-shadow-sm)]"
          :style="brandingPreviewStyle"
        >
          <div class="rounded-[26px] border border-white/20 bg-black/30 p-5 text-white backdrop-blur-xl">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-[22px] bg-white/20 text-lg font-black">
              D
            </div>
            <p class="text-sm font-black uppercase tracking-[0.16em] opacity-75">
              {{ t('appearance.preview') }}
            </p>
            <h3 class="mt-2 text-2xl font-black">{{ brandingStore.clientLabel }}</h3>
            <p class="mt-2 text-sm font-semibold opacity-80">
              {{
                brandingStore.hasLocalBackground
                  ? t('appearance.previewWithBackground')
                  : t('appearance.previewWithoutBackground')
              }}
            </p>
          </div>
        </aside>
      </div>
    </DhCard>

    <DhCard
      :title="t('appearance.localPreferences')"
      :subtitle="t('appearance.localPreferencesHelp')"
    >
      <div class="flex flex-wrap gap-3">
        <DhButton
          :label="t('appearance.resetWorkspace')"
          variant="secondary"
          @click="tabsStore.clear()"
        />
        <DhButton
          :label="t('appearance.resetShortcuts')"
          variant="secondary"
          @click="shortcutStore.reset()"
        />
      </div>
    </DhCard>
  </section>
</template>
