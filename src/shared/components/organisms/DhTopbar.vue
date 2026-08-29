<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Bell, CheckCheck, Languages, LoaderCircle, LogOut, Menu, Moon, Search, Settings, Sun } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import DhIconButton from '@/shared/components/atoms/DhIconButton.vue'
import DhAvatar from '@/shared/components/atoms/DhAvatar.vue'
import { useThemeStore } from '@/core/stores/themeStore'
import { useLocale } from '@/core/stores/locale'
import { useAuthStore } from '@/core/stores/authStore'
import { useShortcutStore } from '@/core/stores/shortcutStore'
import { NotificationsService } from '@/core/services/notificationsService'
import type { NotificationInboxItemDto } from '@/core/interfaces/notifications'

const { t } = useI18n()
const router = useRouter()
const themeStore = useThemeStore()
const localeStore = useLocale()
const authStore = useAuthStore()
const shortcutStore = useShortcutStore()
const emit = defineEmits<{ search: []; logout: []; navigation: [] }>()

const displayName = computed(() => authStore.userDisplayName || 'Usuario')
const displayEmail = computed(() => authStore.email || 'Sesión activa')
const searchShortcut = computed(() => shortcutStore.byAction('global.search')?.keys ?? 'ctrl+k')

const inboxRoot = ref<HTMLElement | null>(null)
const inboxOpen = ref(false)
const inboxLoading = ref(false)
const inboxLoadingMore = ref(false)
const inboxItems = ref<NotificationInboxItemDto[]>([])
const inboxPage = ref(1)
const inboxPageSize = 20
const inboxTotal = ref(0)
const unreadCount = ref(0)
const expandedRecipientId = ref<string | null>(null)

const hasMoreNotifications = computed(() => inboxItems.value.length < inboxTotal.value)
const unreadBadge = computed(() => unreadCount.value > 99 ? '99+' : String(unreadCount.value))

async function refreshInbox() {
  if (inboxLoading.value) return
  inboxLoading.value = true
  try {
    const [page, unread] = await Promise.all([
      NotificationsService.browseInbox({ pageNumber: 1, pageSize: inboxPageSize }),
      NotificationsService.getUnreadInboxCount(),
    ])
    inboxItems.value = page.items
    inboxPage.value = 1
    inboxTotal.value = page.totalCount ?? page.items.length
    unreadCount.value = unread
  } catch {
    // The realtime toast remains available; the inbox will retry the next time it is opened.
  } finally {
    inboxLoading.value = false
  }
}

async function loadMoreNotifications() {
  if (inboxLoadingMore.value || !hasMoreNotifications.value) return
  inboxLoadingMore.value = true
  try {
    const nextPage = inboxPage.value + 1
    const page = await NotificationsService.browseInbox({ pageNumber: nextPage, pageSize: inboxPageSize })
    const known = new Set(inboxItems.value.map((item) => item.recipientId))
    inboxItems.value.push(...page.items.filter((item) => !known.has(item.recipientId)))
    inboxPage.value = nextPage
    inboxTotal.value = page.totalCount ?? inboxTotal.value
  } finally {
    inboxLoadingMore.value = false
  }
}

