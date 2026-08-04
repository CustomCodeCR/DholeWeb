<script setup lang="ts">
import { computed } from 'vue'
import { Bell, Languages, LogOut, Menu, Moon, Search, Sun } from 'lucide-vue-next'
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
const emit = defineEmits<{ search: []; logout: []; navigation: [] }>()

const displayName = computed(() => authStore.userDisplayName || 'Usuario')
const displayEmail = computed(() => authStore.email || 'Sesión activa')
const searchShortcut = computed(() => shortcutStore.byAction('global.search')?.keys ?? 'ctrl+k')
</script>

<template>
  <header
    class="sticky top-2 z-30 mx-2 flex min-h-16 items-center gap-2 rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-shell)] px-2 py-2 shadow-[var(--dh-shadow-md)] backdrop-blur-2xl sm:top-4 sm:mx-4 sm:min-h-[76px] sm:rounded-[34px] sm:px-4"
  >
    <DhIconButton
      :icon="Menu"
      :label="t('sidebar.expand')"
      variant="secondary"
      class="shrink-0 lg:hidden"
      @click="emit('navigation')"
    />

    <button
      type="button"
      class="group flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-left text-sm font-semibold text-[var(--dh-text-muted)] shadow-[var(--dh-shadow-sm)] transition hover:border-[var(--dh-primary)] hover:bg-[var(--dh-card-hover)] sm:h-12 sm:gap-3 sm:rounded-[22px] sm:px-4 lg:max-w-[460px]"
      @click="emit('search')"
    >
      <Search class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
      <span class="hidden truncate sm:block">{{ t('topbar.searchPlaceholder') }}</span>
      <span class="truncate sm:hidden">{{ t('common.search') }}</span>
      <kbd class="ml-auto hidden rounded-xl border border-[var(--dh-border)] bg-white/70 px-2 py-1 text-[10px] font-black uppercase text-[var(--dh-text-muted)] dark:bg-white/10 md:block">
        {{ searchShortcut }}
      </kbd>
    </button>

    <div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
      <DhIconButton :icon="Languages" :label="t('topbar.language')" variant="secondary" @click="localeStore.toggleLocale()" />
      <DhIconButton :icon="themeStore.resolvedTheme === 'dark' ? Sun : Moon" :label="t('topbar.theme')" variant="secondary" @click="themeStore.toggleTheme()" />
      <DhIconButton :icon="Bell" :label="t('topbar.notifications')" variant="secondary" class="hidden sm:inline-flex" />

      <div class="flex items-center gap-1 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-1 shadow-[var(--dh-shadow-sm)] sm:ml-1 sm:gap-3 sm:rounded-[24px] sm:px-3 sm:py-2">
        <DhAvatar :name="displayName" status="online" class="hidden sm:flex" />
        <div class="hidden min-w-0 xl:block">
          <p class="max-w-40 truncate text-sm font-black text-[var(--dh-text)]">{{ displayName }}</p>
          <p class="max-w-40 truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ displayEmail }}</p>
        </div>
        <DhIconButton :icon="LogOut" :label="t('topbar.logout')" variant="ghost" size="sm" @click="emit('logout')" />
      </div>
    </div>
  </header>
</template>
