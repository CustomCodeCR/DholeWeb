/**
 * Local calendar grouping for CRM activities and follow-ups.
 * The API persists instants in UTC; the agenda must group by the viewer's
 * calendar date, not by the ISO UTC date or by fixed 24-hour intervals.
 */
export interface CrmAgendaDay {
  dateKey: string
  label: string
}

export function crmLocalDateKey(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function crmAgendaDays(now: Date = new Date(), locale = 'es-CR'): CrmAgendaDay[] {
  if (!Number.isFinite(now.getTime())) return []
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { dateKey: crmLocalDateKey(date)!, label: formatter.format(date) }
  })
}

function agendaInstant(record: object): unknown {
  const values = record as { scheduledStartAt?: unknown; dueAt?: unknown }
  return values.scheduledStartAt ?? values.dueAt
}

export function crmAgendaRecordsForDay<T extends object>(records: readonly T[], dateKey: string): T[] {
  return records
    .filter((record) => {
      const value = agendaInstant(record)
      return typeof value === 'string' && crmLocalDateKey(value) === dateKey
    })
    .sort((a, b) => {
      const start = new Date(String(agendaInstant(a))).getTime()
      const end = new Date(String(agendaInstant(b))).getTime()
      return start - end
    })
}