async function markNotificationRead(item: NotificationInboxItemDto) {
  expandedRecipientId.value = expandedRecipientId.value === item.recipientId ? null : item.recipientId
  if (item.readAtUtc) return

  try {
    await NotificationsService.markInboxRead(item.recipientId)
    item.readAtUtc = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch {
    // Keep it unread so the user can retry later.
  }
}

async function markAllNotificationsRead() {
  if (unreadCount.value <= 0) return
  try {
    await NotificationsService.markAllInboxRead()
    const now = new Date().toISOString()
    inboxItems.value.forEach((item) => {
      if (!item.readAtUtc) item.readAtUtc = now
    })
    unreadCount.value = 0
  } catch {
    // Leave the current state untouched if persistence fails.
  }
}

function toggleInbox() {
  inboxOpen.value = !inboxOpen.value
  if (inboxOpen.value) void refreshInbox()
}

function openSettings() {
  inboxOpen.value = false
  void router.push('/settings')
}

function formatNotificationDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function handleOutsidePointer(event: PointerEvent) {
  if (!inboxOpen.value || !inboxRoot.value) return
  const target = event.target
  if (target instanceof Node && !inboxRoot.value.contains(target)) inboxOpen.value = false
}

function handleRealtimeNotification() {
  void refreshInbox()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointer)
  window.addEventListener('dhole:notification:received', handleRealtimeNotification)
  void refreshInbox()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointer)
  window.removeEventListener('dhole:notification:received', handleRealtimeNotification)
})
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
      <DhIconButton :icon="Settings" label="Configuración" variant="secondary" @click="openSettings" />

      <div ref="inboxRoot" class="relative">
        <div class="relative">
          <DhIconButton
            :icon="Bell"
            :label="t('topbar.notifications')"
            variant="secondary"
            @click="toggleInbox"
          />
          <span
            v-if="unreadCount > 0"
            class="pointer-events-none absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--dh-primary)] px-1 text-[10px] font-black text-white shadow-sm"
          >
            {{ unreadBadge }}
          </span>
        </div>

        <section
          v-if="inboxOpen"
          class="absolute right-0 top-[calc(100%+0.65rem)] z-50 flex max-h-[72vh] w-[min(430px,calc(100vw-1rem))] flex-col overflow-hidden rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card-solid)] shadow-[var(--dh-shadow-lg)]"
        >
          <div class="flex items-center justify-between gap-3 border-b border-[var(--dh-border)] px-4 py-3">
            <div class="min-w-0">
              <h2 class="text-sm font-black text-[var(--dh-text)]">Notificaciones</h2>
              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día' }}
              </p>
            </div>
            <button
              v-if="unreadCount > 0"
              type="button"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-black text-[var(--dh-primary)] transition hover:bg-[var(--dh-card-hover)]"
              @click="markAllNotificationsRead"
            >
              <CheckCheck class="h-4 w-4" />
              Marcar todas
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <div v-if="inboxLoading && inboxItems.length === 0" class="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-[var(--dh-text-muted)]">
              <LoaderCircle class="h-4 w-4 animate-spin" />
              Cargando notificaciones...
            </div>

            <div v-else-if="inboxItems.length === 0" class="px-4 py-10 text-center">
              <Bell class="mx-auto mb-3 h-7 w-7 text-[var(--dh-text-muted)]" />
              <p class="text-sm font-black text-[var(--dh-text)]">No hay notificaciones</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Las alertas importantes del sistema aparecerán aquí.</p>
            </div>

            <div v-else class="space-y-1.5">
              <button
                v-for="item in inboxItems"
                :key="item.recipientId"
                type="button"
                class="w-full rounded-[18px] border px-3 py-3 text-left transition hover:bg-[var(--dh-card-hover)]"
                :class="item.readAtUtc ? 'border-transparent bg-transparent' : 'border-[var(--dh-border)] bg-[var(--dh-card)]'"
                @click="markNotificationRead(item)"
              >
                <div class="flex items-start gap-3">
                  <span
                    class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    :class="item.readAtUtc ? 'bg-[var(--dh-border)]' : 'bg-[var(--dh-primary)]'"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                      <p class="min-w-0 text-sm text-[var(--dh-text)]" :class="item.readAtUtc ? 'font-bold' : 'font-black'">
                        {{ item.subject || 'Nueva notificación' }}
                      </p>
                      <time class="shrink-0 text-[10px] font-bold text-[var(--dh-text-muted)]">
                        {{ formatNotificationDate(item.createdAtUtc) }}
                      </time>
                    </div>
                    <p
                      v-if="item.body"
                      class="mt-1 whitespace-pre-line text-xs font-semibold leading-5 text-[var(--dh-text-muted)]"
                      :class="expandedRecipientId === item.recipientId ? '' : 'max-h-10 overflow-hidden'"
                    >
                      {{ item.body }}
                    </p>
                  </div>
                </div>
              </button>

              <button
                v-if="hasMoreNotifications"
                type="button"
                class="mt-2 flex w-full items-center justify-center gap-2 rounded-[16px] border border-[var(--dh-border)] px-3 py-2.5 text-xs font-black text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]"
                :disabled="inboxLoadingMore"
                @click="loadMoreNotifications"
              >
                <LoaderCircle v-if="inboxLoadingMore" class="h-4 w-4 animate-spin" />
                {{ inboxLoadingMore ? 'Cargando...' : 'Ver anteriores' }}
              </button>
            </div>
          </div>
        </section>
      </div>

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
