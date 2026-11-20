<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Bell, RefreshCw, Save, Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { UsersService } from '@/core/services/usersService'
import { versionUpdateNotificationService } from '@/core/services/versionUpdateNotificationService'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useVersionUpdateNotificationStore } from '@/core/stores/versionUpdateNotificationStore'
import type { UserDto } from '@/core/interfaces/users'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'

type PreferenceChoice = 'inherit' | 'enabled' | 'disabled'
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()
const settings = useVersionUpdateNotificationStore()
const isAdmin = computed(() => auth.hasRole('SuperUsuario'))
const loading = ref(false)
const saving = ref(false)
const globalDraft = ref(true)
const personalDraft = ref<PreferenceChoice>('inherit')
const selectedDraft = ref<PreferenceChoice>('inherit')
const selectedUserId = ref('')
const users = ref<UserDto[]>([])
const userSearch = ref('')
const usersLoading = ref(false)
const selectedLoading = ref(false)
const selectedSavedChoice = ref<PreferenceChoice>('inherit')

const savedGlobal = computed(() => settings.preferences?.globalEnabled ?? true)
const savedPersonal = computed(() => toChoice(settings.preferences?.userEnabled ?? null))

watch(() => settings.preferences, (value) => {
  if (!value) return
  globalDraft.value = value.globalEnabled
  personalDraft.value = toChoice(value.userEnabled)
}, { immediate: true })

function toChoice(value: boolean | null): PreferenceChoice {
  return value === null ? 'inherit' : value ? 'enabled' : 'disabled'
}
function fromChoice(value: PreferenceChoice): boolean | null {
  return value === 'inherit' ? null : value === 'enabled'
}

async function reload() {
  loading.value = true
  try {
    await settings.refresh()
  } catch (error) {
    toast.backendError(error, t('settings.versionNotificationsLoadError'))
  } finally {
    loading.value = false
  }
}

async function saveMine() {
  if (saving.value) return
  saving.value = true
  try {
    settings.applyCurrent(await versionUpdateNotificationService.saveMine(fromChoice(personalDraft.value)))
    toast.success(t('settings.versionNotificationsSaved'))
  } catch (error) {
    toast.backendError(error, t('settings.versionNotificationsSaveError'))
  } finally {
    saving.value = false
  }
}

async function saveGlobal() {
  if (!isAdmin.value || saving.value) return
  saving.value = true
  try {
    settings.applyCurrent(await versionUpdateNotificationService.saveGlobal(globalDraft.value))
    toast.success(t('settings.versionNotificationsSaved'))
  } catch (error) {
    toast.backendError(error, t('settings.versionNotificationsSaveError'))
  } finally {
    saving.value = false
  }
}

async function searchUsers() {
  if (!isAdmin.value) return
  usersLoading.value = true
  try {
    const response = await UsersService.browsePaged({
      pageNumber: 1, pageSize: 100, search: userSearch.value.trim() || undefined,
    })
    users.value = response.items
    if (!users.value.some((u) => u.id === selectedUserId.value)) {
      selectedUserId.value = ''
      selectedDraft.value = 'inherit'
      selectedSavedChoice.value = 'inherit'
    }
  } catch (error) {
    toast.backendError(error, t('settings.versionNotificationsUsersError'))
  } finally {
    usersLoading.value = false
  }
}

async function loadSelected() {
  const id = selectedUserId.value
  if (!id || !isAdmin.value) return
  selectedLoading.value = true
  try {
    const response = await versionUpdateNotificationService.getUser(id)
    if (id !== selectedUserId.value) return
    selectedDraft.value = toChoice(response.userEnabled)
    selectedSavedChoice.value = selectedDraft.value
  } catch (error) {
    toast.backendError(error, t('settings.versionNotificationsLoadError'))
  } finally {
    selectedLoading.value = false
  }
}

