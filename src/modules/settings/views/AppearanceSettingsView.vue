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
import { DhPageHeader } from '@/shared/components/organisms'
import { DhButton } from '@/shared/components/atoms'
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
      'Branding guardado',
      'El color quedó guardado para este cliente. La imagen de fondo permanece únicamente en este navegador.',
    )
    return
  }

  toastStore.warning(
    'Color aplicado localmente',
    'El backend todavía no respondió el endpoint de branding; el color quedó cacheado en este navegador.',
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
      'Fondo guardado en este navegador',
      'La imagen se guardó localmente y no se envió al servidor ni al servicio de Storage.',
    )
  } catch (error) {
    toastStore.error(
      'No se pudo usar la imagen',
      error instanceof Error
        ? error.message
        : 'No fue posible guardar la imagen en este navegador.',
    )
  } finally {
    input.value = ''
  }
}

function previewOverlay() {
  brandingStore.previewLocalBackgroundOverlay(
    Number(brandingForm.value.backgroundOverlayOpacity ?? 0.5),
  )
}

async function persistOverlay() {
  if (!brandingStore.hasLocalBackground) return

  try {
    await brandingStore.persistLocalBackgroundOverlay(
      Number(brandingForm.value.backgroundOverlayOpacity ?? 0.5),
    )
  } catch {
    toastStore.error(
      'No se pudo guardar la opacidad',
      'El navegador no pudo persistir esta preferencia local.',
    )
  }
}

