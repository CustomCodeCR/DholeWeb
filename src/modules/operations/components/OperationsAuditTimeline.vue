<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Activity, CalendarClock, ChevronDown, ClipboardCheck,
  History, ListChecks, Settings2, ShieldCheck, UserMinus,
  UserPlus, UserRound, UserRoundCog, UsersRound,
} from 'lucide-vue-next'
import { DhEmptyState } from '@/shared/components/atoms'
import type { OperationsAudit, OperationsUser } from '../services/operationsApi'
import {
  auditActionKey, auditCategoryKey, auditChanges, auditFieldLabel,
  auditPreview, auditValue,
} from '../utils/operationsAudit'

const props = withDefaults(defineProps<{
  events: OperationsAudit[]
  users?: OperationsUser[]
  emptyTitle?: string
  emptyDescription?: string
}>(), { users: () => [] })

const { t, locale } = useI18n()
const ordered = computed(() =>
  [...props.events].sort((a, b) =>
    new Date(b.occurredAtUtc).getTime() - new Date(a.occurredAtUtc).getTime()))
const peopleById = computed(() => new Map(props.users.map(person => [
  person.id.toLowerCase(), person.displayName?.trim() || person.userName,
])))
const translate = (key: string, params?: Record<string, string | number>) => t(key, params ?? {})
function lookupName(id: string): string | undefined {
  return peopleById.value.get(id.toLowerCase())
}
function actorName(id: string): string {
  return lookupName(id) || t('operations.auditTimeline.unknownActor')
}
function when(date: string): string {
  const timestamp = new Date(date)
  return Number.isNaN(timestamp.getTime()) ? t('operations.auditTimeline.unknownDate') :
    timestamp.toLocaleString(locale.value === 'es' ? 'es-CR' : 'en-US', {
      timeZone: 'America/Costa_Rica',
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
}
function iconFor(code: string) {
  switch (auditActionKey(code)) {
    case 'teamCreated': return UsersRound
    case 'ruleCreated': return Settings2
    case 'memberAdded': return UserPlus
    case 'memberUpdated': return UserRoundCog
    case 'memberRemoved': return UserMinus
    case 'teamActive': return ShieldCheck
    case 'reviewersAssigned': return ListChecks
    case 'reviewerDecision': return ClipboardCheck
    default: return Activity
  }
}
function preview(event: OperationsAudit): string {
  if (event.actionCode === 'operations.case.accepted-quote.created') return 'Se creó el expediente a partir de la cotización aceptada.'
  return auditPreview(event, translate, lookupName)
}
function category(event: OperationsAudit): string {
  return t('operations.auditTimeline.categories.' + auditCategoryKey(event.actionCode))
}
function title(event: OperationsAudit): string {
  if (event.actionCode === 'operations.case.accepted-quote.created') return 'Apertura creada desde Pricing'
  return t('operations.auditTimeline.actions.' + auditActionKey(event.actionCode))
}
function rowValue(value: unknown, field: string): string {
  return auditValue(value, field, translate)
}
</script>

<template>
  <div class="min-w-0">
    <DhEmptyState v-if="!ordered.length"
      :icon="History"
      :title="emptyTitle || t('operations.auditTimeline.empty')"
      :description="emptyDescription || t('operations.auditTimeline.emptyDescription')" />
    <template v-else>
      <div class="mb-5 flex flex-wrap items-center gap-3 border-b border-[var(--dh-border)] pb-3">
        <span class="inline-flex items-center gap-2 rounded-full bg-[var(--dh-shell)] px-3 py-1.5 text-xs font-bold text-[var(--dh-text)]">
          <History class="h-4 w-4 text-[var(--dh-primary)]" />
          {{ t('operations.auditTimeline.count', { count: ordered.length }) }}
        </span>
        <span class="inline-flex items-center gap-1.5 text-xs text-[var(--dh-text-muted)]">
          <CalendarClock class="h-3.5 w-3.5" />
          {{ t('operations.auditTimeline.lastActivity') }}: {{ when(ordered[0]?.occurredAtUtc ?? '') }}
        </span>
      </div>

      <ol class="relative ml-4 border-l border-[var(--dh-border)] pl-6">
        <li v-for="(event, index) in ordered" :key="event.eventId" class="relative pb-3 last:pb-0">
          <span class="absolute -left-[41px] top-3.5 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-primary)] shadow-sm">
            <component :is="iconFor(event.actionCode)" class="h-4 w-4" aria-hidden="true" />
          </span>

          <details class="group min-w-0 overflow-hidden rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] transition-shadow open:shadow-sm"
            :open="index === 0">
            <summary class="flex cursor-pointer list-none items-start gap-3 px-3 py-3.5 hover:bg-[var(--dh-shell)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dh-primary)] [&::-webkit-details-marker]:hidden sm:px-4">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-sm font-extrabold text-[var(--dh-text)]">{{ title(event) }}</h3>
                  <span class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-shell)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dh-text-muted)]">
                    {{ category(event) }}
                  </span>
                </div>
                <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--dh-text-muted)]">
                  <span class="inline-flex items-center gap-1">
                    <UserRound class="h-3.5 w-3.5" aria-hidden="true" />{{ actorName(event.actorUserId) }}
                  </span>
                  <span aria-hidden="true">·</span>
                  <time :datetime="event.occurredAtUtc">{{ when(event.occurredAtUtc) }}</time>
                </div>
                <p class="mt-2 break-words text-xs leading-relaxed text-[var(--dh-text-soft)]">
                  {{ preview(event) }}
                </p>
              </div>
              <ChevronDown class="mt-1 h-4 w-4 shrink-0 text-[var(--dh-text-muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>

            <div class="border-t border-[var(--dh-border)] px-3 pb-3 pt-3 sm:px-4">
              <template v-if="auditChanges(event).length">
                <p class="mb-2 text-xs font-bold text-[var(--dh-text)]">{{ t('operations.auditTimeline.changedFields') }}</p>
                <dl class="divide-y divide-[var(--dh-border)]">
                  <div v-for="change in auditChanges(event)" :key="change.field" class="grid gap-1 py-2 text-xs sm:grid-cols-[minmax(100px,0.8fr)_minmax(0,2fr)] sm:gap-3">
                    <dt class="font-semibold text-[var(--dh-text-muted)]">{{ auditFieldLabel(change.field, translate) }}</dt>
                    <dd class="flex min-w-0 flex-wrap items-center gap-2 break-words text-[var(--dh-text)]">
                      <span class="text-[var(--dh-text-muted)]">{{ rowValue(change.before, change.field) }}</span>
                      <span aria-hidden="true" class="text-[var(--dh-primary)]">→</span>
                      <span class="font-bold">{{ rowValue(change.after, change.field) }}</span>
                    </dd>
                  </div>
                </dl>
              </template>
              <p v-else class="text-xs text-[var(--dh-text-muted)]">{{ t('operations.auditTimeline.noFieldChanges') }}</p>


            </div>
          </details>
        </li>
      </ol>
    </template>
  </div>
</template>
