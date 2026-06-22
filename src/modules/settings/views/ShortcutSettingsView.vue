<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Keyboard } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhPageHeader } from '@/shared/components/organisms'
import { DhButton, DhInput } from '@/shared/components/atoms'
import {
  eventToShortcut,
  useShortcutStore,
  type ShortcutAction,
} from '@/core/stores/shortcutStore'

const { t } = useI18n()
const shortcutStore = useShortcutStore()
const recordingAction = ref<ShortcutAction | null>(null)

function update(action: ShortcutAction, value: string) {
  if (recordingAction.value) return
  shortcutStore.updateShortcut(action, value)
}

async function startRecording(action: ShortcutAction) {
  recordingAction.value = action

  await nextTick()

  const row = document.querySelector(`[data-shortcut-action="${action}"]`)
  const focusable = row?.querySelector('input, button') as HTMLElement | null
  focusable?.focus()
}

function captureShortcut(event: KeyboardEvent, action: ShortcutAction) {
  if (!recordingAction.value || recordingAction.value !== action) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  const keys = eventToShortcut(event)
  if (!keys || !keys.includes('+')) return

  shortcutStore.updateShortcut(action, keys)
  recordingAction.value = null
}
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      :title="t('settings.shortcuts')"
      subtitle="Atajos personalizables guardados localmente. Dhole los intercepta antes que el navegador cuando la app tiene foco."
      :icon="Keyboard"
    />

    <section class="dh-glass dh-liquid rounded-[32px] p-6">
      <div class="space-y-4">
        <div
          v-for="shortcut in shortcutStore.shortcuts"
          :key="shortcut.action"
          class="grid gap-3 rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 md:grid-cols-[1fr_280px_120px] md:items-end"
          :data-shortcut-action="shortcut.action"
          :data-dhole-shortcut-recorder="recordingAction === shortcut.action ? 'true' : undefined"
          @keydown.capture="captureShortcut($event, shortcut.action)"
        >
          <div>
            <p class="text-sm font-black text-[var(--dh-text)]">{{ shortcut.label }}</p>
            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ shortcut.action }}</p>
          </div>

          <DhInput
            :model-value="recordingAction === shortcut.action ? 'Presione la combinación...' : shortcut.keys"
            label="Combinación"
            @focus="startRecording(shortcut.action)"
            @update:model-value="update(shortcut.action, $event)"
          />

          <DhButton
            :label="recordingAction === shortcut.action ? 'Grabando' : 'Grabar'"
            variant="secondary"
            @click="startRecording(shortcut.action)"
          />
        </div>

        <div class="flex justify-end gap-2">
          <DhButton label="Restaurar" variant="secondary" @click="shortcutStore.reset()" />
        </div>
      </div>
    </section>
  </section>
</template>
