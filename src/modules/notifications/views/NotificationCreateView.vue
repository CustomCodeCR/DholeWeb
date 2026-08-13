<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowLeft, BellPlus, Clock3, Send } from 'lucide-vue-next'
import { NotificationsService } from '@/core/services/notificationsService'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import type {
  CreateNotificationMessageRequest,
  NotificationChannel,
  NotificationTemplateDto,
} from '@/core/interfaces/notifications'
import DhPageHeader from '@/shared/components/organisms/DhPageHeader.vue'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhSelect from '@/shared/components/atoms/DhSelect.vue'
import DhTextarea from '@/shared/components/atoms/DhTextarea.vue'

const { t } = useI18n()
const router = useRouter()
const toast = useToastStore()
const auth = useAuthStore()

const saving = ref(false)
const loadingTemplates = ref(false)
const templates = ref<NotificationTemplateDto[]>([])

const form = ref({
  notificationType: 'generic',
  templateCode: '',
  channel: 'System' as NotificationChannel,
  entityType: '',
  entityId: '',
  subject: '',
  body: '',
  payloadJson: '{}',
  scheduledForLocal: '',
  maxAttempts: 3,
  recipientAddress: auth.userId ?? '',
  recipientName: auth.userDisplayName ?? '',
})

const channelOptions = computed(() => [
  { value: 'System', label: t('notifications.channels.System') },
  { value: 'Email', label: t('notifications.channels.Email') },
  { value: 'WhatsAppFuture', label: t('notifications.channels.WhatsAppFuture') },
  { value: 'SmsFuture', label: t('notifications.channels.SmsFuture') },
  { value: 'WebhookFuture', label: t('notifications.channels.WebhookFuture') },
])

const templateOptions = computed(() => [
  { value: '', label: t('notifications.create.noTemplate') },
  ...templates.value
    .filter((template) => template.isActive && template.channel === form.value.channel)
    .map((template) => ({ value: template.code, label: `${template.name} · ${template.code}` })),
])

function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function onChannelChanged() {
  form.value.templateCode = ''

  if (form.value.channel === 'System') {
    form.value.recipientAddress = auth.userId ?? ''
    form.value.recipientName = auth.userDisplayName ?? ''
    return
  }

  if (form.value.channel === 'Email') {
    form.value.recipientAddress = auth.email ?? ''
    form.value.recipientName = auth.userDisplayName ?? ''
    return
  }

  form.value.recipientAddress = ''
}

function onTemplateChanged() {
  const template = templates.value.find((item) => item.code === form.value.templateCode)
  if (!template) return

  form.value.notificationType = template.notificationType
  form.value.channel = template.channel as NotificationChannel
}

async function loadTemplates() {
  loadingTemplates.value = true
  try {
    const response = await NotificationsService.browseTemplates({
      pageNumber: 1,
      pageSize: 200,
      isActive: true,
    })
    templates.value = response.items
  } catch {
    // Templates are optional when creating a notification. Keep the page usable
    // even when the current user can create messages but cannot browse templates.
    templates.value = []
  } finally {
    loadingTemplates.value = false
  }
}

function buildPayload(): CreateNotificationMessageRequest | null {
  const notificationType = form.value.notificationType.trim()
  const recipientAddress = form.value.recipientAddress.trim()
  const recipientName = form.value.recipientName.trim()
  const body = form.value.body.trim()

  if (!notificationType) {
    toast.warning(t('notifications.toasts.typeRequiredTitle'), t('notifications.toasts.typeRequiredMessage'))
    return null
  }

  if (!recipientAddress) {
    toast.warning(t('notifications.toasts.recipientRequiredTitle'), t('notifications.toasts.recipientRequiredMessage'))
    return null
  }

  if (form.value.channel === 'Email' && !isEmail(recipientAddress)) {
    toast.warning(t('notifications.toasts.invalidEmailTitle'), t('notifications.toasts.invalidEmailMessage'))
    return null
  }

  if (!form.value.templateCode && !body) {
    toast.warning(t('notifications.toasts.bodyRequiredTitle'), t('notifications.toasts.bodyRequiredMessage'))
    return null
  }

  let normalizedPayload = '{}'
  try {
    const parsed = JSON.parse(form.value.payloadJson || '{}')
    normalizedPayload = JSON.stringify(parsed)
  } catch {
    toast.warning(t('notifications.toasts.invalidJsonTitle'), t('notifications.toasts.invalidJsonMessage'))
    return null
  }

  let scheduledForUtc: string | null = null
  if (form.value.scheduledForLocal) {
    const scheduled = new Date(form.value.scheduledForLocal)
    if (Number.isNaN(scheduled.getTime())) {
      toast.warning(t('notifications.toasts.invalidScheduleTitle'), t('notifications.toasts.invalidScheduleMessage'))
      return null
    }
    scheduledForUtc = scheduled.toISOString()
  }

  return {
    notificationType,
    templateCode: form.value.templateCode || null,
    channel: form.value.channel,
    entityType: form.value.entityType.trim() || null,
    entityId: form.value.entityId.trim() || null,
    subject: form.value.subject.trim() || null,
    body: form.value.templateCode ? null : body || null,
    payloadJson: normalizedPayload,
    scheduledForUtc,
    maxAttempts: Math.min(20, Math.max(1, Number(form.value.maxAttempts) || 3)),
    recipients: [
      {
        userId:
          form.value.channel === 'System' && isGuid(recipientAddress)
            ? recipientAddress
            : null,
        address: recipientAddress,
        displayName: recipientName || null,
      },
    ],
  }
}

