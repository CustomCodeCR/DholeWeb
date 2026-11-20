import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/core/stores/authStore'
import {
  versionUpdateNotificationService,
  type VersionUpdateNotificationPreferences,
} from '@/core/services/versionUpdateNotificationService'
import { shouldShowVersionUpdateNotice } from '@/core/version/versionUpdatePolicy'

export const useVersionUpdateNotificationStore = defineStore('version-update-notifications', () => {
  const auth = useAuthStore()
  const preferences = ref<VersionUpdateNotificationPreferences | null>(null)
  const loadedForUser = ref<string | null>(null)
  let pending: Promise<void> | null = null

  const loaded = computed(() => auth.userId !== null && loadedForUser.value === auth.userId)
  const effectiveEnabled = computed(() => loaded.value
    && shouldShowVersionUpdateNotice(
      preferences.value?.globalEnabled ?? true,
      preferences.value?.userEnabled ?? null,
    ))

  async function refresh() {
    const userId = auth.userId
    if (!userId || !auth.isAuthenticated) {
      preferences.value = null
      loadedForUser.value = null
      return
    }
    if (pending) return pending
    pending = (async () => {
      const response = await versionUpdateNotificationService.getCurrent()
      if (auth.userId !== userId) return // Never show another user's cached preference.
      preferences.value = response
      loadedForUser.value = userId
    })().finally(() => { pending = null })
    return pending
  }

  function applyCurrent(response: VersionUpdateNotificationPreferences) {
    if (!auth.userId) return
    preferences.value = response
    loadedForUser.value = auth.userId
  }

  return { preferences, loaded, effectiveEnabled, refresh, applyCurrent }
})
