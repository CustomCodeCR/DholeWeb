<script setup lang="ts" generic="T extends Record<string, unknown>">
import { useI18n } from 'vue-i18n'

export interface DhTableColumn<T> {
  key: keyof T | string
  label: string
  width?: string
  align?: 'left' | 'center' | 'right'
}

defineProps<{
  columns: DhTableColumn<T>[]
  rows: T[]
  loading?: boolean
  emptyText?: string
}>()

const emit = defineEmits<{ rowClick: [row: T] }>()
const { t } = useI18n()

function valueOf(row: T, key: keyof T | string): unknown {
  return row[key as keyof T]
}

function isStickyActionColumn(key: keyof T | string): boolean {
  const value = String(key).toLowerCase()
  return value === 'actions' || value === '__actions'
}

function onCardKeydown(event: KeyboardEvent, row: T) {
  if (event.target !== event.currentTarget) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('rowClick', row)
}
</script>

<template>
  <div class="min-w-0">
    <!-- Mobile: every generic table becomes a readable record card. This keeps
         the complete data set visible without forcing a 700+ px horizontal table. -->
    <div class="grid gap-3 sm:hidden">
      <div
        v-if="loading"
        class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-10 text-center text-sm font-semibold text-[var(--dh-text-muted)] shadow-[var(--dh-shadow-sm)]"
      >
        {{ t('common.loading') }}
      </div>

      <div
        v-else-if="rows.length === 0"
        class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-10 text-center text-sm font-semibold text-[var(--dh-text-muted)] shadow-[var(--dh-shadow-sm)]"
      >
        {{ emptyText ?? t('common.noData') }}
      </div>

      <article
        v-for="row in rows"
        v-else
        :key="String(row.id ?? JSON.stringify(row))"
        role="button"
        tabindex="0"
        class="min-w-0 touch-manipulation overflow-hidden rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)] transition active:scale-[0.995]"
        @click="emit('rowClick', row)"
        @keydown="onCardKeydown($event, row)"
      >
        <dl class="grid min-w-0 gap-3">
          <div
            v-for="column in columns"
            :key="String(column.key)"
            class="grid min-w-0 gap-1 border-b border-[var(--dh-border)] pb-3 last:border-b-0 last:pb-0"
            :class="isStickyActionColumn(column.key) && 'pt-1'"
          >
            <dt class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              {{ column.label }}
            </dt>
            <dd
              class="min-w-0 break-words text-sm font-semibold text-[var(--dh-text-soft)] [overflow-wrap:anywhere]"
              :class="[
                column.align === 'center' && 'text-center',
                column.align === 'right' && 'text-right',
              ]"
            >
              <slot :name="`cell-${String(column.key)}`" :row="row" :value="valueOf(row, column.key)">
                {{ valueOf(row, column.key) }}
              </slot>
            </dd>
          </div>
        </dl>
      </article>
    </div>

    <!-- Tablet/desktop: preserve the dense table experience with contained
         horizontal scrolling for genuinely wide operational datasets. -->
    <div
      class="dh-scrollbar hidden max-w-full overflow-x-auto rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)] backdrop-blur-xl sm:block"
    >
      <table class="w-full min-w-[680px] border-collapse text-left text-sm md:min-w-[760px]">
        <thead class="bg-black/[0.035] text-xs text-[var(--dh-text-muted)] dark:bg-white/[0.05]">
          <tr>
            <th
              v-for="column in columns"
              :key="String(column.key)"
              class="px-4 py-3 font-black uppercase tracking-[0.1em] md:px-5 md:py-4 md:tracking-[0.12em]"
              :style="{ width: column.width }"
              :class="[
                column.align === 'center' && 'text-center',
                column.align === 'right' && 'text-right',
                isStickyActionColumn(column.key) &&
                  'sticky right-0 z-20 border-l border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[-10px_0_18px_-18px_rgba(0,0,0,0.45)]',
              ]"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td :colspan="columns.length" class="px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]">
              {{ t('common.loading') }}
            </td>
          </tr>
          <tr v-else-if="rows.length === 0">
            <td :colspan="columns.length" class="px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]">
              {{ emptyText ?? t('common.noData') }}
            </td>
          </tr>
          <tr
            v-for="row in rows"
            v-else
            :key="String(row.id ?? JSON.stringify(row))"
            class="cursor-pointer border-t border-[var(--dh-border)] transition hover:bg-[var(--dh-card-hover)]"
            @click="emit('rowClick', row)"
          >
            <td
              v-for="column in columns"
              :key="String(column.key)"
              class="px-4 py-3 text-[var(--dh-text-soft)] md:px-5 md:py-4"
              :class="[
                column.align === 'center' && 'text-center',
                column.align === 'right' && 'text-right',
                isStickyActionColumn(column.key) &&
                  'sticky right-0 z-10 border-l border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[-10px_0_18px_-18px_rgba(0,0,0,0.45)]',
              ]"
            >
              <slot :name="`cell-${String(column.key)}`" :row="row" :value="valueOf(row, column.key)">
                {{ valueOf(row, column.key) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
