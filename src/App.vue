<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
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

function handleAuthExpired() {
  void stopNotificationRealtime()
  authStore.clearSession()
  tabsStore.clear()
  void brandingStore.loadCurrentClientBranding()

  if (router.currentRoute.value.path !== '/login') {
    router.replace({ path: '/login', query: { expired: '1' } })
  }
}

function handleAuthRefreshed(event: Event) {
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
  void stopNotificationRealtime()
  ;(window as Window & { __dholeConnectivityCleanup?: () => void }).__dholeConnectivityCleanup?.()
  window.removeEventListener('dhole:auth:expired', handleAuthExpired)
  window.removeEventListener('dhole:auth:refreshed', handleAuthRefreshed)
})
</script>

<template>
  <DhToastContainer />
  <DhModalContainer />
  <DhDrawerContainer />

  <RouterView />
  <AiAssistantFloatingButton />
</template>
