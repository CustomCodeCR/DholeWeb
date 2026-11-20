<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RefreshCw, AlertCircle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import { useVersionUpdateNotificationStore } from '@/core/stores/versionUpdateNotificationStore'
import {
  normalizeWebBuild,
  requiresWebUpdate,
  webBuildKey,
  type WebBuildVersion,
} from '@/core/version/webBuildUpdate'

const { t } = useI18n()
const notificationSettings = useVersionUpdateNotificationStore()
const currentBuild: WebBuildVersion = {
  version: __DHOLE_WEB_VERSION__,
  commit: (import.meta.env.VITE_BUILD_SHA ?? '').slice(0, 12),
}
const availableBuild = ref<WebBuildVersion | null>(null)
const dismissedKey = ref<string | null>(null)
const visible = computed(() =>
  notificationSettings.effectiveEnabled && availableBuild.value !== null && webBuildKey(availableBuild.value) !== dismissedKey.value,
)
let pollTimer: number | undefined
let checking = false
let active = true

async function checkForUpdate() {
  if (!active || checking || document.visibilityState === 'hidden' || !navigator.onLine) return
  checking = true
  try {
    await notificationSettings.refresh()
    if (!notificationSettings.effectiveEnabled) {
      availableBuild.value = null
      return
    }
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    // Vite dev and misconfigured SPAs may return HTML instead of the build manifest.
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return
    const remote = normalizeWebBuild(await response.json())
    if (!active || !remote) return
    availableBuild.value = requiresWebUpdate(currentBuild, remote) ? remote : null
  } catch {
    // An offline/transient network failure is not an update.
  } finally {
    checking = false
  }
}

function checkWhenVisible() {
  if (document.visibilityState === 'visible') void checkForUpdate()
}

function updateNow() {
  window.location.reload()
}

function updateLater() {
  if (availableBuild.value) dismissedKey.value = webBuildKey(availableBuild.value)
}

onMounted(() => {
  active = true
  void checkForUpdate()
  pollTimer = window.setInterval(() => void checkForUpdate(), 60_000)
  document.addEventListener('visibilitychange', checkWhenVisible)
  window.addEventListener('focus', checkWhenVisible)
  window.addEventListener('online', checkWhenVisible)
  // Reconcile after SignalR reconnect; periodic REST polling remains the offline fallback.
  window.addEventListener('dhole:notification:realtime-connected', checkWhenVisible)
})

onBeforeUnmount(() => {
  active = false
  if (pollTimer !== undefined) window.clearInterval(pollTimer)
  document.removeEventListener('visibilitychange', checkWhenVisible)
  window.removeEventListener('focus', checkWhenVisible)
  window.removeEventListener('online', checkWhenVisible)
  window.removeEventListener('dhole:notification:realtime-connected', checkWhenVisible)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && availableBuild"
      class="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dhole-version-update-title"
        aria-describedby="dhole-version-update-description"
        class="dh-glass-strong w-full max-w-md rounded-[var(--dh-radius-xl)] border border-[var(--dh-border)] bg-[var(--dh-card-solid)] p-5 shadow-[var(--dh-shadow-lg)] sm:p-7"
      >
        <div class="mb-4 flex items-center gap-3">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]">
            <AlertCircle class="h-6 w-6" />
          </span>
          <h2 id="dhole-version-update-title" class="text-lg font-bold text-[var(--dh-text)]">
            {{ t('app.updateRequiredTitle') }}
          </h2>
        </div>
        <p id="dhole-version-update-description" class="text-sm leading-relaxed text-[var(--dh-text)]">
          {{ t('app.updateRequiredDescription', { version: availableBuild.version }) }}
        </p>
        <div class="my-4 grid grid-cols-2 gap-3 rounded-2xl bg-[var(--dh-input)] p-3 text-xs text-[var(--dh-text-muted)]">
          <div>{{ t('app.updateInstalled') }}<strong class="mt-1 block text-sm text-[var(--dh-text)]">v{{ currentBuild.version }}</strong></div>
          <div>{{ t('app.updateAvailable') }}<strong class="mt-1 block text-sm text-[var(--dh-text)]">v{{ availableBuild.version }}</strong></div>
        </div>
        <p class="mb-5 text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ t('app.updateRequiredUnsaved') }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <DhButton variant="secondary" :label="t('app.updateLater')" @click="updateLater" />
          <DhButton :icon="RefreshCw" :label="t('app.updateNow')" @click="updateNow" />
        </div>
      </section>
    </div>
  </Teleport>
</template>
