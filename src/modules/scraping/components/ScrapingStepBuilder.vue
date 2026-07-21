<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { GripVertical, Plus, Trash2 } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { createUuid } from '@/core/utils/id'

type SelectOption = { label: string; value: string | number; disabled?: boolean }

export interface ScrapingStepDraft extends Record<string, string | undefined> {
  id: string
  action: string
  selector: string
  valueSource: string
  value: string
  key: string
  url: string
  urlContains: string
  timeoutMilliseconds: string
}

const props = defineProps<{
  modelValue: ScrapingStepDraft[]
  title: string
  hint?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [ScrapingStepDraft[]]
}>()

const { t } = useI18n()

const actionOptions = computed<SelectOption[]>(() => [
  { value: 'goto', label: 'goto / navigate' },
  { value: 'waitForSelector', label: 'waitForSelector' },
  { value: 'waitForUrl', label: 'waitForUrl' },
  { value: 'click', label: 'click' },
  { value: 'fill', label: 'fill / type' },
  { value: 'press', label: 'press' },
  { value: 'select', label: 'select option' },
  { value: 'check', label: 'check' },
  { value: 'uncheck', label: 'uncheck' },
  { value: 'wait', label: 'wait / delay' },
])

const valueSourceOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('scraping.noValue') },
  { value: 'literal', label: t('scraping.literalValue') },
  { value: 'credential.username', label: t('scraping.credentialUsernameValue') },
  { value: 'credential.secret', label: t('scraping.credentialSecretValue') },
  { value: 'job.portOfLoadingName', label: 'Job: POL name' },
  { value: 'job.portOfLoadingCode', label: 'Job: POL code' },
  { value: 'job.portOfEntryName', label: 'Job: POE name' },
  { value: 'job.portOfEntryCode', label: 'Job: POE code' },
  { value: 'job.portOfDischargeName', label: 'Job: POD name' },
  { value: 'job.portOfDischargeCode', label: 'Job: POD code' },
  { value: 'job.containerTypeName', label: 'Job: container name' },
  { value: 'job.containerTypeCode', label: 'Job: container code' },
  { value: 'job.commodity', label: 'Job: commodity' },
  { value: 'job.weightKg', label: 'Job: weight kg' },
  { value: 'job.readyDate', label: 'Job: ready date' },
  { value: 'input.custom', label: t('scraping.inputValue') },
])

function newStep(): ScrapingStepDraft {
  return {
    id: createUuid(),
    action: 'waitForSelector',
    selector: '',
    valueSource: '',
    value: '',
    key: '',
    url: '',
    urlContains: '',
    timeoutMilliseconds: '30000',
  }
}

function updateStep(index: number, patch: Partial<ScrapingStepDraft>) {
  const next = props.modelValue.map((step, currentIndex) =>
    currentIndex === index ? { ...step, ...patch } : step,
  )
  emit('update:modelValue', next)
}

function addStep() {
  emit('update:modelValue', [...props.modelValue, newStep()])
}

function removeStep(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, currentIndex) => currentIndex !== index),
  )
}

function moveStep(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= props.modelValue.length) return
  const next = [...props.modelValue]
  const [item] = next.splice(index, 1)
  if (!item) return
  next.splice(target, 0, item)
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-black text-[var(--dh-text)]">{{ title }}</h3>
        <p v-if="hint" class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ hint }}</p>
      </div>
      <DhButton
        :icon="Plus"
        :label="t('scraping.addStep')"
        size="sm"
        variant="secondary"
        @click="addStep"
      />
    </div>

    <div
      v-if="!modelValue.length"
      class="rounded-[22px] border border-dashed border-[var(--dh-border)] p-4 text-sm font-semibold text-[var(--dh-text-muted)]"
    >
      {{ t('scraping.noSteps') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="(step, index) in modelValue"
        :key="step.id"
        class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.02] p-4 dark:bg-white/[0.03]"
      >
        <div class="mb-3 flex items-center justify-between gap-3">
          <div
            class="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]"
          >
            <GripVertical class="h-4 w-4" />
            {{ t('scraping.step') }} {{ index + 1 }}
          </div>
          <div class="flex gap-1">
            <DhButton
              label="↑"
              size="sm"
              variant="ghost"
              :disabled="index === 0"
              @click="moveStep(index, -1)"
            />
            <DhButton
              label="↓"
              size="sm"
              variant="ghost"
              :disabled="index === modelValue.length - 1"
              @click="moveStep(index, 1)"
            />
            <DhButton :icon="Trash2" size="sm" variant="danger" @click="removeStep(index)" />
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <DhSelect
            :model-value="step.action"
            :label="t('scraping.stepAction')"
            :options="actionOptions"
            @update:model-value="updateStep(index, { action: String($event ?? '') })"
          />
          <DhInput
            :model-value="step.timeoutMilliseconds"
            :label="t('scraping.timeoutMs')"
            type="number"
            @update:model-value="updateStep(index, { timeoutMilliseconds: String($event ?? '') })"
          />
          <DhInput
            :model-value="step.url"
            class="md:col-span-2"
            :label="t('scraping.stepUrl')"
            placeholder="https://www.maersk.com/book/"
            @update:model-value="updateStep(index, { url: String($event ?? '') })"
          />
          <DhInput
            :model-value="step.selector"
            class="md:col-span-2"
            :label="t('scraping.selector')"
            placeholder="xpath=//*[@id='mc-input-origin']"
            @update:model-value="updateStep(index, { selector: String($event ?? '') })"
          />
          <DhSelect
            :model-value="step.valueSource"
            :label="t('scraping.valueSource')"
            :options="valueSourceOptions"
            @update:model-value="updateStep(index, { valueSource: String($event ?? '') })"
          />
          <DhInput
            :model-value="step.value"
            :label="
              step.valueSource === 'input.custom'
                ? t('scraping.inputName')
                : t('scraping.stepValue')
            "
            placeholder="literal value / custom input name"
            @update:model-value="updateStep(index, { value: String($event ?? '') })"
          />
          <DhInput
            :model-value="step.key"
            :label="t('scraping.keyToPress')"
            placeholder="Enter / ArrowDown"
            @update:model-value="updateStep(index, { key: String($event ?? '') })"
          />
          <DhInput
            :model-value="step.urlContains"
            :label="t('scraping.urlContains')"
            placeholder="maersk.com/book"
            @update:model-value="updateStep(index, { urlContains: String($event ?? '') })"
          />
        </div>
      </div>
    </div>
  </div>
</template>
