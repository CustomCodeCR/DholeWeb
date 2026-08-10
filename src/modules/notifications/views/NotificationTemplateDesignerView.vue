<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { AlignLeft, BellRing, Heading, Minus, MousePointerClick, Move, Plus, Save, Text, Trash2, TriangleAlert } from 'lucide-vue-next'
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

interface DesignerBlock { id: string; type: 'heading' | 'text' | 'button' | 'divider' | 'alert' | 'spacer'; text?: string; url?: string; align?: 'left' | 'center' | 'right'; size?: number }
interface PaletteItem { type: DesignerBlock['type']; icon: typeof Heading; labelKey: string; descriptionKey: string }

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const auth = useAuthStore()
const id = computed(() => typeof route.params.id === 'string' ? route.params.id : null)
const isNew = computed(() => route.name === 'notifications-template-create')
const canManage = computed(() => auth.hasScope(NOTIFICATIONS_SCOPES.templates.manage))
const loading = ref(false)
const saving = ref(false)
const selectedId = ref<string | null>(null)
const dragBlockIndex = ref<number | null>(null)
const blocks = ref<DesignerBlock[]>([])
const form = ref({ code: '', name: '', description: '', notificationType: 'generic', channel: 'System' as NotificationChannel, subjectTemplate: '' })

const palette: PaletteItem[] = [
  { type: 'heading', icon: Heading, labelKey: 'notificationDesigner.blocks.heading', descriptionKey: 'notificationDesigner.blocks.headingHelp' },
  { type: 'text', icon: Text, labelKey: 'notificationDesigner.blocks.text', descriptionKey: 'notificationDesigner.blocks.textHelp' },
  { type: 'button', icon: MousePointerClick, labelKey: 'notificationDesigner.blocks.button', descriptionKey: 'notificationDesigner.blocks.buttonHelp' },
  { type: 'alert', icon: TriangleAlert, labelKey: 'notificationDesigner.blocks.alert', descriptionKey: 'notificationDesigner.blocks.alertHelp' },
  { type: 'divider', icon: Minus, labelKey: 'notificationDesigner.blocks.divider', descriptionKey: 'notificationDesigner.blocks.dividerHelp' },
  { type: 'spacer', icon: Move, labelKey: 'notificationDesigner.blocks.spacer', descriptionKey: 'notificationDesigner.blocks.spacerHelp' },
]
const channelOptions = computed(() => ['System', 'Email', 'WhatsAppFuture', 'SmsFuture', 'WebhookFuture'].map((value) => ({ value, label: t(`notifications.channels.${value}`) })))
const selectedBlock = computed(() => blocks.value.find((x) => x.id === selectedId.value) ?? null)
const generatedBody = computed(() => renderHtml(blocks.value))

