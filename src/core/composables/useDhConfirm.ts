import { useI18n } from 'vue-i18n'
import { DhConfirmDialog } from '@/shared/components/molecules'
import { useModalStore } from '@/core/stores/modalStore'

export interface DhConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function useDhConfirm() {
  const modalStore = useModalStore()
  const { t } = useI18n()

  function confirm(options: DhConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false

      const finish = (value: boolean) => {
        if (settled) return
        settled = true
        modalStore.close()
        resolve(value)
      }

      modalStore.open({
        title: options.title,
        component: DhConfirmDialog,
        size: options.size ?? 'sm',
        props: {
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel ?? t('common.confirm'),
          cancelLabel: options.cancelLabel ?? t('common.cancel'),
          danger: options.danger ?? false,
          onConfirm: () => finish(true),
          onCancel: () => finish(false),
        },
      })
    })
  }

  return { confirm }
}
