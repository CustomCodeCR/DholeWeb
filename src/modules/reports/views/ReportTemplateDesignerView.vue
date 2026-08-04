<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Code2,
  Eye,
  GripVertical,
  Heading,
  Image,
  Minus,
  Plus,
  Save,
  Space,
  Table2,
  TextCursorInput,
  Trash2,
  Variable,
} from 'lucide-vue-next'
import { createUuid } from '@/core/utils/id'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { REPORTS_SCOPES } from '@/core/auth/scopes'
import { ReportsService } from '@/core/services/reportsService'
import type {
  ReportBlockType,
  ReportDesignerBlock,
  ReportDesignerDocument,
  ReportOrientation,
  ReportPageSize,
  ReportTableColumn,
} from '@/core/interfaces/reports'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const toastStore = useToastStore()

const templateId = computed(() => String(route.params.id ?? '').trim())
const isNew = computed(
  () => route.name === 'reports-template-create' || templateId.value.length === 0,
)
const canCreate = computed(() => authStore.hasScope(REPORTS_SCOPES.templates.create))
const canUpdate = computed(() => authStore.hasScope(REPORTS_SCOPES.templates.update))
const canSave = computed(() => (isNew.value ? canCreate.value : canUpdate.value))
const canEdit = canSave

const loading = ref(false)
const saving = ref(false)
const name = ref(t('reports.designer.newTemplateName'))
const description = ref('')
const pageSize = ref<ReportPageSize>('A4')
const orientation = ref<ReportOrientation>('Portrait')
const blocks = ref<ReportDesignerBlock[]>([])
const selectedId = ref('')
const previewMode = ref<'canvas' | 'html' | 'preview'>('canvas')
const draggedExistingIndex = ref<number | null>(null)
const customerVariableExample = '{{customer.name}}'

const previewTabs = computed<Array<{
  key: 'canvas' | 'preview' | 'html'
  label: string
  icon: Component
}>>(() => [
  { key: 'canvas', label: t('reports.designer.designerTab'), icon: GripVertical },
  { key: 'preview', label: t('reports.designer.previewTab'), icon: Eye },
  { key: 'html', label: t('reports.designer.htmlTab'), icon: Code2 },
])

const alignmentOptions: Array<{
  value: 'left' | 'center' | 'right'
  icon: Component
}> = [
  { value: 'left', icon: AlignLeft },
  { value: 'center', icon: AlignCenter },
  { value: 'right', icon: AlignRight },
]

const palette = computed<Array<{
  type: ReportBlockType
  label: string
  icon: Component
  description: string
}>>(() => [
  {
    type: 'heading',
    label: t('reports.designer.palette.heading.label'),
    icon: Heading,
    description: t('reports.designer.palette.heading.description'),
  },
  {
    type: 'text',
    label: t('reports.designer.palette.text.label'),
    icon: TextCursorInput,
    description: t('reports.designer.palette.text.description'),
  },
  {
    type: 'variable',
    label: t('reports.designer.palette.variable.label'),
    icon: Variable,
    description: t('reports.designer.palette.variable.description'),
  },
  {
    type: 'table',
    label: t('reports.designer.palette.table.label'),
    icon: Table2,
    description: t('reports.designer.palette.table.description'),
  },
  {
    type: 'image',
    label: t('reports.designer.palette.image.label'),
    icon: Image,
    description: t('reports.designer.palette.image.description'),
  },
  {
    type: 'divider',
    label: t('reports.designer.palette.divider.label'),
    icon: Minus,
    description: t('reports.designer.palette.divider.description'),
  },
  {
    type: 'spacer',
    label: t('reports.designer.palette.spacer.label'),
    icon: Space,
    description: t('reports.designer.palette.spacer.description'),
  },
])

const selectedBlock = computed(
  () => blocks.value.find((block) => block.id === selectedId.value) ?? null,
)
const pageClass = computed(() =>
  orientation.value === 'Landscape'
    ? 'w-[1120px] min-h-[760px]'
    : 'w-[794px] min-h-[1123px]',
)
const htmlContent = computed(() => buildHtml())
const designerJson = computed(() =>
  JSON.stringify({ version: 1, blocks: blocks.value } satisfies ReportDesignerDocument),
)

