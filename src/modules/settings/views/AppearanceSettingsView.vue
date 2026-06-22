<script setup lang="ts">
import { Check, Monitor, Moon, Palette, Sun } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhPageHeader } from '@/shared/components/organisms'
import { DhButton } from '@/shared/components/atoms'
import { useThemeStore, type ThemeMode } from '@/core/stores/themeStore'
import { useLocale, type LocaleCode } from '@/core/stores/locale'
import { useShortcutStore } from '@/core/stores/shortcutStore'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'

const { t } = useI18n()
const themeStore = useThemeStore()
const localeStore = useLocale()
const shortcutStore = useShortcutStore()
const tabsStore = useWorkspaceTabsStore()

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'appearance.light', icon: Sun },
  { value: 'dark', label: 'appearance.dark', icon: Moon },
  { value: 'system', label: 'appearance.system', icon: Monitor },
]

const localeOptions: { value: LocaleCode; label: string }[] = [
  { value: 'es', label: 'appearance.spanish' },
  { value: 'en', label: 'appearance.english' },
]
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="t('appearance.title')" :subtitle="t('appearance.subtitle')" :icon="Palette" />

    <section class="grid gap-5 xl:grid-cols-2">
      <article class="dh-glass dh-liquid rounded-[32px] p-6">
        <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('appearance.theme') }}</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          Cambie el look general de Dhole Web.
        </p>

        <div class="mt-5 grid gap-3 md:grid-cols-3">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            class="relative rounded-[26px] border p-4 text-left transition hover:bg-[var(--dh-card-hover)]"
            :class="themeStore.mode === option.value ? 'border-[var(--dh-primary)] bg-red-500/10' : 'border-[var(--dh-border)] bg-[var(--dh-card)]'"
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
            :class="localeStore.locale === option.value ? 'border-[var(--dh-primary)] bg-red-500/10' : 'border-[var(--dh-border)] bg-[var(--dh-card)]'"
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
