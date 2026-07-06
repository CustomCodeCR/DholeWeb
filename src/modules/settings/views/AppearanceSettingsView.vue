<script setup lang="ts">
import { Check, Image, Monitor, Moon, Palette, RotateCcw, Save, Sun } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhPageHeader } from '@/shared/components/organisms'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { useThemeStore, type ThemeMode } from '@/core/stores/themeStore'
import { useLocale, type LocaleCode } from '@/core/stores/locale'
import { useShortcutStore } from '@/core/stores/shortcutStore'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'
import { useBrandingStore } from '@/core/stores/brandingStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DEFAULT_CLIENT_BRANDING, type ClientBrandingSettings } from '@/core/interfaces/branding'

const { t } = useI18n()
const themeStore = useThemeStore()
const localeStore = useLocale()
const shortcutStore = useShortcutStore()
const tabsStore = useWorkspaceTabsStore()
const brandingStore = useBrandingStore()
const toastStore = useToastStore()

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
  backgroundImage: brandingForm.value.backgroundImageUrl
    ? `linear-gradient(rgb(0 0 0 / ${brandingForm.value.backgroundOverlayOpacity ?? 0.5}), rgb(0 0 0 / ${brandingForm.value.backgroundOverlayOpacity ?? 0.5})), url("${brandingForm.value.backgroundImageUrl.replace(/["\\\n\r]/g, '')}")`
    : undefined,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
}))

function syncBrandingForm() {
  brandingForm.value = {
    ...DEFAULT_CLIENT_BRANDING,
    ...brandingStore.settings,
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
  }

  previewBranding()
}

async function saveBranding() {
  const result = await brandingStore.saveForCurrentClient({
    clientId: brandingForm.value.clientId,
    clientCode: brandingForm.value.clientCode,
    primaryColor: brandingForm.value.primaryColor,
    backgroundImageUrl: brandingForm.value.backgroundImageUrl,
    backgroundOverlayOpacity: brandingForm.value.backgroundOverlayOpacity,
  })

  syncBrandingForm()

  if (result.synced) {
    toastStore.success('Branding guardado', 'El color y fondo quedaron guardados para este cliente.')
    return
  }

  toastStore.warning(
    'Branding aplicado localmente',
    'El backend todavía no respondió el endpoint de branding; el cambio se dejó cacheado en este navegador.',
  )
}

onMounted(async () => {
  await brandingStore.loadCurrentClientBranding()
  syncBrandingForm()
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="t('appearance.title')" :subtitle="t('appearance.subtitle')" :icon="Palette" />

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
            :class="themeStore.mode === option.value ? 'dh-primary-selected' : 'border-[var(--dh-border)] bg-[var(--dh-card)]'"
            @click="themeStore.setTheme(option.value)"
          >
            <component :is="option.icon" class="h-5 w-5 text-[var(--dh-primary)]" />
            <p class="mt-3 text-sm font-black text-[var(--dh-text)]">{{ t(option.label) }}</p>
            <Check v-if="themeStore.mode === option.value" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />
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
            :class="localeStore.locale === option.value ? 'dh-primary-selected' : 'border-[var(--dh-border)] bg-[var(--dh-card)]'"
            @click="localeStore.setLocale(option.value)"
          >
            <p class="text-sm font-black text-[var(--dh-text)]">{{ t(option.label) }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ option.value.toUpperCase() }}</p>
            <Check v-if="localeStore.locale === option.value" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />
          </button>
        </div>
      </article>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">Branding por cliente</h2>
          <p class="mt-1 max-w-3xl text-sm font-semibold text-[var(--dh-text-muted)]">
            Estos valores se aplican con variables CSS al cliente activo, sin cambiar el color global del servidor.
          </p>
          <p class="mt-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">
            Cliente activo: {{ brandingStore.clientLabel }}
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <DhButton label="Previsualizar" variant="secondary" :icon="Image" @click="previewBranding" />
          <DhButton label="Restaurar" variant="secondary" :icon="RotateCcw" @click="resetBranding" />
          <DhButton label="Guardar cliente" :icon="Save" :loading="brandingStore.saving" @click="saveBranding" />
        </div>
      </div>

      <div class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="grid gap-4 md:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Color principal</span>
            <div class="flex h-11 items-center gap-3 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl dh-focus-primary">
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

          <DhInput
            :model-value="brandingForm.backgroundImageUrl ?? null"
            label="Imagen de fondo"
            placeholder="https://... o /storage/..."
            @update:model-value="(value) => { brandingForm.backgroundImageUrl = value; previewBranding() }"
          />

          <label class="block md:col-span-2">
            <span class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Oscurecer / aclarar imagen: {{ overlayPercent }}%</span>
            <input
              v-model.number="brandingForm.backgroundOverlayOpacity"
              type="range"
              min="0"
              max="0.95"
              step="0.05"
              class="w-full accent-[var(--dh-primary)]"
              @input="previewBranding"
            />
            <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
              Use un valor alto si la imagen tiene mucho detalle y necesita que las tarjetas sigan siendo legibles.
            </p>
          </label>
        </div>

        <aside class="rounded-[32px] border border-[var(--dh-border)] p-4 shadow-[var(--dh-shadow-sm)]" :style="brandingPreviewStyle">
          <div class="rounded-[26px] border border-white/20 bg-black/30 p-5 text-white backdrop-blur-xl">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-[22px] bg-white/20 text-lg font-black">D</div>
            <p class="text-sm font-black uppercase tracking-[0.16em] opacity-75">Preview</p>
            <h3 class="mt-2 text-2xl font-black">{{ brandingStore.clientLabel }}</h3>
            <p class="mt-2 text-sm font-semibold opacity-80">
              El color afecta botones, brillos, selección, scrollbars y acentos visuales.
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
        <DhButton :label="t('appearance.resetWorkspace')" variant="secondary" @click="tabsStore.clear()" />
        <DhButton :label="t('appearance.resetShortcuts')" variant="secondary" @click="shortcutStore.reset()" />
      </div>
    </section>
  </section>
</template>