async function saveSelected() {
  const id = selectedUserId.value
  if (!isAdmin.value || !id || saving.value) return
  saving.value = true
  try {
    const response = await versionUpdateNotificationService.saveUser(id, fromChoice(selectedDraft.value))
    selectedSavedChoice.value = toChoice(response.userEnabled)
    if (id === auth.userId) settings.applyCurrent(response)
    toast.success(t('settings.versionNotificationsSaved'))
  } catch (error) {
    toast.backendError(error, t('settings.versionNotificationsSaveError'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void reload()
  if (isAdmin.value) void searchUsers()
})
</script>

<template>
  <section class="min-w-0 space-y-5">
    <div class="flex flex-wrap items-center gap-2">
      <DhButton :label="t('settings.backToSettings')" variant="secondary" :icon="ArrowLeft" @click="router.push('/settings')" />
      <DhButton :label="t('common.refresh')" variant="secondary" :icon="RefreshCw" :loading="loading" @click="reload" />
    </div>
    <DhPageHeader :title="t('settings.versionNotificationsTitle')" :subtitle="t('settings.versionNotificationsDescription')" :icon="Bell" />

    <article class="dh-glass dh-liquid rounded-[24px] border border-[var(--dh-border)] p-4 sm:p-6 space-y-4">
      <div>
        <h2 class="text-lg font-bold">{{ t('settings.versionNotificationsMySettings') }}</h2>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ t('settings.versionNotificationsMyHelp') }}</p>
      </div>
      <select v-model="personalDraft" class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm sm:max-w-md" :disabled="loading || !settings.loaded">
        <option value="inherit">{{ t('settings.versionNotificationsInherit') }}</option>
        <option value="enabled">{{ t('settings.versionNotificationsShow') }}</option>
        <option value="disabled">{{ t('settings.versionNotificationsHide') }}</option>
      </select>
      <div class="flex flex-wrap items-center gap-3">
        <DhButton :label="t('common.save')" :icon="Save" :loading="saving" :disabled="!settings.loaded || personalDraft === savedPersonal || saving" @click="saveMine" />
        <span v-if="settings.loaded && !settings.preferences?.globalEnabled" class="text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ t('settings.versionNotificationsGlobalOff') }}
        </span>
      </div>
    </article>

    <template v-if="isAdmin">
      <article class="dh-glass dh-liquid rounded-[24px] border border-[var(--dh-border)] p-4 sm:p-6 space-y-4">
        <div>
          <h2 class="text-lg font-bold">{{ t('settings.versionNotificationsGlobalTitle') }}</h2>
          <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ t('settings.versionNotificationsGlobalHelp') }}</p>
        </div>
        <label class="flex max-w-xl cursor-pointer items-center gap-3 text-sm font-semibold">
          <input v-model="globalDraft" type="checkbox" class="h-5 w-5 shrink-0 accent-[var(--dh-primary)]" :disabled="!settings.loaded" />
          <span>{{ t('settings.versionNotificationsGlobalToggle') }}</span>
        </label>
        <DhButton :label="t('common.save')" :icon="Save" :loading="saving" :disabled="!settings.loaded || globalDraft === savedGlobal || saving" @click="saveGlobal" />
      </article>

      <article class="dh-glass dh-liquid rounded-[24px] border border-[var(--dh-border)] p-4 sm:p-6 space-y-4">
        <div>
          <h2 class="text-lg font-bold">{{ t('settings.versionNotificationsUserTitle') }}</h2>
          <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ t('settings.versionNotificationsUserHelp') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <input v-model="userSearch" type="search" class="min-w-0 flex-1 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" :placeholder="t('settings.versionNotificationsSearch')" @keyup.enter="searchUsers" />
          <DhButton :label="t('common.search')" :icon="Search" variant="secondary" :loading="usersLoading" @click="searchUsers" />
        </div>
        <label class="block space-y-2 text-sm font-semibold">
          <span>{{ t('settings.versionNotificationsSelectUser') }}</span>
          <select v-model="selectedUserId" class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" :disabled="usersLoading" @change="loadSelected">
            <option value="">{{ t('settings.versionNotificationsSelectUser') }}</option>
            <option v-for="user in users" :key="user.id" :value="user.id">{{ user.displayName || user.userName }} — {{ user.email }}</option>
          </select>
        </label>
        <template v-if="selectedUserId">
          <select v-model="selectedDraft" class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm sm:max-w-md" :disabled="selectedLoading">
            <option value="inherit">{{ t('settings.versionNotificationsInherit') }}</option>
            <option value="enabled">{{ t('settings.versionNotificationsShow') }}</option>
            <option value="disabled">{{ t('settings.versionNotificationsHide') }}</option>
          </select>
          <DhButton :label="t('common.save')" :icon="Save" :loading="saving" :disabled="selectedLoading || saving || selectedDraft === selectedSavedChoice" @click="saveSelected" />
        </template>
      </article>
    </template>
  </section>
</template>