function newId() { return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}` }
function createBlock(type: DesignerBlock['type']): DesignerBlock {
  if (type === 'heading') return { id: newId(), type, text: t('notificationDesigner.defaults.heading'), align: 'left' }
  if (type === 'text') return { id: newId(), type, text: t('notificationDesigner.defaults.text'), align: 'left' }
  if (type === 'button') return { id: newId(), type, text: t('notificationDesigner.defaults.button'), url: '{{actionUrl}}', align: 'center' }
  if (type === 'alert') return { id: newId(), type, text: t('notificationDesigner.defaults.alert'), align: 'left' }
  if (type === 'spacer') return { id: newId(), type, size: 24 }
  return { id: newId(), type: 'divider' }
}
function addBlock(type: DesignerBlock['type'], index = blocks.value.length) {
  if (!canManage.value) return
  const block = createBlock(type)
  blocks.value.splice(index, 0, block)
  selectedId.value = block.id
}
function removeBlock(blockId: string) {
  if (!canManage.value) return
  const index = blocks.value.findIndex((x) => x.id === blockId)
  if (index >= 0) blocks.value.splice(index, 1)
  if (selectedId.value === blockId) selectedId.value = null
}
function paletteDragStart(event: DragEvent, type: DesignerBlock['type']) {
  if (!event.dataTransfer || !canManage.value) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', `palette:${type}`)
}
function blockDragStart(event: DragEvent, index: number) {
  if (!event.dataTransfer || !canManage.value) return
  dragBlockIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', `block:${index}`)
}
function dropAt(event: DragEvent, index: number) {
  event.preventDefault()
  if (!canManage.value) return
  const data = event.dataTransfer?.getData('text/plain') ?? ''
  if (data.startsWith('palette:')) {
    addBlock(data.slice(8) as DesignerBlock['type'], index)
    return
  }
  if (data.startsWith('block:')) {
    const source = Number(data.slice(6))
    if (!Number.isInteger(source) || source < 0 || source >= blocks.value.length) return
    const [block] = blocks.value.splice(source, 1)
    if (!block) return
    const target = source < index ? index - 1 : index
    blocks.value.splice(Math.max(0, Math.min(target, blocks.value.length)), 0, block)
    selectedId.value = block.id
  }
  dragBlockIndex.value = null
}
function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
function renderHtml(items: DesignerBlock[]) {
  const content = items.map((block) => {
    const align = block.align ?? 'left'
    if (block.type === 'heading') return `<h2 style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:26px;line-height:1.25;color:#172033;text-align:${align}">${escapeHtml(block.text ?? '')}</h2>`
    if (block.type === 'text') return `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#475569;text-align:${align}">${escapeHtml(block.text ?? '').replaceAll('\n', '<br>')}</p>`
    if (block.type === 'button') return `<div style="margin:20px 0;text-align:${align}"><a href="${escapeHtml(block.url ?? '#')}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700">${escapeHtml(block.text ?? '')}</a></div>`
    if (block.type === 'alert') return `<div style="margin:16px 0;padding:14px 16px;border-left:4px solid #f59e0b;border-radius:8px;background:#fffbeb;font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#92400e;text-align:${align}">${escapeHtml(block.text ?? '')}</div>`
    if (block.type === 'divider') return '<hr style="margin:22px 0;border:0;border-top:1px solid #e2e8f0">'
    return `<div style="height:${Math.max(8, Math.min(96, block.size ?? 24))}px;line-height:${Math.max(8, Math.min(96, block.size ?? 24))}px">&nbsp;</div>`
  }).join('')
  return `<div style="max-width:680px;margin:0 auto;padding:24px;background:#ffffff">${content}</div>`
}
async function load() {
  if (isNew.value || !id.value) { blocks.value = [createBlock('heading'), createBlock('text'), createBlock('button')]; return }
  loading.value = true
  try {
    const template = await NotificationsService.getTemplate(id.value)
    form.value = { code: template.code, name: template.name, description: template.description ?? '', notificationType: template.notificationType, channel: template.channel, subjectTemplate: template.subjectTemplate ?? '' }
    try { blocks.value = JSON.parse(template.designerJson) as DesignerBlock[] }
    catch { blocks.value = [{ id: newId(), type: 'text', text: template.bodyTemplate }] }
  } catch (error) { toast.backendError(error, t('notificationDesigner.toasts.loadError')) }
  finally { loading.value = false }
}
async function save() {
  if (!canManage.value) return
  if (!form.value.code.trim() || !form.value.name.trim() || !form.value.notificationType.trim()) { toast.warning(t('notificationDesigner.toasts.requiredTitle'), t('notificationDesigner.toasts.requiredMessage')); return }
  if (blocks.value.length === 0) { toast.warning(t('notificationDesigner.toasts.emptyTitle'), t('notificationDesigner.toasts.emptyMessage')); return }
  saving.value = true
  try {
    const payload = { name: form.value.name.trim(), description: form.value.description || null, notificationType: form.value.notificationType.trim(), channel: form.value.channel, subjectTemplate: form.value.subjectTemplate || null, bodyTemplate: generatedBody.value, designerJson: JSON.stringify(blocks.value) }
    if (isNew.value) await NotificationsService.createTemplate({ code: form.value.code.trim(), ...payload })
    else if (id.value) await NotificationsService.updateTemplate(id.value, payload)
    toast.success(t('notificationDesigner.toasts.savedTitle'), t('notificationDesigner.toasts.savedMessage'))
    await router.push('/notifications/templates')
  } catch (error) { toast.backendError(error, t('notificationDesigner.toasts.saveError')) }
  finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <section class="space-y-5 sm:space-y-6">
    <DhPageHeader :title="isNew ? t('notificationDesigner.createTitle') : t('notificationDesigner.editTitle')" :subtitle="t('notificationDesigner.subtitle')" :icon="BellRing">
      <template #actions><DhButton :label="t('common.back')" variant="secondary" @click="router.push('/notifications/templates')" /><DhButton v-if="canManage" :icon="Save" :label="t('common.save')" :loading="saving" @click="save" /></template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[30px] p-4 sm:p-5">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DhInput v-model="form.code" :label="t('notificationDesigner.fields.code')" :disabled="!isNew || !canManage" />
        <DhInput v-model="form.name" :label="t('notificationDesigner.fields.name')" :disabled="!canManage" />
        <DhInput v-model="form.notificationType" :label="t('notificationDesigner.fields.notificationType')" :disabled="!canManage" />
        <DhSelect v-model="form.channel" :label="t('notificationDesigner.fields.channel')" :options="channelOptions" placeholder="" :disabled="!canManage" />
        <DhInput v-model="form.subjectTemplate" class="md:col-span-2" :label="t('notificationDesigner.fields.subject')" :disabled="!canManage" />
        <DhInput v-model="form.description" class="md:col-span-2" :label="t('notificationDesigner.fields.description')" :disabled="!canManage" />
      </div>
      <p class="mt-3 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('notificationDesigner.variablesHelp') }}</p>
    </section>

    <div class="grid min-w-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <aside class="dh-glass dh-liquid rounded-[28px] p-4 xl:sticky xl:top-4 xl:self-start">
        <h2 class="text-sm font-black text-[var(--dh-text)]">{{ t('notificationDesigner.paletteTitle') }}</h2>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('notificationDesigner.paletteHelp') }}</p>
        <div class="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <div v-for="item in palette" :key="item.type" draggable="true" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3" :class="canManage ? 'cursor-grab active:cursor-grabbing' : 'opacity-70'" @dragstart="paletteDragStart($event, item.type)">
            <div class="flex items-center gap-3"><div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl dh-bg-primary-soft text-[var(--dh-primary)]"><component :is="item.icon" class="h-4 w-4" /></div><div class="min-w-0 flex-1"><p class="text-sm font-black">{{ t(item.labelKey) }}</p><p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ t(item.descriptionKey) }}</p></div><Move class="hidden h-4 w-4 text-[var(--dh-text-muted)] xl:block" /></div>
            <DhButton v-if="canManage" class="mt-2 w-full xl:hidden" size="sm" variant="secondary" :icon="Plus" :label="t('notificationDesigner.addBlock')" @click="addBlock(item.type)" />
          </div>
        </div>
      </aside>

      <main class="min-w-0 space-y-3">
        <div class="flex items-center justify-between gap-3"><div><h2 class="text-sm font-black">{{ t('notificationDesigner.canvasTitle') }}</h2><p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('notificationDesigner.canvasHelp') }}</p></div><span class="rounded-full bg-[var(--dh-input)] px-3 py-1 text-xs font-black text-[var(--dh-text-muted)]">{{ t('notificationDesigner.blockCount', { count: blocks.length }) }}</span></div>
        <div class="min-h-[420px] rounded-[30px] border-2 border-dashed border-[var(--dh-border)] bg-[var(--dh-input)] p-3 sm:p-5" @dragover.prevent @drop="dropAt($event, blocks.length)">
          <div v-if="blocks.length === 0" class="flex min-h-[360px] items-center justify-center text-center"><div><AlignLeft class="mx-auto h-9 w-9 text-[var(--dh-primary)]" /><p class="mt-3 font-black">{{ t('notificationDesigner.emptyCanvasTitle') }}</p><p class="mt-1 max-w-sm text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('notificationDesigner.emptyCanvasDescription') }}</p></div></div>
          <div v-else class="mx-auto max-w-[720px] space-y-2">
            <template v-for="(block, index) in blocks" :key="block.id">
              <div class="h-2 rounded-full transition hover:bg-[var(--dh-primary)]/20" @dragover.prevent @drop.stop="dropAt($event, index)" />
              <div draggable="true" class="group relative rounded-[20px] border bg-white p-3 shadow-sm transition" :class="selectedId === block.id ? 'border-[var(--dh-primary)] ring-2 ring-[var(--dh-primary)]/15' : 'border-slate-200'" @click="selectedId = block.id" @dragstart="blockDragStart($event, index)">
                <div class="absolute right-2 top-2 z-10 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><button v-if="canManage" type="button" class="rounded-lg bg-white p-1.5 text-slate-500 shadow hover:text-red-600" :aria-label="t('notificationDesigner.removeBlock')" @click.stop="removeBlock(block.id)"><Trash2 class="h-4 w-4" /></button></div>
                <h2 v-if="block.type === 'heading'" class="pr-10 text-[26px] font-bold leading-tight text-slate-800" :style="{ textAlign: block.align }">{{ block.text }}</h2>
                <p v-else-if="block.type === 'text'" class="whitespace-pre-wrap pr-10 text-[15px] leading-6 text-slate-600" :style="{ textAlign: block.align }">{{ block.text }}</p>
                <div v-else-if="block.type === 'button'" class="pr-10" :style="{ textAlign: block.align }"><span class="inline-block rounded-[10px] bg-blue-600 px-5 py-3 text-sm font-bold text-white">{{ block.text }}</span></div>
                <div v-else-if="block.type === 'alert'" class="mr-8 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-sm font-semibold text-amber-900" :style="{ textAlign: block.align }">{{ block.text }}</div>
                <hr v-else-if="block.type === 'divider'" class="my-2 border-slate-200" />
                <div v-else class="rounded-lg bg-slate-50 text-center text-[10px] font-bold text-slate-400" :style="{ height: `${block.size ?? 24}px`, lineHeight: `${block.size ?? 24}px` }">{{ t('notificationDesigner.blocks.spacer') }}</div>
              </div>
            </template>
            <div class="h-4 rounded-full transition hover:bg-[var(--dh-primary)]/20" @dragover.prevent @drop.stop="dropAt($event, blocks.length)" />
          </div>
        </div>

        <section class="dh-glass dh-liquid rounded-[28px] p-4"><h2 class="text-sm font-black">{{ t('notificationDesigner.previewTitle') }}</h2><p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('notificationDesigner.previewHelp') }}</p><div class="mt-4 overflow-auto rounded-[22px] border border-[var(--dh-border)] bg-slate-100 p-2 sm:p-5"><div class="mx-auto min-w-[280px] max-w-[720px] shadow-sm" v-html="generatedBody" /></div></section>
      </main>

      <aside class="dh-glass dh-liquid rounded-[28px] p-4 xl:sticky xl:top-4 xl:self-start">
        <h2 class="text-sm font-black">{{ t('notificationDesigner.propertiesTitle') }}</h2>
        <div v-if="selectedBlock" class="mt-4 space-y-4">
          <DhTextarea v-if="['heading', 'text', 'alert'].includes(selectedBlock.type)" :model-value="selectedBlock.text ?? ''" @update:model-value="selectedBlock.text = $event" :label="t('notificationDesigner.properties.text')" :rows="selectedBlock.type === 'text' ? 7 : 4" :disabled="!canManage" />
          <DhInput v-if="selectedBlock.type === 'button'" :model-value="selectedBlock.text ?? ''" @update:model-value="selectedBlock.text = $event" :label="t('notificationDesigner.properties.buttonText')" :disabled="!canManage" />
          <DhInput v-if="selectedBlock.type === 'button'" :model-value="selectedBlock.url ?? ''" @update:model-value="selectedBlock.url = $event" :label="t('notificationDesigner.properties.buttonUrl')" :disabled="!canManage" />
          <DhSelect v-if="['heading', 'text', 'button', 'alert'].includes(selectedBlock.type)" :model-value="selectedBlock.align ?? 'left'" @update:model-value="selectedBlock.align = String($event) as DesignerBlock['align']" :label="t('notificationDesigner.properties.alignment')" :options="[{ value: 'left', label: t('notificationDesigner.align.left') }, { value: 'center', label: t('notificationDesigner.align.center') }, { value: 'right', label: t('notificationDesigner.align.right') }]" placeholder="" :disabled="!canManage" />
          <DhInput v-if="selectedBlock.type === 'spacer'" :model-value="selectedBlock.size ?? 24" @update:model-value="selectedBlock.size = Number($event)" type="number" :label="t('notificationDesigner.properties.spacing')" :disabled="!canManage" />
          <DhButton v-if="canManage" class="w-full" :icon="Trash2" :label="t('notificationDesigner.removeBlock')" variant="danger" @click="removeBlock(selectedBlock.id)" />
        </div>
        <div v-else class="mt-4 rounded-[20px] bg-[var(--dh-input)] p-4 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('notificationDesigner.noSelection') }}</div>
      </aside>
    </div>
  </section>
</template>
