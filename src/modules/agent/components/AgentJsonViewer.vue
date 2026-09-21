<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Copy } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'

const { t } = useI18n()

const props = defineProps<{ value: string | unknown | null | undefined }>()
const copied = ref(false)

const formatted = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') return '—'

  if (typeof props.value !== 'string') {
    try {
      return JSON.stringify(props.value, null, 2)
    } catch {
      return String(props.value)
    }
  }

  try {
    return JSON.stringify(JSON.parse(props.value), null, 2)
  } catch {
    return props.value
  }
})

async function copy() {
  try {
    await navigator.clipboard.writeText(formatted.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <section class="min-w-0 overflow-hidden rounded-[22px] border border-[var(--dh-border)] bg-black/[0.035] dark:bg-white/[0.04]">
    <div class="flex items-center justify-end border-b border-[var(--dh-border)] px-3 py-2">
      <DhButton
        :label="copied ? t('agent.actions.copied') : t('agent.actions.copy')"
        :icon="copied ? Check : Copy"
        variant="ghost"
        size="sm"
        @click="copy"
      />
    </div>
    <pre class="dh-scrollbar max-h-[32rem] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-6 text-[var(--dh-text-soft)]">{{ formatted }}</pre>
  </section>
</template>
