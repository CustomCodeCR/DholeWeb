<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { KeyRound } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhButton, DhPasswordInput } from '@/shared/components/atoms'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { AuthService } from '@/core/services/authService'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)

async function save() {
  if (!password.value || !confirmPassword.value) {
    toastStore.warning(t('auth.temporaryPassword.missingTitle'), t('auth.temporaryPassword.missingMessage'))
    return
  }

  if (password.value !== confirmPassword.value) {
    toastStore.warning(t('auth.temporaryPassword.mismatchTitle'), t('auth.temporaryPassword.mismatchMessage'))
    return
  }

  if (loading.value) return

  loading.value = true
  try {
    await AuthService.changeOwnPassword({ password: password.value })

    authStore.logout()
    toastStore.success(
      t('auth.temporaryPassword.successTitle'),
      t('auth.temporaryPassword.successMessage'),
    )
    await router.replace('/login')
  } catch (error) {
    toastStore.backendError(error, t('auth.temporaryPassword.errorMessage'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="text-center">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[20px] bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]">
        <KeyRound class="h-5 w-5" />
      </div>
      <h2 class="text-2xl font-black text-[var(--dh-text)]">
        {{ t('auth.temporaryPassword.title') }}
      </h2>
      <p class="mt-2 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
        {{ t('auth.temporaryPassword.subtitle') }}
      </p>
      <p v-if="authStore.email" class="mt-2 break-all text-sm font-black text-[var(--dh-text)]">
        {{ authStore.email }}
      </p>
    </div>

    <DhPasswordInput
      v-model="password"
      :label="t('auth.temporaryPassword.newPassword')"
      :placeholder="t('auth.temporaryPassword.newPasswordPlaceholder')"
      autocomplete="new-password"
    />

    <DhPasswordInput
      v-model="confirmPassword"
      :label="t('auth.temporaryPassword.confirmPassword')"
      :placeholder="t('auth.temporaryPassword.confirmPasswordPlaceholder')"
      autocomplete="new-password"
    />

    <DhButton
      class="w-full"
      type="submit"
      :label="t('auth.temporaryPassword.submit')"
      :icon="KeyRound"
      :loading="loading"
    />
  </form>
</template>