function defaultBlock(type: ReportBlockType): ReportDesignerBlock {
  const base: ReportDesignerBlock = {
    id: createUuid(),
    type,
    content: '',
    variable: '',
    collection: 'items',
    columns: [
      { field: 'description', label: t('reports.designer.defaults.description') },
      { field: 'quantity', label: t('reports.designer.defaults.quantity') },
      { field: 'amount', label: t('reports.designer.defaults.amount') },
    ],
    align: 'left',
    fontSize: 14,
    fontWeight: 'normal',
    color: '#0f172a',
    backgroundColor: 'transparent',
    padding: 8,
    height: 24,
    imageUrl: '{{logoUrl}}',
  }

  if (type === 'heading') {
    return {
      ...base,
      content: t('reports.designer.defaults.reportTitle'),
      fontSize: 28,
      fontWeight: 'bold',
      padding: 12,
    }
  }
  if (type === 'text') return { ...base, content: t('reports.designer.defaults.text') }
  if (type === 'variable') {
    return {
      ...base,
      content: t('reports.designer.defaults.field'),
      variable: 'company.name',
      fontSize: 16,
      fontWeight: 'bold',
    }
  }
  if (type === 'divider') return { ...base, height: 1, padding: 10, color: '#cbd5e1' }
  if (type === 'spacer') return { ...base, height: 32, padding: 0 }
  if (type === 'image') return { ...base, imageUrl: '{{logoUrl}}', height: 80, align: 'left' }
  return base
}

function seedTemplate() {
  blocks.value = [
    { ...defaultBlock('heading'), content: '{{title}}', align: 'center' },
    {
      ...defaultBlock('text'),
      content: t('reports.designer.defaults.companyDate', {
        company: '{{company.name}}',
        date: '{{date}}',
      }),
      align: 'center',
      color: '#475569',
    },
    defaultBlock('divider'),
    defaultBlock('table'),
    {
      ...defaultBlock('text'),
      content: t('reports.designer.defaults.footer'),
      align: 'center',
      fontSize: 11,
      color: '#64748b',
    },
  ]
  selectedId.value = blocks.value[0]?.id ?? ''
}

