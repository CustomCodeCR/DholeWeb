<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import DhToastContainer from '@/shared/components/containers/DhToastContainer.vue'
import DhModalContainer from '@/shared/components/containers/DhModalContainer.vue'
import DhDrawerContainer from '@/shared/components/containers/DhDrawerContainer.vue'
import AiAssistantFloatingButton from '@/modules/ai/components/AiAssistantFloatingButton.vue'
import { useAuthStore } from '@/core/stores/authStore'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'
import { useBrandingStore } from '@/core/stores/brandingStore'
import { useToastStore } from '@/core/stores/toastStore'
import { initializePricingOfflineSync, flushPricingOfflineQueue } from '@/core/offline/pricingOfflineQueue'
import {
  startNotificationRealtime,
  stopNotificationRealtime,
} from '@/core/realtime/notificationRealtime'

const router = useRouter()
const authStore = useAuthStore()
const tabsStore = useWorkspaceTabsStore()
const brandingStore = useBrandingStore()
const toastStore = useToastStore()
const isPublicRoute = computed(() => router.currentRoute.value.meta.public === true)

function handleAuthExpired() {
  // Public origin pages must never redirect to Login because they intentionally work
  // without a Dhole session. Clearing a stale session is fine; navigation is not.
  if (isPublicRoute.value) {
    authStore.clearSession()
    return
  }

  void stopNotificationRealtime()
  authStore.clearSession()
  tabsStore.clear()
  void brandingStore.loadCurrentClientBranding()

  if (router.currentRoute.value.path !== '/login') {
    router.replace({ path: '/login', query: { expired: '1' } })
  }
}

function handleAuthRefreshed(event: Event) {
  if (isPublicRoute.value) return

  const detail = (event as CustomEvent).detail

  if (!detail?.accessToken || !detail?.refreshToken || !detail?.sessionId) {
    return
  }

  authStore.setSession(detail)
  void startNotificationRealtime()
  void brandingStore.loadCurrentClientBranding()
}

onMounted(() => {
  brandingStore.applyCachedOrDefault()

  // The public origin page is a deliberately isolated surface: no Pricing offline
  // synchronization, authenticated realtime channels, modals/drawers or AI assistant.
  if (isPublicRoute.value) {
    window.addEventListener('dhole:auth:expired', handleAuthExpired)
    return
  }

  initializePricingOfflineSync()
  const handleOffline = () => toastStore.warning('Sin conexión', 'Los cambios de Pricing se conservarán localmente y se sincronizarán al recuperar Internet.')
  const handleOnline = () => {
    toastStore.info('Conexión recuperada', 'Sincronizando cambios pendientes…')
    void flushPricingOfflineQueue()
  }
  window.addEventListener('offline', handleOffline)
  window.addEventListener('online', handleOnline)
  ;(window as Window & { __dholeConnectivityCleanup?: () => void }).__dholeConnectivityCleanup = () => {
    window.removeEventListener('offline', handleOffline)
    window.removeEventListener('online', handleOnline)
  }

  void brandingStore.loadCurrentClientBranding()
  void startNotificationRealtime()

  window.addEventListener('dhole:auth:expired', handleAuthExpired)
  window.addEventListener('dhole:auth:refreshed', handleAuthRefreshed)
})

onBeforeUnmount(() => {
  if (!isPublicRoute.value) void stopNotificationRealtime()
  ;(window as Window & { __dholeConnectivityCleanup?: () => void }).__dholeConnectivityCleanup?.()
  window.removeEventListener('dhole:auth:expired', handleAuthExpired)
  window.removeEventListener('dhole:auth:refreshed', handleAuthRefreshed)
})
</script>

<template>
  <template v-if="!isPublicRoute">
    <DhToastContainer />
    <DhModalContainer />
    <DhDrawerContainer />
  </template>

  <RouterView />
  <AiAssistantFloatingButton v-if="!isPublicRoute" />
</template>