async function submit() {
  const payload = buildPayload()
  if (!payload || saving.value) return

  saving.value = true
  try {
    await NotificationsService.createMessage(payload)
    toast.success(t('notifications.toasts.createdTitle'), t('notifications.toasts.createdMessage'))
    await router.push('/monitoring/notifications')
  } catch (error) {
    toast.backendError(error, t('notifications.toasts.createError'))
  } finally {
    saving.value = false
  }
}

onMounted(loadTemplates)
</script>

<template>
  <section class="space-y-5 sm:space-y-6">
    <DhPageHeader
      :title="t('notifications.create.title')"
      :subtitle="t('notifications.create.pageSubtitle')"
      :icon="BellPlus"
    >
      <template #actions>
        <DhButton
          :icon="ArrowLeft"
          :label="t('notifications.create.backToNotifications')"
          variant="secondary"
          @click="router.push('/monitoring/notifications')"
        />
      </template>
    </DhPageHeader>

    <form class="dh-glass dh-liquid rounded-[30px] p-4 sm:p-5 lg:p-6" @submit.prevent="submit">
      <div class="grid gap-4 md:grid-cols-2">
        <DhInput
          v-model="form.notificationType"
          :label="t('notifications.create.notificationType')"
          :placeholder="t('notifications.create.notificationTypePlaceholder')"
        />

        <DhSelect
          v-model="form.channel"
          :label="t('notifications.create.channel')"
          :options="channelOptions"
          placeholder=""
          @update:model-value="onChannelChanged"
        />

        <DhSelect
          v-model="form.templateCode"
          :label="t('notifications.create.template')"
          :options="templateOptions"
          :disabled="loadingTemplates"
          placeholder=""
          @update:model-value="onTemplateChanged"
        />

        <DhInput
          v-model="form.scheduledForLocal"
          type="datetime-local"
          :label="t('notifications.create.schedule')"
        />

        <DhInput v-model="form.entityType" :label="t('notifications.create.entityType')" />
        <DhInput v-model="form.entityId" :label="t('notifications.create.entityId')" />

        <DhInput
          v-model="form.recipientAddress"
          :label="t('notifications.create.recipient')"
          :placeholder="
            form.channel === 'Email'
              ? t('notifications.create.emailPlaceholder')
              : t('notifications.create.systemRecipientPlaceholder')
          "
        />

        <DhInput
          v-model="form.recipientName"
          :label="t('notifications.create.recipientName')"
        />

        <DhInput
          v-model="form.maxAttempts"
          type="number"
          min="1"
          max="20"
          :label="t('notifications.create.maxAttempts')"
        />

        <DhInput
          v-model="form.subject"
          :label="t('notifications.create.subject')"
          class="md:col-span-2"
        />
      </div>

      <div class="mt-4 grid gap-4">
        <DhTextarea
          v-if="!form.templateCode"
          v-model="form.body"
          :label="t('notifications.create.body')"
          :rows="6"
        />

        <DhTextarea
          v-model="form.payloadJson"
          :label="t('notifications.create.payload')"
          :rows="7"
        />

        <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 sm:p-4">
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ t('notifications.create.payloadHelp') }}
          </p>
          <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ t('notifications.create.maxAttemptsHelp') }}
          </p>
        </div>
      </div>

      <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <DhButton
          type="button"
          :label="t('common.cancel')"
          variant="secondary"
          @click="router.push('/monitoring/notifications')"
        />
        <DhButton
          type="submit"
          :icon="form.scheduledForLocal ? Clock3 : Send"
          :label="
            form.scheduledForLocal
              ? t('notifications.create.scheduleButton')
              : t('notifications.create.sendButton')
          "
          :loading="saving"
        />
      </div>
    </form>
  </section>
</template>
