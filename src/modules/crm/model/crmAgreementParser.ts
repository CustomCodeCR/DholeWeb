/**
 * Deterministic Spanish date extraction for CRM agreements. This is a draft
 * assistant, NOT an automatic assertion of commitments or promised times.
 * Users review each detected date and can correct the proposed 09:00 hour.
 */
export interface CrmAgreementDraft {
  source: string
  title: string
  dueLocal: string
  hasExplicitTime: boolean
}

const months: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
}

const pad = (number: number) => String(number).padStart(2, '0')
function normalizeMonth(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function validDate(year: number, month: number, day: number): boolean {
  const result = new Date(year, month - 1, day)
  return result.getFullYear() === year &&
    result.getMonth() === month - 1 && result.getDate() === day
}

function determineYear(day: number, month: number, year: number | null, reference: Date): number {
  if (year !== null) return year
  const currentYear = reference.getFullYear()
  const candidate = new Date(currentYear, month - 1, day, 23, 59)
  return candidate.getTime() < reference.getTime() ? currentYear + 1 : currentYear
}

export function crmAgreementDueLocal(text: string, reference: Date): { dueLocal: string; hasExplicitTime: boolean } {
  if (!Number.isFinite(reference.getTime())) return { dueLocal: '', hasExplicitTime: false }
  let day: number | null = null
  let month: number | null = null
  let year: number | null = null
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/)
  const written = text.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(20\d{2}))?\b/i)
  const numeric = text.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](20\d{2}))?\b/)
  if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]) }
  else if (written) { day = Number(written[1]); month = months[normalizeMonth(written[2] ?? '')] ?? null; year = written[3] ? Number(written[3]) : null }
  else if (numeric) { day = Number(numeric[1]); month = Number(numeric[2]); year = numeric[3] ? Number(numeric[3]) : null }
  if (day === null || month === null) return { dueLocal: '', hasExplicitTime: false }

  const yyyy = determineYear(day, month, year, reference)
  if (!validDate(yyyy, month, day)) return { dueLocal: '', hasExplicitTime: false }

  let hour = 9
  let minute = 0
  let explicit = false
  const twelveHour = text.match(/\ba\s+las?\s+(\d{1,2})(?::([0-5]\d))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?\b/i)
  const twentyFourHour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (twelveHour) {
    hour = Number(twelveHour[1])
    minute = Number(twelveHour[2] || 0)
    const suffix = (twelveHour[3] || '').replace(/[\s.]/g, '').toLowerCase()
    if (suffix === 'pm' && hour < 12) hour += 12
    if (suffix === 'am' && hour === 12) hour = 0
    explicit = hour < 24
  } else if (twentyFourHour) {
    hour = Number(twentyFourHour[1])
    minute = Number(twentyFourHour[2])
    explicit = true
  }
  if (hour > 23 || minute > 59) { hour = 9; minute = 0; explicit = false }
  return {
    dueLocal: [yyyy, pad(month), pad(day)].join('-') + 'T' + pad(hour) + ':' + pad(minute),
    hasExplicitTime: explicit,
  }
}

export function crmAgreementDrafts(raw: string, reference: Date = new Date()): CrmAgreementDraft[] {
  return raw.split(/\r?\n|;|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/)
    .map(item => item.trim().replace(/^[•*-]\s*/, ''))
    .filter(Boolean).slice(0, 30)
    .map(source => ({
      source,
      title: source.slice(0, 250),
      ...crmAgreementDueLocal(source, reference),
    }))
}
