import { computed } from 'vue'
import { AGENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'

export function useAgentPermissions() {
  const authStore = useAuthStore()

  return {
    canViewProviders: computed(() => authStore.hasScope(AGENT_SCOPES.providers.view)),
    canManageProviders: computed(() => authStore.hasScope(AGENT_SCOPES.providers.manage)),
    canViewDefinitions: computed(() => authStore.hasScope(AGENT_SCOPES.definitions.view)),
    canManageDefinitions: computed(() => authStore.hasScope(AGENT_SCOPES.definitions.manage)),
    canViewCredentials: computed(() => authStore.hasScope(AGENT_SCOPES.credentials.view)),
    canManageCredentials: computed(() => authStore.hasScope(AGENT_SCOPES.credentials.manage)),
    canViewBrowserProfiles: computed(() => authStore.hasScope(AGENT_SCOPES.browserProfiles.view)),
    canAuthenticateBrowserProfiles: computed(() =>
      authStore.hasScope(AGENT_SCOPES.browserProfiles.authenticate),
    ),
    canViewSchedules: computed(() => authStore.hasScope(AGENT_SCOPES.schedules.view)),
    canCreateSchedules: computed(() => authStore.hasScope(AGENT_SCOPES.schedules.create)),
    canUpdateSchedules: computed(() => authStore.hasScope(AGENT_SCOPES.schedules.update)),
    canExecuteSchedules: computed(() => authStore.hasScope(AGENT_SCOPES.schedules.execute)),
    canViewExecutions: computed(() => authStore.hasScope(AGENT_SCOPES.executions.view)),
    canCreateExecutions: computed(() => authStore.hasScope(AGENT_SCOPES.executions.create)),
    canCancelExecutions: computed(() => authStore.hasScope(AGENT_SCOPES.executions.cancel)),
  }
}
