<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Bell, BellRing, Clock3, Eye, Plus, RefreshCw, Send, XCircle } from 'lucide-vue-next'
import { NotificationsService } from '@/core/services/notificationsService'
import { useToastStore } from '@/core/stores/toastStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useAuthStore } from '@/core/stores/authStore'
import { NOTIFICATIONS_SCOPES } from '@/core/auth/scopes'
import type { NotificationChannel, NotificationMessageDto, NotificationTemplateDto } from '@/core/interfaces/notifications'
import DhPageHeader from '@/shared/components/organisms/DhPageHeader.vue'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhSelect from '@/shared/components/atoms/DhSelect.vue'
import DhTextarea from '@/shared/components/atoms/DhTextarea.vue'
import DhBadge from '@/shared/components/atoms/DhBadge.vue'
import DhModal from '@/shared/components/organisms/DhModal.vue'
import DhEmptyState from '@/shared/components/atoms/DhEmptyState.vue'
import DhSearchInput from '@/shared/components/molecules/DhSearchInput.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'

const { t, locale } = useI18n()
const toast = useToastStore()
const modalStore = useModalStore()
const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const creating = ref(false)
const messages = ref<NotificationMessageDto[]>([])
const templates = ref<NotificationTemplateDto[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const search = ref('')
const status = ref('')
const channel = ref('')
const historyRecipient = ref('')
const historyEntityType = ref('')
const historyEntityId = ref('')
const createOpen = ref(false)
const detail = ref<NotificationMessageDto | null>(null)

const form = ref({
  notificationType: 'generic', templateCode: '', channel: 'System' as NotificationChannel,
  entityType: '', entityId: '', subject: '', body: '', payloadJson: '{}', scheduledForLocal: '',
  maxAttempts: 3, recipientAddress: auth.userId ?? '', recipientName: auth.userDisplayName ?? '',
})

const canCreate = computed(() => auth.hasScope(NOTIFICATIONS_SCOPES.messages.create))
const canViewTemplates = computed(() => auth.hasScope(NOTIFICATIONS_SCOPES.messages.view))
const canViewHistory = computed(() => auth.hasScope(NOTIFICATIONS_SCOPES.history.view))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const channelOptions = computed(() => [
  { value: '', label: t('notifications.filters.allChannels') },
  { value: 'System', label: t('notifications.channels.System') },
  { value: 'Email', label: t('notifications.channels.Email') },
  { value: 'WhatsAppFuture', label: t('notifications.channels.WhatsAppFuture') },
  { value: 'SmsFuture', label: t('notifications.channels.SmsFuture') },
  { value: 'WebhookFuture', label: t('notifications.channels.WebhookFuture') },
])
const createChannelOptions = computed(() => channelOptions.value.filter((x) => x.value))
const statusOptions = computed(() => [
  { value: '', label: t('notifications.filters.allStatuses') },
  ...['Pending', 'Scheduled', 'Processing', 'Sent', 'Failed', 'Retrying', 'Cancelled', 'DeadLetter'].map((value) => ({ value, label: t(`notifications.statuses.${value}`) })),
])
const templateOptions = computed(() => [
  { value: '', label: t('notifications.create.noTemplate') },
  ...templates.value.filter((x) => x.isActive && x.channel === form.value.channel).map((x) => ({ value: x.code, label: `${x.name} · ${x.code}` })),
])

async function load() {
  loading.value = true
  try {
    const response = canViewHistory.value && historyRecipient.value.trim()
      ? await NotificationsService.historyByRecipient(historyRecipient.value.trim(), page.value, pageSize)
      : canViewHistory.value && historyEntityType.value.trim() && historyEntityId.value.trim()
        ? await NotificationsService.historyByEntity(historyEntityType.value.trim(), historyEntityId.value.trim(), page.value, pageSize)
        : await NotificationsService.browseMessages({ pageNumber: page.value, pageSize, search: search.value || undefined, status: status.value || undefined, channel: channel.value || undefined })
    messages.value = response.items
    total.value = response.totalCount ?? response.items.length
  } catch (error) { toast.backendError(error, t('notifications.toasts.loadError')) }
  finally { loading.value = false }
}

async function loadTemplates() {
  try { templates.value = (await NotificationsService.browseTemplates({ pageNumber: 1, pageSize: 200, isActive: true })).items }
  catch { templates.value = [] }
}

function openCreate() {
  void router.push('/monitoring/notifications/new')
}

function onTemplateChanged() {
  const template = templates.value.find((x) => x.code === form.value.templateCode)
  if (!template) return
  form.value.notificationType = template.notificationType
  form.value.channel = template.channel
}

async function createNotification() {
  try { JSON.parse(form.value.payloadJson || '{}') }
  catch { toast.warning(t('notifications.toasts.invalidJsonTitle'), t('notifications.toasts.invalidJsonMessage')); return }
  if (!form.value.recipientAddress.trim()) { toast.warning(t('notifications.toasts.recipientRequiredTitle'), t('notifications.toasts.recipientRequiredMessage')); return }
  if (!form.value.templateCode && !form.value.body.trim()) { toast.warning(t('notifications.toasts.bodyRequiredTitle'), t('notifications.toasts.bodyRequiredMessage')); return }

  creating.value = true
  try {
    await NotificationsService.createMessage({
      notificationType: form.value.notificationType.trim(), templateCode: form.value.templateCode || null, channel: form.value.channel,
      entityType: form.value.entityType || null, entityId: form.value.entityId || null, subject: form.value.subject || null,
      body: form.value.body || null, payloadJson: form.value.payloadJson || '{}',
      scheduledForUtc: form.value.scheduledForLocal ? new Date(form.value.scheduledForLocal).toISOString() : null,
      maxAttempts: Math.min(20, Math.max(1, Number(form.value.maxAttempts) || 3)),
      recipients: [{ userId: form.value.channel === 'System' && isGuid(form.value.recipientAddress) ? form.value.recipientAddress : null, address: form.value.recipientAddress.trim(), displayName: form.value.recipientName || null }],
    })
    toast.success(t('notifications.toasts.createdTitle'), t('notifications.toasts.createdMessage'))
    createOpen.value = false
    page.value = 1
    await load()
  } catch (error) { toast.backendError(error, t('notifications.toasts.createError')) }
  finally { creating.value = false }
}

function cancelMessage(message: NotificationMessageDto) {
  modalStore.open({
    title: t('notifications.cancel'),
    component: DhConfirmDialog,
    size: 'md',
    props: {
      title: t('notifications.cancel'),
      message: t('notifications.cancelConfirm'),
      confirmLabel: t('notifications.cancel'),
      cancelLabel: t('common.cancel'),
      danger: true,
      onConfirm: async () => {
        try {
          await NotificationsService.cancelMessage(message.id)
          modalStore.close()
          toast.success(t('notifications.toasts.cancelledTitle'), t('notifications.toasts.cancelledMessage'))
          await load()
        } catch (error) {
          toast.backendError(error, t('notifications.toasts.cancelError'))
        }
      },
      onCancel: () => modalStore.close(),
    },
  })
}

function applyFilters() { page.value = 1; void load() }
function clearSearch() { search.value = ''; page.value = 1; void load() }
function clearHistoryFilters() { historyRecipient.value = ''; historyEntityType.value = ''; historyEntityId.value = ''; page.value = 1; void load() }
function changePage(next: number) { page.value = Math.min(Math.max(1, next), totalPages.value); void load() }
function isGuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function formatDate(value: string | null) {
  if (!value) return t('common.notAvailable')
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale.value === 'es' ? 'es-CR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
function badgeVariant(statusValue: string) {
  if (statusValue === 'Sent') return 'success'
  if (statusValue === 'Failed' || statusValue === 'DeadLetter') return 'danger'
  if (statusValue === 'Processing' || statusValue === 'Retrying') return 'warning'
  return 'primary'
}

onMounted(async () => { await Promise.all([load(), loadTemplates()]) })
</script>

<template>
  <section class="space-y-5 sm:space-y-6">
    <DhPageHeader :title="t('notifications.title')" :subtitle="t('notifications.subtitle')" :icon="Bell">
      <template #actions>
        <DhButton v-if="canViewTemplates" :icon="BellRing" :label="t('notifications.templatesButton')" variant="secondary" @click="router.push('/monitoring/notifications/templates')" />
        <DhButton :icon="RefreshCw" :label="t('common.refresh')" variant="secondary" :loading="loading" @click="load" />
        <DhButton v-if="canCreate" :icon="Plus" :label="t('notifications.create.button')" @click="openCreate" />
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[30px] p-3 sm:p-4">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
        <DhSearchInput v-model="search" :placeholder="t('notifications.filters.searchPlaceholder')" @search="applyFilters" @clear="clearSearch" />
        <DhSelect v-model="status" :options="statusOptions" :label="t('notifications.filters.status')" placeholder="" />
        <DhSelect v-model="channel" :options="channelOptions" :label="t('notifications.filters.channel')" placeholder="" />
        <DhButton class="w-full lg:self-end" :label="t('common.search')" variant="secondary" @click="applyFilters" />
      </div>
      <div v-if="canViewHistory" class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <DhInput v-model="historyRecipient" :label="t('notifications.filters.historyRecipient')" :placeholder="t('notifications.filters.historyRecipientPlaceholder')" />
        <DhInput v-model="historyEntityType" :label="t('notifications.filters.historyEntityType')" :placeholder="t('notifications.filters.historyEntityTypePlaceholder')" />
        <DhInput v-model="historyEntityId" :label="t('notifications.filters.historyEntityId')" :placeholder="t('notifications.filters.historyEntityIdPlaceholder')" />
        <div class="grid grid-cols-2 gap-2 xl:self-end"><DhButton :label="t('notifications.filters.historySearch')" variant="secondary" @click="applyFilters" /><DhButton :label="t('common.clear')" variant="ghost" @click="clearHistoryFilters" /></div>
      </div>
      <p v-if="canViewHistory" class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('notifications.filters.historyHelp') }}</p>
    </section>

    <DhEmptyState v-if="!loading && messages.length === 0" :icon="Bell" :title="t('notifications.emptyTitle')" :description="t('notifications.emptyDescription')" :action-label="canCreate ? t('notifications.create.button') : undefined" @action="openCreate" />

    <div v-else class="grid gap-3">
      <article v-for="message in messages" :key="message.id" class="dh-glass dh-liquid rounded-[28px] p-4 sm:p-5">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div class="min-w-0 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <DhBadge :variant="badgeVariant(message.status)">{{ t(`notifications.statuses.${message.status}`) }}</DhBadge>
              <DhBadge variant="neutral">{{ t(`notifications.channels.${message.channel}`) }}</DhBadge>
              <span class="break-all text-xs font-bold text-[var(--dh-text-muted)]">{{ message.id }}</span>
            </div>
            <h2 class="break-words text-lg font-black text-[var(--dh-text)]">{{ message.subject || message.notificationType }}</h2>
            <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('notifications.card.type') }}: {{ message.notificationType }} · {{ t('notifications.card.created') }}: {{ formatDate(message.createdAtUtc) }}</p>
            <p v-if="message.entityType || message.entityId" class="break-words text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('notifications.card.entity') }}: {{ message.entityType || '—' }} / {{ message.entityId || '—' }}</p>
            <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('notifications.card.recipients', { count: message.recipients.length }) }} · {{ t('notifications.card.attempts', { current: message.attemptCount, max: message.maxAttempts }) }}</p>
            <p v-if="message.lastErrorMessage" class="rounded-2xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-600 dark:text-red-300">{{ message.lastErrorMessage }}</p>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
            <DhButton :icon="Eye" :label="t('common.view')" variant="secondary" size="sm" @click="detail = message" />
            <DhButton v-if="canCreate && !['Sent', 'Cancelled', 'DeadLetter'].includes(message.status)" :icon="XCircle" :label="t('notifications.cancel')" variant="danger" size="sm" @click="cancelMessage(message)" />
          </div>
        </div>
      </article>
    </div>

    <section v-if="totalPages > 1" class="dh-glass dh-liquid flex flex-col gap-3 rounded-[26px] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <p class="text-center text-xs font-black text-[var(--dh-text-muted)] sm:text-left">{{ t('notifications.pagination', { page, totalPages, total }) }}</p>
      <div class="grid grid-cols-2 gap-2 sm:flex"><DhButton variant="secondary" :label="t('common.previous')" :disabled="page <= 1" @click="changePage(page - 1)" /><DhButton variant="secondary" :label="t('common.next')" :disabled="page >= totalPages" @click="changePage(page + 1)" /></div>
    </section>

    <DhModal :open="createOpen" :title="t('notifications.create.title')" size="xl" @close="createOpen = false">
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <DhInput v-model="form.notificationType" :label="t('notifications.create.notificationType')" />
          <DhSelect v-model="form.channel" :label="t('notifications.create.channel')" :options="createChannelOptions" placeholder="" @update:model-value="form.templateCode = ''" />
          <DhSelect v-model="form.templateCode" :label="t('notifications.create.template')" :options="templateOptions" placeholder="" @update:model-value="onTemplateChanged" />
          <DhInput v-model="form.scheduledForLocal" type="datetime-local" :label="t('notifications.create.schedule')" />
          <DhInput v-model="form.entityType" :label="t('notifications.create.entityType')" />
          <DhInput v-model="form.entityId" :label="t('notifications.create.entityId')" />
          <DhInput v-model="form.recipientAddress" :label="t('notifications.create.recipient')" :placeholder="form.channel === 'Email' ? t('notifications.create.emailPlaceholder') : t('notifications.create.systemRecipientPlaceholder')" />
          <DhInput v-model="form.recipientName" :label="t('notifications.create.recipientName')" />
          <DhInput v-model="form.maxAttempts" type="number" :label="t('notifications.create.maxAttempts')" />
          <DhInput v-model="form.subject" class="md:col-span-2" :label="t('notifications.create.subject')" />
        </div>
        <DhTextarea v-if="!form.templateCode" v-model="form.body" :label="t('notifications.create.body')" :rows="5" />
        <DhTextarea v-model="form.payloadJson" :label="t('notifications.create.payload')" :rows="8" />
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('notifications.create.payloadHelp') }}</p>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('notifications.create.maxAttemptsHelp') }}</p>
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><DhButton :label="t('common.cancel')" variant="secondary" @click="createOpen = false" /><DhButton :icon="form.scheduledForLocal ? Clock3 : Send" :label="form.scheduledForLocal ? t('notifications.create.scheduleButton') : t('notifications.create.sendButton')" :loading="creating" @click="createNotification" /></div>
      </div>
    </DhModal>

    <DhModal :open="Boolean(detail)" :title="t('notifications.detail.title')" size="xl" @close="detail = null">
      <div v-if="detail" class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-2xl bg-[var(--dh-input)] p-3"><p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('notifications.detail.status') }}</p><p class="mt-1 font-black">{{ t(`notifications.statuses.${detail.status}`) }}</p></div>
          <div class="rounded-2xl bg-[var(--dh-input)] p-3"><p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('notifications.detail.channel') }}</p><p class="mt-1 font-black">{{ t(`notifications.channels.${detail.channel}`) }}</p></div>
          <div class="rounded-2xl bg-[var(--dh-input)] p-3"><p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('notifications.detail.scheduled') }}</p><p class="mt-1 break-words font-black">{{ formatDate(detail.scheduledForUtc) }}</p></div>
          <div class="rounded-2xl bg-[var(--dh-input)] p-3"><p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('notifications.detail.nextAttempt') }}</p><p class="mt-1 break-words font-black">{{ formatDate(detail.nextAttemptAtUtc) }}</p></div>
          <div class="rounded-2xl bg-[var(--dh-input)] p-3"><p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('notifications.detail.sentAt') }}</p><p class="mt-1 break-words font-black">{{ formatDate(detail.sentAtUtc) }}</p></div>
          <div class="rounded-2xl bg-[var(--dh-input)] p-3"><p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('notifications.detail.errorCode') }}</p><p class="mt-1 break-all font-black">{{ detail.lastErrorCode || t('common.notAvailable') }}</p></div>
        </div>
        <div><h3 class="text-sm font-black">{{ t('notifications.detail.body') }}</h3><div class="mt-2 max-h-72 overflow-auto break-words rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-sm [&_*]:max-w-full" v-html="detail.body || ''" /></div>
        <div><h3 class="text-sm font-black">{{ t('notifications.detail.recipients') }}</h3><div class="mt-2 grid gap-2"><div v-for="recipient in detail.recipients" :key="recipient.id" class="rounded-2xl bg-[var(--dh-input)] p-3 text-sm font-semibold">{{ recipient.displayName || t('notifications.detail.unnamedRecipient') }} · {{ recipient.address }}</div></div></div>
        <div><h3 class="text-sm font-black">{{ t('notifications.detail.attempts') }}</h3><div class="mt-2 grid gap-2"><div v-for="attempt in detail.deliveryAttempts" :key="attempt.id" class="rounded-2xl border border-[var(--dh-border)] p-3 text-sm"><div class="flex flex-wrap justify-between gap-2"><strong>{{ t('notifications.detail.attemptNumber', { number: attempt.attemptNumber }) }}</strong><span>{{ attempt.succeeded ? t('notifications.detail.success') : t('notifications.detail.failure') }}</span></div><p class="mt-1 text-[var(--dh-text-muted)]">{{ attempt.provider || '—' }} · {{ attempt.errorMessage || t('notifications.detail.noError') }}</p></div><p v-if="detail.deliveryAttempts.length === 0" class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('notifications.detail.noAttempts') }}</p></div></div>
      </div>
    </DhModal>
  </section>
</template>
