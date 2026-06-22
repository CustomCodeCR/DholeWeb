<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import DhToastContainer from '@/shared/components/containers/DhToastContainer.vue'
import DhModalContainer from '@/shared/components/containers/DhModalContainer.vue'
import DhDrawerContainer from '@/shared/components/containers/DhDrawerContainer.vue'
import { useAuthStore } from '@/core/stores/authStore'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'

const router = useRouter()
const authStore = useAuthStore()
const tabsStore = useWorkspaceTabsStore()

function handleAuthExpired() {
  authStore.clearSession()
  tabsStore.clear()

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
}

onMounted(() => {
  window.addEventListener('dhole:auth:expired', handleAuthExpired)
  window.addEventListener('dhole:auth:refreshed', handleAuthRefreshed)
})

onBeforeUnmount(() => {
  window.removeEventListener('dhole:auth:expired', handleAuthExpired)
  window.removeEventListener('dhole:auth:refreshed', handleAuthRefreshed)
})
</script>

<template>
  <DhToastContainer />
  <DhModalContainer />
  <DhDrawerContainer />

  <RouterView />
</template>