async function removeBackground() {
  try {
    await brandingStore.removeLocalBackground()
    brandingForm.value.backgroundOverlayOpacity = brandingStore.localBackgroundOverlayOpacity
    toastStore.success('Fondo eliminado', 'La imagen local se eliminó de este navegador.')
  } catch {
    toastStore.error('No se pudo eliminar el fondo', 'El navegador no pudo borrar la imagen local.')
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
  <section class="space-y-6">
    <DhPageHeader
      :title="t('appearance.title')"
      :subtitle="t('appearance.subtitle')"
      :icon="Palette"
    />

    <section class="grid gap-5 xl:grid-cols-2">
      <article class="dh-glass dh-liquid rounded-[32px] p-6">
        <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('appearance.theme') }}</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          Cambie el modo visual general del sistema.
        </p>

        <div class="mt-5 grid gap-3 md:grid-cols-3">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            class="relative rounded-[26px] border p-4 text-left transition hover:bg-[var(--dh-card-hover)]"
            :class="
              themeStore.mode === option.value
                ? 'dh-primary-selected'
                : 'border-[var(--dh-border)] bg-[var(--dh-card)]'
            "
            @click="themeStore.setTheme(option.value)"
          >
            <component :is="option.icon" class="h-5 w-5 text-[var(--dh-primary)]" />
            <p class="mt-3 text-sm font-black text-[var(--dh-text)]">{{ t(option.label) }}</p>
            <Check
              v-if="themeStore.mode === option.value"
              class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]"
            />
          </button>
        </div>
      </article>

      <article class="dh-glass dh-liquid rounded-[32px] p-6">
        <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('appearance.language') }}</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          Cambie el idioma de la interfaz.
        </p>

        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <button
            v-for="option in localeOptions"
            :key="option.value"
            type="button"
            class="relative rounded-[26px] border p-4 text-left transition hover:bg-[var(--dh-card-hover)]"
            :class="
              localeStore.locale === option.value
                ? 'dh-primary-selected'
                : 'border-[var(--dh-border)] bg-[var(--dh-card)]'
            "
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
          </button>
        </div>
      </article>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">Branding y fondo del sistema</h2>
          <p class="mt-1 max-w-3xl text-sm font-semibold text-[var(--dh-text-muted)]">
            El color principal pertenece al branding del cliente. La imagen de fondo es una
            preferencia privada del navegador actual.
          </p>
          <p
            class="mt-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]"
          >
            Cliente activo: {{ brandingStore.clientLabel }}
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <DhButton
            label="Previsualizar color"
            variant="secondary"
            :icon="Image"
            @click="previewBranding"
          />
          <DhButton
            label="Restaurar color"
            variant="secondary"
            :icon="RotateCcw"
            @click="resetBranding"
          />
          <DhButton
            label="Guardar color"
            :icon="Save"
            :loading="brandingStore.saving"
            @click="saveBranding"
          />
        </div>
      </div>

      <div class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="space-y-5">
          <label class="block">
            <span
              class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
              >Color principal</span
            >
            <div
              class="flex h-11 items-center gap-3 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl dh-focus-primary"
            >
              <input
                v-model="brandingForm.primaryColor"
                type="color"
                class="h-7 w-10 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                @input="previewBranding"
              />
              <input
                v-model="brandingForm.primaryColor"
                type="text"
                class="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:font-medium placeholder:text-[var(--dh-text-muted)]"
                placeholder="#fc2800"
                @input="previewBranding"
              />
            </div>
          </label>

          <div
            class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 shadow-[var(--dh-shadow-sm)]"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <div class="flex items-center gap-2 text-[var(--dh-text)]">
                  <HardDrive class="h-5 w-5 text-[var(--dh-primary)]" />
                  <h3 class="text-sm font-black">Imagen de fondo local</h3>
                </div>
                <p
                  class="mt-2 max-w-2xl text-xs font-semibold leading-5 text-[var(--dh-text-muted)]"
                >
                  Seleccione JPG, PNG, WEBP u otra imagen compatible. Se guarda en IndexedDB de este
                  navegador y nunca se sube a Config, Storage ni otra API.
                </p>
              </div>

              <div class="flex shrink-0 flex-wrap gap-2">
                <input
                  ref="backgroundInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleBackgroundSelected"
                />
                <DhButton
                  :label="
                    brandingStore.hasLocalBackground ? 'Cambiar imagen' : 'Seleccionar imagen'
                  "
                  variant="secondary"
                  :icon="Upload"
                  :loading="brandingStore.localBackgroundLoading"
                  @click="openBackgroundPicker"
                />
                <DhButton
                  v-if="brandingStore.hasLocalBackground"
                  label="Quitar fondo"
                  variant="secondary"
                  :icon="Trash2"
                  @click="removeBackground"
                />
              </div>
            </div>

            <div
              v-if="brandingStore.localBackgroundInfo"
              class="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]"
            >
              <span class="max-w-full truncate font-black text-[var(--dh-text)]">{{
                brandingStore.localBackgroundInfo.fileName
              }}</span>
              <span>{{ formatBytes(brandingStore.localBackgroundInfo.size) }}</span>
              <span>{{ brandingStore.localBackgroundInfo.mimeType }}</span>
            </div>
          </div>

          <label class="block">
            <span
              class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
            >
              Oscurecer / aclarar imagen: {{ overlayPercent }}%
            </span>
            <input
              v-model.number="brandingForm.backgroundOverlayOpacity"
              type="range"
              min="0"
              max="0.95"
              step="0.05"
              :disabled="!brandingStore.hasLocalBackground"
              class="w-full accent-[var(--dh-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              @input="previewOverlay"
              @change="persistOverlay"
            />
            <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
              La opacidad también se guarda únicamente junto a la imagen en este navegador.
            </p>
          </label>
        </div>

        <aside
          class="min-h-64 rounded-[32px] border border-[var(--dh-border)] p-4 shadow-[var(--dh-shadow-sm)]"
          :style="brandingPreviewStyle"
        >
          <div
            class="rounded-[26px] border border-white/20 bg-black/30 p-5 text-white backdrop-blur-xl"
          >
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-[22px] bg-white/20 text-lg font-black"
            >
              D
            </div>
            <p class="text-sm font-black uppercase tracking-[0.16em] opacity-75">Preview</p>
            <h3 class="mt-2 text-2xl font-black">{{ brandingStore.clientLabel }}</h3>
            <p class="mt-2 text-sm font-semibold opacity-80">
              {{
                brandingStore.hasLocalBackground
                  ? 'Esta imagen solo será visible en este navegador.'
                  : 'Seleccione una imagen para previsualizar el fondo local.'
              }}
            </p>
          </div>
        </aside>
      </div>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-6">
      <h2 class="text-lg font-black text-[var(--dh-text)]">Preferencias locales</h2>
      <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
        Herramientas para limpiar el estado guardado en este navegador.
      </p>

      <div class="mt-5 flex flex-wrap gap-3">
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
    </section>
  </section>
</template>
