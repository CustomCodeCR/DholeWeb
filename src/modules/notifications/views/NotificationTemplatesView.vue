<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Bell, BellRing, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-vue-next'
import { NotificationsService } from '@/core/services/notificationsService'
import { useToastStore } from '@/core/stores/toastStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useAuthStore } from '@/core/stores/authStore'
import { NOTIFICATIONS_SCOPES } from '@/core/auth/scopes'
import type { NotificationTemplateDto } from '@/core/interfaces/notifications'
import DhPageHeader from '@/shared/components/organisms/DhPageHeader.vue'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhBadge from '@/shared/components/atoms/DhBadge.vue'
import DhEmptyState from '@/shared/components/atoms/DhEmptyState.vue'
import DhSearchInput from '@/shared/components/molecules/DhSearchInput.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'

const { t, locale } = useI18n()
const router = useRouter()
const toast = useToastStore()
const modalStore = useModalStore()
const auth = useAuthStore()
const templates = ref<NotificationTemplateDto[]>([])
const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = 24
const total = ref(0)
const canManage = computed(() => auth.hasScope(NOTIFICATIONS_SCOPES.templates.manage))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

async function load() {
  loading.value = true
  try {
    const result = await NotificationsService.browseTemplates({ pageNumber: page.value, pageSize, search: search.value || undefined })
    templates.value = result.items
    total.value = result.totalCount ?? result.items.length
  } catch (error) { toast.backendError(error, t('notificationTemplates.toasts.loadError')) }
  finally { loading.value = false }
}
function applySearch() { page.value = 1; void load() }
function clearSearch() { search.value = ''; page.value = 1; void load() }
function changePage(next: number) { page.value = Math.min(Math.max(1, next), totalPages.value); void load() }
function open(template?: NotificationTemplateDto) { void router.push(template ? `/monitoring/notifications/templates/${template.id}` : '/monitoring/notifications/templates/new') }
async function toggle(template: NotificationTemplateDto) {
  try { await NotificationsService.setTemplateActive(template.id, !template.isActive); toast.success(t('notificationTemplates.toasts.updatedTitle'), t('notificationTemplates.toasts.updatedMessage')); await load() }
  catch (error) { toast.backendError(error, t('notificationTemplates.toasts.updateError')) }
}
function remove(template: NotificationTemplateDto) {
  modalStore.open({
    title: t('common.delete'),
    component: DhConfirmDialog,
    size: 'md',
    props: {
      title: t('common.delete'),
      message: t('notificationTemplates.deleteConfirm', { name: template.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      danger: true,
      onConfirm: async () => {
        try {
          await NotificationsService.deleteTemplate(template.id)
          modalStore.close()
          toast.success(t('notificationTemplates.toasts.deletedTitle'), template.name)
          await load()
        } catch (error) {
          toast.backendError(error, t('notificationTemplates.toasts.deleteError'))
        }
      },
      onCancel: () => modalStore.close(),
    },
  })
}
function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale.value === 'es' ? 'es-CR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
onMounted(load)
</script>

<template>
  <section class="space-y-5 sm:space-y-6">
    <DhPageHeader :title="t('notificationTemplates.title')" :subtitle="t('notificationTemplates.subtitle')" :icon="BellRing">
      <template #actions>
        <DhButton :icon="Bell" :label="t('notificationTemplates.notificationsButton')" variant="secondary" @click="router.push('/monitoring/notifications')" />
        <DhButton :icon="RefreshCw" :label="t('common.refresh')" variant="secondary" :loading="loading" @click="load" />
        <DhButton v-if="canManage" :icon="Plus" :label="t('notificationTemplates.newTemplate')" @click="open()" />
      </template>
    </DhPageHeader>
    <section class="dh-glass dh-liquid rounded-[30px] p-3 sm:p-4"><DhSearchInput v-model="search" :placeholder="t('notificationTemplates.searchPlaceholder')" @search="applySearch" @clear="clearSearch" /></section>
    <DhEmptyState v-if="!loading && templates.length === 0" :icon="BellRing" :title="t('notificationTemplates.emptyTitle')" :description="t('notificationTemplates.emptyDescription')" :action-label="canManage ? t('notificationTemplates.newTemplate') : undefined" @action="open()" />
    <div v-else class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      <article v-for="template in templates" :key="template.id" class="dh-glass dh-liquid flex min-w-0 flex-col rounded-[30px] p-4 sm:p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0"><p class="break-words text-lg font-black text-[var(--dh-text)]">{{ template.name }}</p><p class="mt-1 break-all text-xs font-bold text-[var(--dh-text-muted)]">{{ template.code }}</p></div>
          <DhBadge :variant="template.isActive ? 'success' : 'neutral'">{{ template.isActive ? t('common.active') : t('common.inactive') }}</DhBadge>
        </div>
        <p class="mt-3 line-clamp-2 min-h-10 text-sm font-semibold text-[var(--dh-text-muted)]">{{ template.description || t('notificationTemplates.noDescription') }}</p>
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[var(--dh-text-muted)]"><div class="rounded-2xl bg-[var(--dh-input)] p-3"><span class="block">{{ t('notificationTemplates.channel') }}</span><strong class="mt-1 block text-[var(--dh-text)]">{{ t(`notifications.channels.${template.channel}`) }}</strong></div><div class="rounded-2xl bg-[var(--dh-input)] p-3"><span class="block">{{ t('notificationTemplates.type') }}</span><strong class="mt-1 block break-words text-[var(--dh-text)]">{{ template.notificationType }}</strong></div></div>
        <p class="mt-3 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('notificationTemplates.updated', { date: formatDate(template.updatedAtUtc || template.createdAtUtc) }) }}</p>
        <div class="mt-auto grid grid-cols-2 gap-2 border-t border-[var(--dh-border)] pt-4 sm:flex sm:flex-wrap">
          <DhButton :icon="Pencil" :label="canManage ? t('common.edit') : t('common.view')" variant="secondary" size="sm" @click="open(template)" />
          <DhButton v-if="canManage" :label="template.isActive ? t('notificationTemplates.deactivate') : t('notificationTemplates.activate')" variant="secondary" size="sm" @click="toggle(template)" />
          <DhButton v-if="canManage" :icon="Trash2" :label="t('common.delete')" variant="danger" size="sm" class="sm:ml-auto" @click="remove(template)" />
        </div>
      </article>
    </div>
    <section v-if="totalPages > 1" class="dh-glass dh-liquid flex flex-col gap-3 rounded-[26px] p-3 sm:flex-row sm:items-center sm:justify-between"><p class="text-center text-xs font-black text-[var(--dh-text-muted)]">{{ t('notificationTemplates.pagination', { page, totalPages, total }) }}</p><div class="grid grid-cols-2 gap-2"><DhButton variant="secondary" :label="t('common.previous')" :disabled="page <= 1" @click="changePage(page - 1)" /><DhButton variant="secondary" :label="t('common.next')" :disabled="page >= totalPages" @click="changePage(page + 1)" /></div></section>
  </section>
</template>
