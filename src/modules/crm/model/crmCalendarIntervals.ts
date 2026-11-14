/** Calendar intervals use half-open time ranges in the viewer's local zone. */
export interface CalendarTimedRecord {
  key: string
  at: Date
  endsAt: Date | null
}

export function crmIntervalEnd(record: CalendarTimedRecord): Date {
  const finish = record.endsAt?.getTime()
  return new Date(finish !== undefined && Number.isFinite(finish) && finish > record.at.getTime()
    ? finish : record.at.getTime() + 1)
}

export function crmCalendarCoversDay(record: CalendarTimedRecord, day: Date): boolean {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  return record.at < end && crmIntervalEnd(record) > start
}

export interface CalendarWeekBar<T extends CalendarTimedRecord> {
  event: T
  from: number
  span: number
  lane: number
  begins: boolean
  finishes: boolean
}
export interface CalendarWeekLayout<T extends CalendarTimedRecord> {
  days: Date[]
  bars: CalendarWeekBar<T>[]
  extra: number[]
  lanes: number
}

/** Lay out a week as continuous horizontal bars, with non-overlapping lanes.
 * Months use fixed 3 lanes and per-day overflow buttons to avoid tall, uneven weeks.
 */
export function crmCalendarWeekLayout<T extends CalendarTimedRecord>(
  days: Date[], records: readonly T[], maxLanes = 3,
): CalendarWeekLayout<T> {
  const weekStart = days[0] && new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate())
  const weekEnd = days.length && new Date(days[days.length - 1]!.getFullYear(),
    days[days.length - 1]!.getMonth(), days[days.length - 1]!.getDate() + 1)
  const bars: CalendarWeekBar<T>[] = []
  const extra = days.map(() => 0)
  if (!weekStart || !weekEnd) return { days, bars, extra, lanes: maxLanes }
  const occupiedUntil: number[] = []
  const candidates = records.filter(record => record.at < weekEnd && crmIntervalEnd(record) > weekStart)
    .sort((a, b) => a.at.getTime() - b.at.getTime() ||
      crmIntervalEnd(b).getTime() - crmIntervalEnd(a).getTime() || a.key.localeCompare(b.key))
  for (const event of candidates) {
    const finish = crmIntervalEnd(event)
    let from = 0
    while (from < days.length && !crmCalendarCoversDay(event, days[from]!)) from++
    if (from >= days.length) continue
    let last = from
    while (last + 1 < days.length && crmCalendarCoversDay(event, days[last + 1]!)) last++
    const lane = occupiedUntil.findIndex(end => end < from)
    const chosenLane = lane < 0 ? occupiedUntil.length : lane
    occupiedUntil[chosenLane] = last
    if (chosenLane >= maxLanes) {
      for (let day = from; day <= last; day++) extra[day]!++
      continue
    }
    bars.push({
      event, from, span: last - from + 1, lane: chosenLane,
      begins: event.at >= weekStart,
      finishes: finish <= weekEnd,
    })
  }
  return { days, bars, extra, lanes: maxLanes }
}

/** Position each appointment vertically by its real elapsed minutes, clamped to office hours. */
export function crmCalendarTimedBlock<T extends CalendarTimedRecord>(
  record: T, day: Date, officeStart = 7, officeEnd = 21, slotHeight = 52,
) {
  const first = new Date(day.getFullYear(), day.getMonth(), day.getDate(), officeStart)
  const last = new Date(day.getFullYear(), day.getMonth(), day.getDate(), officeEnd)
  const end = crmIntervalEnd(record)
  if (record.at >= last || end <= first) return null
  const start = new Date(Math.max(first.getTime(), record.at.getTime()))
  const finish = new Date(Math.min(last.getTime(), end.getTime()))
  const minutePixels = slotHeight / 30
  const top = (start.getTime() - first.getTime()) / 60000 * minutePixels
  return {
    event: record,
    top, height: Math.max(24, (finish.getTime() - start.getTime()) / 60000 * minutePixels),
    startsHere: record.at >= first,
    finishesHere: end <= last,
  }
}