function startPaletteDrag(event: DragEvent, type: ReportBlockType) {
  if (!canEdit.value) return
  event.dataTransfer?.setData('application/x-dhole-report-block', type)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function startExistingDrag(event: DragEvent, index: number) {
  if (!canEdit.value) return
  draggedExistingIndex.value = index
  event.dataTransfer?.setData('application/x-dhole-report-existing', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function dropOnCanvas(event: DragEvent, targetIndex?: number) {
  event.preventDefault()
  if (!canEdit.value) return

  const paletteType = event.dataTransfer?.getData(
    'application/x-dhole-report-block',
  ) as ReportBlockType
  const existingRaw = event.dataTransfer?.getData('application/x-dhole-report-existing')

  if (paletteType) {
    const block = defaultBlock(paletteType)
    const index = targetIndex ?? blocks.value.length
    blocks.value.splice(index, 0, block)
    selectedId.value = block.id
    return
  }

  const from = existingRaw ? Number(existingRaw) : draggedExistingIndex.value
  if (from === null || Number.isNaN(from)) return

  const to = targetIndex ?? blocks.value.length - 1
  if (from === to) return

  const [block] = blocks.value.splice(from, 1)
  if (!block) return

  blocks.value.splice(from < to ? to - 1 : to, 0, block)
  draggedExistingIndex.value = null
}

function addBlock(type: ReportBlockType) {
  if (!canEdit.value) return
  const block = defaultBlock(type)
  blocks.value.push(block)
  selectedId.value = block.id
}

function deleteBlock(id: string) {
  if (!canEdit.value) return
  const index = blocks.value.findIndex((block) => block.id === id)
  if (index < 0) return

  blocks.value.splice(index, 1)
  selectedId.value = blocks.value[Math.min(index, blocks.value.length - 1)]?.id ?? ''
}

function moveBlock(id: string, direction: -1 | 1) {
  if (!canEdit.value) return
  const index = blocks.value.findIndex((block) => block.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= blocks.value.length) return

  const [block] = blocks.value.splice(index, 1)
  if (block) blocks.value.splice(target, 0, block)
}

function updateColumns(value: string) {
  if (!canEdit.value || !selectedBlock.value) return

  selectedBlock.value.columns = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): ReportTableColumn => {
      const [field, ...labelParts] = line.split(':')
      const cleanField = field?.trim() || 'field'
      return { field: cleanField, label: labelParts.join(':').trim() || cleanField }
    })
}

function columnsText(block: ReportDesignerBlock) {
  return block.columns.map((column) => `${column.field}:${column.label}`).join('\n')
}

function templateToken(value: string) {
  return `{{${value}}}`
}

function blockTypeLabel(type: ReportBlockType) {
  return t(`reports.designer.blockTypes.${type}`)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function styleFor(block: ReportDesignerBlock) {
  return [
    `text-align:${block.align}`,
    `font-size:${block.fontSize}px`,
    `font-weight:${block.fontWeight === 'bold' ? '700' : '400'}`,
    `color:${block.color}`,
    `background:${block.backgroundColor}`,
    `padding:${block.padding}px`,
  ].join(';')
}

function blockHtml(block: ReportDesignerBlock) {
  const style = styleFor(block)
  if (block.type === 'heading') return `<h1 style="margin:0;${style}">${block.content}</h1>`
  if (block.type === 'text') {
    return `<div style="white-space:pre-wrap;line-height:1.55;${style}">${block.content}</div>`
  }
  if (block.type === 'variable') {
    return `<div style="${style}"><span style="font-size:.78em;color:#64748b">${escapeHtml(block.content)}:</span> {{${block.variable}}}</div>`
  }
  if (block.type === 'divider') {
    return `<div style="padding:${block.padding}px 0"><hr style="border:0;border-top:${Math.max(1, block.height)}px solid ${block.color};margin:0"></div>`
  }
  if (block.type === 'spacer') {
    return `<div style="height:${Math.max(4, block.height)}px"></div>`
  }
  if (block.type === 'image') {
    return `<div style="text-align:${block.align};padding:${block.padding}px"><img src="${block.imageUrl}" alt="" style="max-width:100%;height:${Math.max(24, block.height)}px;object-fit:contain"></div>`
  }

  const headers = block.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')
  const cells = block.columns.map((column) => `<td>{{${column.field}}}</td>`).join('')
  return `<div style="padding:${block.padding}px"><table class="dh-report-table"><thead><tr>${headers}</tr></thead><tbody>{{#each ${block.collection}}}<tr>${cells}</tr>{{/each}}</tbody></table></div>`
}

function buildHtml() {
  const page = pageSize.value
  const landscape = orientation.value === 'Landscape' ? ' landscape' : ''
  return `<!doctype html>
<html lang="${locale.value}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@page { size: ${page}${landscape}; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #0f172a; font-family: Inter, Arial, sans-serif; background: white; }
.report-page { width: 100%; min-height: 100%; }
.dh-report-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dh-report-table th { background: #e0f2fe; color: #075985; padding: 9px; text-align: left; border: 1px solid #bae6fd; }
.dh-report-table td { padding: 9px; border: 1px solid #e2e8f0; }
.dh-report-table tbody tr:nth-child(even) { background: #f8fafc; }
</style>
</head>
<body><main class="report-page">${blocks.value.map(blockHtml).join('\n')}</main></body>
</html>`
}

async function load() {
  if (isNew.value) {
    if (!canCreate.value) {
      toastStore.warning(
        t('reports.designer.toasts.permissionTitle'),
        t('reports.designer.toasts.createPermission'),
      )
      await router.replace('/reports/templates')
      return
    }

    name.value = t('reports.designer.newTemplateName')
    seedTemplate()
    return
  }

  loading.value = true
  try {
    const template = await ReportsService.get(templateId.value)
    name.value = template.name
    description.value = template.description ?? ''
    pageSize.value = (
      ['A4', 'LETTER', 'LEGAL'].includes(template.pageSize) ? template.pageSize : 'A4'
    ) as ReportPageSize
    orientation.value = template.orientation === 'Landscape' ? 'Landscape' : 'Portrait'

    const rawDesignerJson = template.designerJson?.replace(/^\uFEFF/, '').trim()
    if (!rawDesignerJson) {
      throw new Error(t('reports.designer.toasts.invalidDesignerJson'))
    }

    const parsedDesigner = JSON.parse(rawDesignerJson) as unknown
    const document =
      typeof parsedDesigner === 'string'
        ? (JSON.parse(parsedDesigner) as ReportDesignerDocument)
        : (parsedDesigner as ReportDesignerDocument)

    if (!document || !Array.isArray(document.blocks)) {
      throw new Error(t('reports.designer.toasts.invalidDesignerJson'))
    }

    blocks.value = document.blocks
    if (blocks.value.length === 0) seedTemplate()
    selectedId.value = blocks.value[0]?.id ?? ''
  } catch (error) {
    toastStore.backendError(error, t('reports.designer.toasts.loadError'))
    await router.replace('/reports/templates')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!canSave.value) {
    toastStore.warning(
      t('reports.designer.toasts.permissionTitle'),
      t('reports.designer.toasts.savePermission', {
        scope: isNew.value ? REPORTS_SCOPES.templates.create : REPORTS_SCOPES.templates.update,
      }),
    )
    return
  }

  if (!name.value.trim()) {
    toastStore.warning(
      t('reports.designer.toasts.nameRequiredTitle'),
      t('reports.designer.toasts.nameRequiredMessage'),
    )
    return
  }

  if (blocks.value.length === 0) {
    toastStore.warning(
      t('reports.designer.toasts.emptyTitle'),
      t('reports.designer.toasts.emptyMessage'),
    )
    return
  }

  saving.value = true
  try {
    const payload = {
      name: name.value.trim(),
      description: description.value.trim() || null,
      htmlContent: htmlContent.value,
      designerJson: designerJson.value,
      pageSize: pageSize.value,
      orientation: orientation.value,
    }

    if (isNew.value) {
      const id = await ReportsService.create(payload)
      toastStore.success(
        t('reports.designer.toasts.createdTitle'),
        t('reports.designer.toasts.createdMessage'),
      )
      await router.replace(`/reports/templates/${id}`)
    } else {
      await ReportsService.update(templateId.value, payload)
      toastStore.success(
        t('reports.designer.toasts.updatedTitle'),
        t('reports.designer.toasts.updatedMessage'),
      )
    }
  } catch (error) {
    toastStore.backendError(error, t('reports.designer.toasts.saveError'))
  } finally {
    saving.value = false
  }
}

async function openStoredPreview() {
  if (isNew.value) {
    previewMode.value = 'preview'
    return
  }

  try {
    await ReportsService.openPreview(templateId.value)
  } catch (error) {
    toastStore.backendError(error, t('reports.designer.toasts.previewError'))
  }
}

watch(
  () => [route.name, route.params.id],
  () => {
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <section class="space-y-3 sm:space-y-4">
    <header
      class="dh-glass dh-liquid rounded-[32px] p-3 sm:p-5"
    >
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <button
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] transition hover:bg-[var(--dh-card-hover)]"
            :aria-label="t('common.back')"
            @click="router.push('/reports/templates')"
          >
            <ArrowLeft class="h-4 w-4" />
          </button>

          <div class="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)]">
            <input
              v-model="name"
              :disabled="!canEdit"
              class="h-11 min-w-0 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 font-black text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] outline-none dh-focus-primary disabled:opacity-70"
              :placeholder="t('reports.designer.namePlaceholder')"
            />
            <input
              v-model="description"
              :disabled="!canEdit"
              class="h-11 min-w-0 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 text-sm font-semibold text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] outline-none dh-focus-primary disabled:opacity-70"
              :placeholder="t('reports.designer.descriptionPlaceholder')"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
          <select
            v-model="pageSize"
            :disabled="!canEdit"
            class="h-11 min-w-0 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] outline-none dh-focus-primary"
          >
            <option value="A4">A4</option>
            <option value="LETTER">{{ t('reports.designer.letter') }}</option>
            <option value="LEGAL">{{ t('reports.designer.legal') }}</option>
          </select>
          <select
            v-model="orientation"
            :disabled="!canEdit"
            class="h-11 min-w-0 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] outline-none dh-focus-primary"
          >
            <option value="Portrait">{{ t('reports.portrait') }}</option>
            <option value="Landscape">{{ t('reports.landscape') }}</option>
          </select>
          <button
            class="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 text-sm font-black text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] transition hover:bg-[var(--dh-card-hover)]"
            @click="openStoredPreview"
          >
            <Eye class="h-4 w-4" /> PDF
          </button>
          <button
            v-if="canSave"
            class="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] bg-[var(--dh-primary)] px-4 text-sm font-black text-white shadow-[var(--dh-glow)] transition hover:brightness-110 disabled:opacity-60"
            :disabled="saving || loading"
            @click="save"
          >
            <Save class="h-4 w-4" />
            {{ saving ? t('reports.designer.saving') : t('reports.designer.save') }}
          </button>
        </div>
      </div>
    </header>

    <div
      v-if="loading"
      class="dh-glass dh-liquid rounded-[32px] p-10 text-center text-sm font-bold text-[var(--dh-text-muted)] sm:p-16"
    >
      {{ t('reports.designer.loading') }}
    </div>

    <div
      v-else
      class="grid min-h-[calc(100vh-220px)] gap-3 sm:gap-4"
      :class="
        canEdit
          ? 'xl:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[230px_minmax(0,1fr)_300px]'
          : 'grid-cols-1'
      "
    >
      <aside
        v-if="canEdit"
        class="dh-glass dh-liquid rounded-[32px] p-3 sm:p-4 xl:sticky xl:top-4 xl:self-start"
      >
        <h2 class="text-xs font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">
          {{ t('reports.designer.components') }}
        </h2>
        <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ t('reports.designer.dragHint') }}</p>

        <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-1">
          <button
            v-for="item in palette"
            :key="item.type"
            draggable="true"
            class="flex min-w-0 cursor-grab flex-col items-center gap-2 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-center shadow-[var(--dh-shadow-sm)] transition hover:border-[var(--dh-primary)] hover:bg-[var(--dh-card-hover)] active:cursor-grabbing sm:flex-row sm:text-left xl:flex-row"
            @dragstart="startPaletteDrag($event, item.type)"
            @click="addBlock(item.type)"
          >
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] dh-bg-primary-soft text-[var(--dh-primary)]"
            >
              <component :is="item.icon" class="h-4 w-4" />
            </span>
            <span class="min-w-0">
              <strong class="block truncate text-sm">{{ item.label }}</strong>
              <small class="hidden text-xs text-[var(--dh-text-muted)] sm:block">{{ item.description }}</small>
            </span>
          </button>
        </div>

        <div
          class="mt-5 rounded-[20px] border dh-border-primary-soft dh-bg-primary-soft p-3 text-xs font-semibold leading-5 text-[var(--dh-primary)]"
        >
          {{
            t('reports.designer.variablesHint', {
              variable: customerVariableExample,
            })
          }}
        </div>
      </aside>

      <main
        class="dh-glass dh-liquid min-w-0 overflow-hidden rounded-[32px] p-2 sm:p-3"
        :class="{ 'xl:col-span-2 2xl:col-span-3': !canEdit }"
      >
        <div
          class="mb-3 flex min-w-0 flex-col gap-2 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 shadow-[var(--dh-shadow-sm)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex min-w-0 gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              v-for="mode in previewTabs"
              :key="mode.key"
              class="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
              :class="
                previewMode === mode.key
                  ? 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]'
                  : 'text-[var(--dh-text-muted)] hover:bg-[var(--dh-card-hover)]'
              "
              @click="previewMode = mode.key"
            >
              <component :is="mode.icon" class="h-3.5 w-3.5" />{{ mode.label }}
            </button>
          </div>
          <span class="shrink-0 text-xs text-[var(--dh-text-muted)]">
            {{ t('reports.designer.blockCount', { count: blocks.length }) }}
            <span v-if="!canEdit"> · {{ t('reports.designer.readOnly') }}</span>
          </span>
        </div>

        <div v-if="previewMode === 'canvas'" class="overflow-x-auto py-3 sm:py-4">
          <div
            :class="pageClass"
            class="mx-auto bg-white p-5 shadow-xl sm:p-8 md:p-10"
            @dragover.prevent
            @drop="dropOnCanvas($event)"
          >
            <div
              v-if="blocks.length === 0"
              class="flex min-h-[420px] items-center justify-center rounded-xl border-2 border-dashed border-sky-200 p-6 text-center text-sm text-[var(--dh-text-muted)]"
            >
              {{ t('reports.designer.emptyCanvas') }}
            </div>

            <div
              v-for="(block, index) in blocks"
              :key="block.id"
              class="relative"
              @dragover.prevent
              @drop.stop="dropOnCanvas($event, index)"
            >
              <div
                :draggable="canEdit"
                class="group relative cursor-pointer rounded-lg border-2 transition"
                :class="
                  selectedId === block.id
                    ? 'border-sky-500 ring-2 ring-sky-100'
                    : 'border-transparent hover:border-sky-200'
                "
                @click="selectedId = block.id"
                @dragstart="startExistingDrag($event, index)"
              >
                <div
                  v-if="canEdit"
                  class="absolute -left-7 top-2 hidden rounded bg-slate-800 p-1 text-white group-hover:block"
                >
                  <GripVertical class="h-4 w-4" />
                </div>

                <h1
                  v-if="block.type === 'heading'"
                  :style="{
                    textAlign: block.align,
                    fontSize: `${block.fontSize}px`,
                    fontWeight: block.fontWeight,
                    color: block.color,
                    backgroundColor: block.backgroundColor,
                    padding: `${block.padding}px`,
                  }"
                  class="m-0"
                >
                  {{ block.content }}
                </h1>
                <div
                  v-else-if="block.type === 'text'"
                  :style="{
                    textAlign: block.align,
                    fontSize: `${block.fontSize}px`,
                    fontWeight: block.fontWeight,
                    color: block.color,
                    backgroundColor: block.backgroundColor,
                    padding: `${block.padding}px`,
                  }"
                  class="whitespace-pre-wrap leading-relaxed"
                >
                  {{ block.content }}
                </div>
                <div
                  v-else-if="block.type === 'variable'"
                  :style="{
                    textAlign: block.align,
                    fontSize: `${block.fontSize}px`,
                    fontWeight: block.fontWeight,
                    color: block.color,
                    backgroundColor: block.backgroundColor,
                    padding: `${block.padding}px`,
                  }"
                >
                  <span class="text-xs text-[var(--dh-text-muted)]">{{ block.content }}:</span>
                  <span class="rounded bg-amber-50 px-1 text-amber-700">
                    {{ templateToken(block.variable) }}
                  </span>
                </div>
                <div
                  v-else-if="block.type === 'divider'"
                  :style="{ padding: `${block.padding}px 0` }"
                >
                  <hr
                    :style="{ borderTop: `${Math.max(1, block.height)}px solid ${block.color}` }"
                    class="border-0"
                  />
                </div>
                <div
                  v-else-if="block.type === 'spacer'"
                  :style="{ height: `${block.height}px` }"
                  class="flex items-center justify-center bg-slate-50 text-[10px] text-slate-300"
                >
                  {{ t('reports.designer.spacer') }}
                </div>
                <div
                  v-else-if="block.type === 'image'"
                  :style="{ textAlign: block.align, padding: `${block.padding}px` }"
                >
                  <div
                    class="inline-flex items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 px-8 text-xs text-[var(--dh-text-muted)]"
                    :style="{ height: `${block.height}px` }"
                  >
                    <Image class="mr-2 h-4 w-4" />{{ block.imageUrl }}
                  </div>
                </div>
                <div v-else class="overflow-x-auto p-2">
                  <table class="w-full min-w-[480px] border-collapse text-xs">
                    <thead>
                      <tr>
                        <th
                          v-for="column in block.columns"
                          :key="column.field"
                          class="border border-sky-200 bg-sky-50 p-2 text-left text-sky-800"
                        >
                          {{ column.label }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          v-for="column in block.columns"
                          :key="column.field"
                          class="border border-slate-200 p-2 text-amber-700"
                        >
                          {{ templateToken(column.field) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p class="mt-1 text-[10px] text-[var(--dh-text-muted)]">
                    {{ t('reports.designer.collection', { name: block.collection }) }}
                  </p>
                </div>

                <div
                  v-if="selectedId === block.id && canEdit"
                  class="absolute -right-2 -top-9 flex rounded-lg border bg-white p-1 shadow dark:border-slate-700 dark:bg-slate-900"
                >
                  <button
                    class="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                    @click.stop="moveBlock(block.id, -1)"
                  >
                    <ArrowUp class="h-3.5 w-3.5" />
                  </button>
                  <button
                    class="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                    @click.stop="moveBlock(block.id, 1)"
                  >
                    <ArrowDown class="h-3.5 w-3.5" />
                  </button>
                  <button
                    class="rounded p-1 text-rose-600 hover:bg-rose-50"
                    @click.stop="deleteBlock(block.id)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="previewMode === 'preview'" class="overflow-x-auto py-3 sm:py-4">
          <iframe
            :srcdoc="htmlContent"
            :class="pageClass"
            class="mx-auto block border-0 bg-white shadow-xl"
          />
        </div>

        <textarea
          v-else
          :value="htmlContent"
          readonly
          spellcheck="false"
          class="h-[calc(100vh-280px)] min-h-[480px] w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-emerald-300 sm:min-h-[640px] sm:p-5"
        />
      </main>

      <aside
        v-if="canEdit"
        class="dh-glass dh-liquid rounded-[32px] p-3 sm:p-4 xl:col-span-2 2xl:sticky 2xl:top-4 2xl:col-span-1 2xl:self-start"
      >
        <template v-if="selectedBlock">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold">{{ t('reports.designer.properties') }}</h2>
              <p class="text-xs capitalize text-[var(--dh-text-muted)]">
                {{ blockTypeLabel(selectedBlock.type) }}
              </p>
            </div>
            <button
              class="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
              :aria-label="t('common.delete')"
              @click="deleteBlock(selectedBlock.id)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>

          <div class="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
            <label
              v-if="['heading', 'text', 'variable'].includes(selectedBlock.type)"
              class="block space-y-1 text-xs font-semibold md:col-span-2 2xl:col-span-1"
            >
              {{ t('reports.designer.content') }}
              <textarea
                v-model="selectedBlock.content"
                rows="3"
                class="mt-1 w-full rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-semibold text-[var(--dh-text)] outline-none dh-focus-primary"
              />
            </label>

            <label
              v-if="selectedBlock.type === 'variable'"
              class="block space-y-1 text-xs font-semibold"
            >
              {{ t('reports.designer.variablePath') }}
              <input
                v-model="selectedBlock.variable"
                class="mt-1 w-full rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 font-mono text-sm font-semibold text-[var(--dh-text)] outline-none dh-focus-primary"
                placeholder="customer.name"
              />
            </label>

            <template v-if="selectedBlock.type === 'table'">
              <label class="block space-y-1 text-xs font-semibold">
                {{ t('reports.designer.jsonCollection') }}
                <input
                  v-model="selectedBlock.collection"
                  class="mt-1 w-full rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 font-mono text-sm font-semibold text-[var(--dh-text)] outline-none dh-focus-primary"
                  placeholder="items"
                />
              </label>
              <label class="block space-y-1 text-xs font-semibold md:col-span-2 2xl:col-span-1">
                {{ t('reports.designer.columns') }}
                <span class="font-normal text-[var(--dh-text-muted)]">{{ t('reports.designer.fieldLabel') }}</span>
                <textarea
                  :value="columnsText(selectedBlock)"
                  rows="7"
                  class="mt-1 w-full rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 font-mono text-xs font-semibold text-[var(--dh-text)] outline-none dh-focus-primary"
                  @input="updateColumns(($event.target as HTMLTextAreaElement).value)"
                />
              </label>
            </template>

            <label
              v-if="selectedBlock.type === 'image'"
              class="block space-y-1 text-xs font-semibold"
            >
              {{ t('reports.designer.urlVariable') }}
              <input
                v-model="selectedBlock.imageUrl"
                class="mt-1 w-full rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 font-mono text-sm font-semibold text-[var(--dh-text)] outline-none dh-focus-primary"
              />
            </label>

            <div
              v-if="!['table', 'spacer', 'divider'].includes(selectedBlock.type)"
              class="space-y-1 text-xs font-semibold"
            >
              {{ t('reports.designer.alignment') }}
              <div class="mt-1 grid grid-cols-3 gap-2">
                <button
                  v-for="align in alignmentOptions"
                  :key="align.value"
                  class="flex justify-center rounded-lg border p-2 dark:border-slate-700"
                  :class="
                    selectedBlock.align === align.value
                      ? 'border-sky-500 bg-sky-50 text-sky-600'
                      : 'border-slate-200'
                  "
                  @click="selectedBlock.align = align.value"
                >
                  <component :is="align.icon" class="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              v-if="['heading', 'text', 'variable'].includes(selectedBlock.type)"
              class="grid grid-cols-2 gap-3"
            >
              <label class="space-y-1 text-xs font-semibold">
                {{ t('reports.designer.size') }}
                <input
                  v-model.number="selectedBlock.fontSize"
                  type="number"
                  min="8"
                  max="72"
                  class="w-full rounded-[16px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 text-sm font-semibold text-[var(--dh-text)] outline-none dh-focus-primary"
                />
              </label>
              <label class="space-y-1 text-xs font-semibold">
                {{ t('reports.designer.weight') }}
                <select
                  v-model="selectedBlock.fontWeight"
                  class="w-full rounded-[16px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 text-sm font-semibold text-[var(--dh-text)] outline-none dh-focus-primary"
                >
                  <option value="normal">{{ t('reports.designer.normal') }}</option>
                  <option value="bold">{{ t('reports.designer.bold') }}</option>
                </select>
              </label>
            </div>

            <label
              v-if="selectedBlock.type !== 'table' && selectedBlock.type !== 'spacer'"
              class="flex items-center justify-between text-xs font-semibold"
            >
              {{ t('reports.designer.color') }}
              <input
                v-model="selectedBlock.color"
                type="color"
                class="h-9 w-14 rounded-[14px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-1"
              />
            </label>

            <label class="space-y-1 text-xs font-semibold">
              {{ t('reports.designer.padding') }}
              <input v-model.number="selectedBlock.padding" type="range" min="0" max="48" class="w-full" />
              <span class="font-normal text-[var(--dh-text-muted)]">{{ selectedBlock.padding }} px</span>
            </label>

            <label
              v-if="['image', 'divider', 'spacer'].includes(selectedBlock.type)"
              class="space-y-1 text-xs font-semibold"
            >
              {{ t('reports.designer.height') }}
              <input v-model.number="selectedBlock.height" type="range" min="1" max="240" class="w-full" />
              <span class="font-normal text-[var(--dh-text-muted)]">{{ selectedBlock.height }} px</span>
            </label>
          </div>
        </template>

        <div
          v-else
          class="flex min-h-48 flex-col items-center justify-center text-center text-sm text-[var(--dh-text-muted)] sm:min-h-64"
        >
          <Plus class="mb-3 h-8 w-8" />
          {{ t('reports.designer.emptyProperties') }}
        </div>
      </aside>
    </div>
  </section>
</template>
