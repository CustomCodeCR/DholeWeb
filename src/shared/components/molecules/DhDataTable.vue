<script setup lang="ts" generic="T extends Record<string, unknown>">
import { useI18n } from 'vue-i18n'
export interface DhTableColumn<T> { key: keyof T | string; label: string; width?: string; align?: 'left' | 'center' | 'right' }
defineProps<{ columns: DhTableColumn<T>[]; rows: T[]; loading?: boolean; emptyText?: string }>()
const emit = defineEmits<{ rowClick: [row: T] }>()
const { t } = useI18n()
function valueOf(row: T, key: keyof T | string): unknown { return row[key as keyof T] }
</script>
<template>
  <div class="overflow-hidden rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)] backdrop-blur-xl">
    <table class="w-full border-collapse text-left text-sm">
      <thead class="bg-black/[0.035] text-xs text-[var(--dh-text-muted)] dark:bg-white/[0.05]">
        <tr>
          <th v-for="column in columns" :key="String(column.key)" class="px-5 py-4 font-black uppercase tracking-[0.12em]" :style="{ width: column.width }" :class="[column.align === 'center' && 'text-center', column.align === 'right' && 'text-right']">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading"><td :colspan="columns.length" class="px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]">{{ t('common.loading') }}</td></tr>
        <tr v-else-if="rows.length === 0"><td :colspan="columns.length" class="px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]">{{ emptyText ?? t('common.noData') }}</td></tr>
        <tr v-for="row in rows" v-else :key="String(row.id ?? JSON.stringify(row))" class="cursor-pointer border-t border-[var(--dh-border)] transition hover:bg-[var(--dh-card-hover)]" @click="emit('rowClick', row)">
          <td v-for="column in columns" :key="String(column.key)" class="px-5 py-4 text-[var(--dh-text-soft)]" :class="[column.align === 'center' && 'text-center', column.align === 'right' && 'text-right']">
            <slot :name="`cell-${String(column.key)}`" :row="row" :value="valueOf(row, column.key)">{{ valueOf(row, column.key) }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
