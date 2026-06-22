<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { LogIn, Mail } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput, DhPasswordInput } from '@/shared/components/atoms'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'

const { t } = useI18n()
const router = useRouter()
const toastStore = useToastStore()
const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const loading = ref(false)

async function login() {
  if (!email.value || !password.value) {
    toastStore.warning('Datos incompletos', t('auth.missingData'))
    return
  }
  try {
    loading.value = true
    await authStore.login({ email: email.value, password: password.value })
    toastStore.success('Sesión iniciada', 'Bienvenido a Dhole.')
    await router.push('/home')
  } catch (error) {
    toastStore.backendError(error, t('auth.loginError'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="login">
    <div class="text-center">
      <h2 class="text-2xl font-black text-[var(--dh-text)]">{{ t('auth.loginTitle') }}</h2>
      <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('auth.loginSubtitle') }}</p>
    </div>
    <DhInput v-model="email" :label="t('auth.email')" placeholder="admin@empresa.com" type="email" :icon="Mail" />
    <DhPasswordInput v-model="password" :label="t('auth.password')" />
    <DhButton class="w-full" type="submit" :label="t('auth.submit')" :icon="LogIn" :loading="loading" />
  </form>
</template>
