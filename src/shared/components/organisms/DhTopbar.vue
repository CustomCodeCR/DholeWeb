<script setup lang="ts">
import { computed } from 'vue'
import { Bell, Languages, LogOut, Moon, Search, Sun } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import DhIconButton from '@/shared/components/atoms/DhIconButton.vue'
import DhAvatar from '@/shared/components/atoms/DhAvatar.vue'
import { useThemeStore } from '@/core/stores/themeStore'
import { useLocale } from '@/core/stores/locale'
import { useAuthStore } from '@/core/stores/authStore'
import { useShortcutStore } from '@/core/stores/shortcutStore'

const { t } = useI18n()
const themeStore = useThemeStore()
const localeStore = useLocale()
const authStore = useAuthStore()
const shortcutStore = useShortcutStore()
const emit = defineEmits<{ search: []; logout: [] }>()

const displayName = computed(() => authStore.username || authStore.email || 'Usuario')
const displayEmail = computed(() => authStore.email || 'Sesión activa')
const searchShortcut = computed(() => shortcutStore.byAction('global.search')?.keys ?? 'ctrl+k')
</script>

<template>
  <header class="sticky top-4 z-30 mx-4 flex h-[76px] items-center justify-between rounded-[34px] border border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 shadow-[var(--dh-shadow-md)] backdrop-blur-2xl">
    <button
      type="button"
      class="group flex h-12 w-[460px] max-w-[46vw] items-center gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 text-left text-sm font-semibold text-[var(--dh-text-muted)] shadow-[var(--dh-shadow-sm)] transition hover:border-[var(--dh-primary)] hover:bg-[var(--dh-card-hover)]"
      @click="emit('search')"
    >
      <Search class="h-4 w-4 text-[var(--dh-primary)]" />
      <span class="truncate">{{ t('topbar.searchPlaceholder') }}</span>
      <kbd class="ml-auto rounded-xl border border-[var(--dh-border)] bg-white/70 px-2 py-1 text-[10px] font-black uppercase text-[var(--dh-text-muted)] dark:bg-white/10">
        {{ searchShortcut }}
      </kbd>
    </button>

    <div class="flex items-center gap-2">
      <DhIconButton :icon="Languages" :label="t('topbar.language')" variant="secondary" @click="localeStore.toggleLocale()" />
      <DhIconButton :icon="themeStore.resolvedTheme === 'dark' ? Sun : Moon" :label="t('topbar.theme')" variant="secondary" @click="themeStore.toggleTheme()" />
      <DhIconButton :icon="Bell" :label="t('topbar.notifications')" variant="secondary" />
      <div class="ml-2 flex items-center gap-3 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 shadow-[var(--dh-shadow-sm)]">
        <DhAvatar :name="displayName" status="online" />
        <div class="hidden min-w-0 lg:block">
          <p class="max-w-40 truncate text-sm font-black text-[var(--dh-text)]">{{ displayName }}</p>
          <p class="max-w-40 truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ displayEmail }}</p>
        </div>
        <DhIconButton :icon="LogOut" :label="t('topbar.logout')" variant="ghost" size="sm" @click="emit('logout')" />
      </div>
    </div>
  </header>
</template>
