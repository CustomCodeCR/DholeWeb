<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput, DhPasswordInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import type { AgentCredentialDto, AgentProviderDto } from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  providers: AgentProviderDto[]
  credential?: AgentCredentialDto | null
}>()

const emit = defineEmits<{
  saved: [credentialId: string]
  cancel: []
}>()

const { t } = useI18n()
const toastStore = useToastStore()

const form = reactive({
  providerId: '',
  name: '',
  username: '',
  password: '',
  additionalSecretsJson: '',
})

let saving = false

const editing = computed(() => Boolean(props.credential))
const providerOptions = computed(() =>
  props.providers
    .filter((provider) => provider.isActive || provider.id === props.credential?.providerId)
    .map((provider) => ({
      value: provider.id,
      label: `${provider.name} · ${provider.code}`,
    })),
)

function resetForm() {
  form.providerId = props.credential?.providerId ?? props.providers.find((item) => item.isActive)?.id ?? ''
  form.name = props.credential?.name ?? ''
  // The backend intentionally returns only a masked username and never returns a password.
  form.username = ''
  form.password = ''
  form.additionalSecretsJson = ''
}

function validateAdditionalSecrets() {
  const value = form.additionalSecretsJson.trim()
  if (!value) return null

  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(t('agent.validation.objectJson', { field: t('agent.fields.additionalSecretsJson') }))
    }
    return value
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === t('agent.validation.objectJson', { field: t('agent.fields.additionalSecretsJson') })
    ) {
      throw error
    }
    throw new Error(t('agent.validation.validJson', { field: t('agent.fields.additionalSecretsJson') }))
  }
}

async function save() {
  if (saving) return

  try {
    if (!form.providerId) {
      throw new Error(t('agent.validation.required', { field: t('agent.fields.provider') }))
    }
    if (!form.name.trim()) {
      throw new Error(t('agent.validation.required', { field: t('agent.fields.name') }))
    }
    if (!form.username.trim()) {
      throw new Error(t('agent.validation.required', { field: t('agent.fields.username') }))
    }
    if (!editing.value && !form.password.trim()) {
      throw new Error(t('agent.validation.required', { field: t('agent.fields.password') }))
    }

    const additionalSecretsJson = validateAdditionalSecrets()
    saving = true

    let credentialId: string
    if (props.credential) {
      await AgentService.credentials.update(props.credential.id, {
        name: form.name.trim(),
        username: form.username.trim(),
        password: form.password.trim() || null,
        additionalSecretsJson,
      })
      credentialId = props.credential.id
      toastStore.success(t('agent.messages.credentialUpdated'))
    } else {
      credentialId = await AgentService.credentials.create({
        providerId: form.providerId,
        name: form.name.trim(),
        username: form.username.trim(),
        password: form.password.trim(),
        additionalSecretsJson,
      })
      toastStore.success(t('agent.messages.credentialCreated'))
    }

    // Security invariant: never retain the password in client state after the request succeeds.
    form.password = ''
    emit('saved', credentialId)
  } catch (error) {
    if (error instanceof Error && !('status' in error)) {
      toastStore.warning(t('agent.review.credential'), error.message)
    } else {
      toastStore.backendError(error, t('agent.errors.saveCredential'))
    }
  } finally {
    saving = false
  }
}

watch(
  () => [props.credential?.id, props.providers.length],
  resetForm,
  { immediate: true },
)
</script>

<template>
  <form class="grid gap-4" @submit.prevent="save">
    <section
      class="rounded-[20px] border border-[var(--dh-border)] bg-black/[0.025] p-4 text-sm font-semibold leading-6 text-[var(--dh-text-muted)] dark:bg-white/[0.04]"
    >
      {{ t('agent.credentials.secretNotice') }}
      <span v-if="editing" class="mt-2 block">
        {{ t('agent.credentials.editSecretNotice') }}
      </span>
    </section>

    <div class="grid gap-4 md:grid-cols-2">
      <DhSelect
        v-model="form.providerId"
        :label="t('agent.fields.provider')"
        :options="providerOptions"
        :disabled="saving || editing"
      />
      <DhInput v-model="form.name" :label="t('agent.fields.name')" :disabled="saving" />
      <DhInput
        v-model="form.username"
        :label="t('agent.fields.username')"
        :placeholder="editing ? t('agent.credentials.usernameEditPlaceholder') : 'operaciones@empresa.com'"
        :disabled="saving"
      />
      <DhPasswordInput
        v-model="form.password"
        :label="editing ? t('agent.credentials.passwordOptional') : t('agent.fields.password')"
        :disabled="saving"
      />
    </div>

    <DhTextarea
      v-model="form.additionalSecretsJson"
      :label="t('agent.fields.additionalSecretsJson')"
      :rows="7"
      :disabled="saving"
      placeholder='{"totp":"valor-adicional-opcional"}'
    />

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <DhButton
        :label="t('agent.actions.cancel')"
        variant="secondary"
        :disabled="saving"
        @click.prevent="emit('cancel')"
      />
      <DhButton
        type="submit"
        :label="editing ? t('agent.actions.saveChanges') : t('agent.credentials.createTitle')"
        :loading="saving"
      />
    </div>
  </form>
</template>
