<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { BellRing, Code2, Eye, Save } from 'lucide-vue-next'
import { NotificationsService } from '@/core/services/notificationsService'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { NOTIFICATIONS_SCOPES } from '@/core/auth/scopes'
import type { NotificationChannel } from '@/core/interfaces/notifications'
import DhPageHeader from '@/shared/components/organisms/DhPageHeader.vue'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhTextarea from '@/shared/components/atoms/DhTextarea.vue'
import DhSelect from '@/shared/components/atoms/DhSelect.vue'
import DhSpinner from '@/shared/components/atoms/DhSpinner.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const auth = useAuthStore()

const templateId = computed(() => (typeof route.params.id === 'string' ? route.params.id.trim() : ''))
const isNew = computed(() => route.name === 'notifications-template-create' || !templateId.value)
const canManage = computed(() => auth.hasScope(NOTIFICATIONS_SCOPES.templates.manage))

const loading = ref(false)
const saving = ref(false)
const editorMode = ref<'editor' | 'preview'>('editor')

const form = ref({
  code: '',
  name: '',
  description: '',
  notificationType: 'generic',
  channel: 'System' as NotificationChannel,
  subjectTemplate: '',
  bodyTemplate: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">
  <h2 style="margin:0 0 16px">Título de la notificación</h2>
  <p style="margin:0">Hola {{name}}, escriba aquí el contenido de la notificación.</p>
</div>`,
})

const channelOptions = computed(() =>
  ['System', 'Email', 'WhatsAppFuture', 'SmsFuture', 'WebhookFuture'].map((value) => ({
    value,
    label: t(`notifications.channels.${value}`),
  })),
)

async function load() {
  if (isNew.value) return

  loading.value = true
  try {
    const template = await NotificationsService.getTemplate(templateId.value)
    form.value = {
      code: template.code,
      name: template.name,
      description: template.description ?? '',
      notificationType: template.notificationType,
      channel: template.channel,
      subjectTemplate: template.subjectTemplate ?? '',
      bodyTemplate: template.bodyTemplate ?? '',
    }
  } catch (error) {
    toast.backendError(error, t('notificationDesigner.toasts.loadError'))
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!canManage.value) return

  const code = form.value.code.trim()
  const name = form.value.name.trim()
  const notificationType = form.value.notificationType.trim()
  const bodyTemplate = form.value.bodyTemplate.trim()

  if (!code || !name || !notificationType) {
    toast.warning(
      t('notificationDesigner.toasts.requiredTitle'),
      t('notificationDesigner.toasts.requiredMessage'),
    )
    return
  }

  if (!bodyTemplate) {
    toast.warning(
      t('notificationDesigner.toasts.emptyTitle'),
      t('notificationDesigner.toasts.emptyMessage'),
    )
    return
  }

  saving.value = true
  try {
    const payload = {
      name,
      description: form.value.description.trim() || null,
      notificationType,
      channel: form.value.channel,
      subjectTemplate: form.value.subjectTemplate.trim() || null,
      bodyTemplate,
      designerJson: JSON.stringify({ version: 1, mode: 'html' }),
    }

    if (isNew.value) {
      await NotificationsService.createTemplate({ code, ...payload })
    } else {
      await NotificationsService.updateTemplate(templateId.value, payload)
    }

    toast.success(
      t('notificationDesigner.toasts.savedTitle'),
      t('notificationDesigner.toasts.savedMessage'),
    )
    await router.push('/monitoring/notifications/templates')
  } catch (error) {
    toast.backendError(error, t('notificationDesigner.toasts.saveError'))
  } finally {
    saving.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <section class="space-y-5 sm:space-y-6">
    <DhPageHeader
      :title="isNew ? t('notificationDesigner.createTitle') : t('notificationDesigner.editTitle')"
      :subtitle="t('notificationDesigner.subtitle')"
      :icon="BellRing"
    >
      <template #actions>
        <DhButton
          :label="t('common.back')"
          variant="secondary"
          @click="router.push('/monitoring/notifications/templates')"
        />
        <DhButton
          v-if="canManage"
          :icon="Save"
          :label="t('common.save')"
          :loading="saving"
          @click="save"
        />
      </template>
    </DhPageHeader>

    <div v-if="loading" class="dh-glass dh-liquid flex min-h-64 items-center justify-center rounded-[30px]">
      <DhSpinner />
    </div>

    <template v-else>
      <section class="dh-glass dh-liquid rounded-[30px] p-4 sm:p-5">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DhInput
            v-model="form.code"
            :label="t('notificationDesigner.fields.code')"
            :disabled="!isNew || !canManage"
          />
          <DhInput
            v-model="form.name"
            :label="t('notificationDesigner.fields.name')"
            :disabled="!canManage"
          />
          <DhInput
            v-model="form.notificationType"
            :label="t('notificationDesigner.fields.notificationType')"
            :disabled="!canManage"
          />
          <DhSelect
            v-model="form.channel"
            :label="t('notificationDesigner.fields.channel')"
            :options="channelOptions"
            placeholder=""
            :disabled="!canManage"
          />
          <DhInput
            v-model="form.subjectTemplate"
            class="md:col-span-2"
            :label="t('notificationDesigner.fields.subject')"
            :disabled="!canManage"
          />
          <DhInput
            v-model="form.description"
            class="md:col-span-2"
            :label="t('notificationDesigner.fields.description')"
            :disabled="!canManage"
          />
        </div>
        <p class="mt-3 text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ t('notificationDesigner.variablesHelp') }}
        </p>
      </section>

      <section class="dh-glass dh-liquid overflow-hidden rounded-[30px]">
        <div class="flex flex-col gap-3 border-b border-[var(--dh-border)] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div>
            <h2 class="text-sm font-black text-[var(--dh-text)]">Contenido de la plantilla</h2>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              Puede escribir HTML o texto y utilizar variables como &#123;&#123;name&#125;&#125;, &#123;&#123;entityId&#125;&#125; y &#123;&#123;actionUrl&#125;&#125;.
            </p>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <DhButton
              :icon="Code2"
              label="Editor"
              size="sm"
              :variant="editorMode === 'editor' ? 'primary' : 'secondary'"
              @click="editorMode = 'editor'"
            />
            <DhButton
              :icon="Eye"
              label="Vista previa"
              size="sm"
              :variant="editorMode === 'preview' ? 'primary' : 'secondary'"
              @click="editorMode = 'preview'"
            />
          </div>
        </div>

        <div class="p-3 sm:p-5">
          <DhTextarea
            v-if="editorMode === 'editor'"
            v-model="form.bodyTemplate"
            label="Cuerpo de la notificación"
            :rows="20"
            :disabled="!canManage"
          />

          <div
            v-else
            class="min-h-[420px] overflow-auto rounded-[24px] border border-[var(--dh-border)] bg-slate-100 p-3 sm:p-6"
          >
            <div
              class="mx-auto min-h-[300px] max-w-[760px] rounded-2xl bg-white p-5 text-slate-900 shadow-sm"
              v-html="form.bodyTemplate"
            />
          </div>
        </div>
      </section>
    </template>
  </section>
</template>
