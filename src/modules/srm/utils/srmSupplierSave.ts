export type SupplierSaveSection = 'contacts' | 'credit'
export type SupplierSaveIssue = { section: SupplierSaveSection; message: string }
type Contact = { name: string; email: string; phone: string; role: string; countryId: string }
export interface SupplierSaveDraft {
  contacts: Contact[]
  creditEnabled: boolean
  creditDays: string | number | null
  creditLimit: string | number | null
  creditCurrency: string
  monthlyFinancing: string | number | null
  lateInterest: string | number | null
  creditIncluded: string[]
  creditExcluded: string[]
  creditReviewAt: string
}
/** Vue converts v-model on type=number inputs to numbers at runtime. Never call .trim() on a number. */
function creditNumberInput(value: string | number | null): { empty: boolean; numeric: number } {
  const text = String(value ?? '').trim()
  return { empty: !text, numeric: text ? Number(text) : Number.NaN }
}
function validCreditPrecision(value: number, places: number): boolean {
  const scaled = value * 10 ** places
  return Math.abs(Math.round(scaled) - scaled) < 1e-6
}
/** Validate together the optional supplier contacts and credit, before issuing POST/PUT. */
export function supplierSaveIssue(draft: SupplierSaveDraft, en = false): SupplierSaveIssue | null {
  if (draft.contacts.length > 30) return {
    section: 'contacts', message: en ? 'A supplier can have up to 30 contacts.' : 'El proveedor admite máximo 30 contactos.',
  }
  for (const [i, contact] of draft.contacts.entries()) {
    const number = i + 1
    if (!contact.name.trim()) return {
      section: 'contacts', message: en ? `Enter a name for contact #${number}.` : `Ingresá el nombre del contacto #${number} o eliminá el contacto incompleto.`,
    }
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return {
      section: 'contacts', message: en ? `Invalid email for contact #${number}.` : `El correo del contacto #${number} no es válido.`,
    }
    if (contact.phone.length > 40 || contact.name.length > 140 || contact.email.length > 180 || contact.role.length > 100) return {
      section: 'contacts', message: en ? `Contact #${number} exceeds the length limit.` : `El contacto #${number} supera el límite de caracteres.`,
    }
  }
  if (!draft.creditEnabled) return null
  const daysInput = creditNumberInput(draft.creditDays)
  const days = daysInput.numeric
  if (daysInput.empty || !Number.isInteger(days) || days < 1 || days > 3650) return {
    section: 'credit', message: en ? 'Credit payment term must be from 1 to 3650 days.' : 'El plazo de crédito debe estar entre 1 y 3650 días.',
  }
  const limitInput = creditNumberInput(draft.creditLimit)
  const limit = limitInput.numeric
  if (limitInput.empty || !Number.isFinite(limit) || limit <= 0 || !validCreditPrecision(limit, 2)) return {
    section: 'credit', message: en ? 'Credit limit must be positive with up to 2 decimal places.' : 'El límite de crédito debe ser positivo y tener máximo 2 decimales.',
  }
  const monthlyInput = creditNumberInput(draft.monthlyFinancing)
  const overdueInput = creditNumberInput(draft.lateInterest)
  const monthly = monthlyInput.numeric
  const overdue = overdueInput.numeric
  if (monthlyInput.empty || !Number.isFinite(monthly) ||
      monthly < 0 || monthly > 100 || !validCreditPrecision(monthly, 4)) return {
    section: 'credit', message: en ? 'Monthly financing must be 0–100%, up to 4 decimals.' : 'El financiamiento mensual debe estar entre 0% y 100%, con máximo 4 decimales.',
  }
  if (overdueInput.empty || !Number.isFinite(overdue) ||
      overdue < 0 || overdue > 100 || !validCreditPrecision(overdue, 4)) return {
    section: 'credit', message: en ? 'Monthly late interest must be 0–100%, up to 4 decimals.' : 'El interés moratorio mensual debe estar entre 0% y 100%, con máximo 4 decimales.',
  }
  if (!/^[A-Z]{3}$/.test(draft.creditCurrency.trim())) return {
    section: 'credit', message: en ? 'Select a valid credit currency.' : 'Seleccioná una moneda válida para el crédito.',
  }
  if (draft.creditIncluded.some(code => draft.creditExcluded.includes(code))) return {
    section: 'credit', message: en ? 'The same service cannot be included and excluded.' : 'Un concepto no puede incluirse y excluirse del crédito simultáneamente.',
  }
  if (draft.creditReviewAt && !Number.isFinite(new Date(draft.creditReviewAt).getTime())) return {
    section: 'credit', message: en ? 'Enter a valid next credit review date.' : 'Ingresá una fecha válida para la próxima revisión.',
  }
  return null
}

export function srmMutationFailure(response: unknown): string | null {
  let current: unknown = response
  for (let depth = 0; depth < 3; depth++) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) break
    const result = current as Record<string, unknown>
    if (result.success === false || result.isSuccess === false) {
      if (typeof result.message === 'string' && result.message.trim()) return result.message
      if (Array.isArray(result.errors) && result.errors.length)
        return result.errors.map(String).join(', ')
      return 'El servicio de proveedores rechazó el guardado.'
    }
    current = result.data ?? result.result
  }
  return null
}

/** Compare the exact monetary terms after a supplier mutation, using the saved Config catalog row. */
export function supplierPersistedCreditMatches(metadataJson: string | null | undefined, expected: {
  days: number
  limit: number
  currency: string
  monthlyFinancingPct: number
  lateInterestMonthlyPct: number
  includedServices: string[]
  excludedServices: string[]
}): boolean {
  try {
    const metadata: unknown = JSON.parse(metadataJson || '{}')
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
    const credit: unknown = (metadata as Record<string, unknown>).creditTerms
    if (!credit || typeof credit !== 'object' || Array.isArray(credit)) return false
    const saved = credit as Record<string, unknown>
    const equalCodes = (value: unknown, codes: string[]): boolean =>
      Array.isArray(value) && value.length === codes.length &&
      codes.every(code => value.includes(code))
    return saved.paymentType === 'credit' && saved.creditEnabled === true &&
      Number(saved.creditDays ?? saved.days) === expected.days &&
      Number(saved.creditLimit ?? saved.limit) === expected.limit &&
      String(saved.currencyCode ?? saved.currency).toUpperCase() === expected.currency.toUpperCase() &&
      Number(saved.monthlyFinancingPct) === expected.monthlyFinancingPct &&
      Number(saved.lateInterestMonthlyPct) === expected.lateInterestMonthlyPct &&
      equalCodes(saved.includedServices, expected.includedServices) &&
      equalCodes(saved.excludedServices, expected.excludedServices)
  } catch {
    return false
  }
}
