import { useI18n } from 'vue-i18n'
import { DhPromptDialog } from '@/shared/components/molecules'
import { useModalStore } from '@/core/stores/modalStore'

export interface DhPromptOptions {
  title: string
  message?: string
  label?: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  cancelLabel?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function useDhPrompt() {
  const modalStore = useModalStore()
  const { t } = useI18n()

  function prompt(options: DhPromptOptions): Promise<string | null> {
    return new Promise((resolve) => {
      let settled = false

      const finish = (value: string | null) => {
        if (settled) return
        settled = true
        modalStore.close()
        resolve(value)
      }

      modalStore.open({
        title: options.title,
        component: DhPromptDialog,
        size: options.size ?? 'sm',
        props: {
          ...options,
          confirmLabel: options.confirmLabel ?? t('common.confirm'),
          cancelLabel: options.cancelLabel ?? t('common.cancel'),
          onConfirm: (value: string) => finish(value),
          onCancel: () => finish(null),
        },
      })
    })
  }

  return { prompt }
}
