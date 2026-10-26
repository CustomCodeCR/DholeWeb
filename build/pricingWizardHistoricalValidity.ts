import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

/**
 * The quote's ValidFrom is the shipment/cargo-ready date, not the beginning
 * of the supplier's rate window. Historical quotes can have a past ValidTo.
 * Run last, after all the older wizard string transforms.
 */
export function patchPricingWizardHistoricalValidity(source: string): string {
  let code = source

  // Selecting an imported freight must never overwrite the shipment date.
  code = code.replace(
    "  // La selección del flete internacional define automáticamente la vigencia\\n  // comercial; no arrastramos los 30 días predeterminados ni fechas anteriores.\\n",
    "  // El flete seleccionado no modifica la fecha de carga/embarque de la QUO.\\n",
  )
  code = code.replace(
    /\\n  const freightValidFrom = String\\(rate\\.validFrom \\?\\? ''\\)\\.slice\\(0, 10\\)/,
    '',
  )
  code = code.replace(
    /\\n  if \\(freightValidFrom\\) form\\.loadDate = freightValidFrom/,
    '',
  )
  code = code.replace(
    /\\n  if \\(bundle\\.validFrom\\) form\\.loadDate = bundle\\.validFrom/,
    '',
  )

  // Both route (3) and provider (6) use one form.loadDate, for manual and
  // imported freights. Supplier validity may populate the suggested end only.
  code = code.replaceAll(
    "form.rateType === 'Tariff' ? 'Vigente desde' : 'Vigente desde / carga lista'",
    "form.rateType === 'Tariff' ? 'Vigente desde' : 'Fecha de carga / embarque (inicio de vigencia)'",
  )
  code = code.replaceAll(
    'label="Vigente desde / carga lista"',
    'label="Fecha de carga / embarque (inicio de vigencia)"',
  )
  code = code.replaceAll(
    "form.rateType === 'Tariff' ? 'Vigente hasta del tarifario' : 'Vigente hasta'",
    "form.rateType === 'Tariff' ? 'Vigente hasta del tarifario' : 'Vencimiento de la cotización'",
  )
  code = code.replaceAll(
    'label="Vigente hasta"',
    'label="Vencimiento de la cotización"',
  )

  // The shared fields are introduced by pricingWizardLandModeTerminology.
  const sharedEnd = '<DhInput v-model="form.validTo" type="date" label="Vencimiento de la cotización" :min="form.loadDate || undefined" />'
  if (code.includes(sharedEnd)) {
    code = code.replace(
      sharedEnd,
      sharedEnd + '\\n            <p class="text-xs font-semibold text-[var(--dh-text-muted)] md:col-span-2">La fecha inicial es la carga o el embarque. Puede registrar vencimientos anteriores a hoy si la cotización se acordó anteriormente.</p>',
    )
  }

  // Do not silently assign 30 days to an open request after the user has
  // explicitly entered a historical expiry.
  code = code.replace(
    'validTo: addDaysIso(form.loadDate, 30),',
    'validTo: form.validTo || addDaysIso(form.loadDate, 30),',
  )

  // Only compare the two selected commercial dates, never against today.
  const guard = `  if (!form.loadDate || !form.validTo || form.validTo < form.loadDate) {
    step.value = 6
    toastStore.error(
      'Revise las fechas de la cotización',
      'Indique la fecha de carga/embarque y un vencimiento igual o posterior. Se permiten fechas históricas.',
    )
    return
  }
`
  code = code.replace('async function saveRate() {\\n', 'async function saveRate() {\\n' + guard)
  code = code.replace('async function saveOpenRequest() {\\n', 'async function saveOpenRequest() {\\n' + guard)

  return code
}

export function pricingWizardHistoricalValidity(): Plugin {
  return {
    name: 'dhole-pricing-wizard-historical-validity',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_PATH)) return null
      return { code: patchPricingWizardHistoricalValidity(source), map: null }
    },
  }
}
