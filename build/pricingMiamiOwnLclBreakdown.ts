import type { Plugin } from 'vite'
const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// miami-own-lcl-breakdown-20261016'
const HELPERS = String.raw`
// miami-own-lcl-breakdown-20261016
const showMiamiOwnLclBreakdown = computed(() =>
  isMiamiLcl.value && isOwnLclMatrixContext() && shipmentModeForApi.value === 'Lcl',
)
const miamiOwnLclBreakdownRows = computed(() => {
  if (!showMiamiOwnLclBreakdown.value) return []
  const source = lclSelectedSource.value
  const sourceId = source?.kind === 'Own' ? String(source.id ?? '') : ''
  const matching = rateLines.value.some((line) => {
    const notes = String(line.notes ?? '')
    return sourceId
      ? notes.includes('ConsolidadoId: ' + sourceId)
      : /LCL\s*PROPIO|ConsolidadoId:/i.test(notes)
  })
  const lines = matching ? rateLines.value
    : source?.kind === 'Own' ? (source.lines as RateLine[]) : []
  return lines.filter((line) =>
    line.included && (number(line.saleAmount) !== 0 || number(line.costAmount) !== 0),
  ).map((line) => {
    const quantity = Math.max(0, number(quantityForRateLine(line)))
    return {
      key: line.key,
      name: line.name,
      freight: line.costDetailType === 'Freight',
      basis: chargeBasisLabel(line.chargeBasis),
      quantity,
      cost: number(line.costAmount) * quantity,
      sale: number(line.saleAmount) * quantity,
    }
  })
})
const miamiOwnLclBreakdownCost = computed(() =>
  miamiOwnLclBreakdownRows.value.reduce((sum, line) => sum + line.cost, 0),
)
const miamiOwnLclBreakdownSale = computed(() =>
  miamiOwnLclBreakdownRows.value.reduce((sum, line) => sum + line.sale, 0),
)
const miamiOwnLclFreightBasis = computed(() => {
  const rate = miamiCommercialRate.value
  if (rate.little) return 'Tarifa escalonada CARGAS LITTLE'
  const unit = 'Tarifa USD ' + rate.salePerCft.toFixed(2) + ' / CFT'
  return miamiFreightCalculated.value < rate.minimumFreightSale
    ? unit + ' · mínimo aplicado USD ' + rate.minimumFreightSale.toFixed(2)
    : unit
})
`;
const TEMPLATE = String.raw`
          <section v-if="showMiamiOwnLclBreakdown" class="crystal-soft space-y-3 p-4 md:p-5">
            <div>
              <h3 class="text-base font-black">Desglose de venta · LCL propio Miami</h3>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ miamiCommercialRate.label }} · Flete por CFT con mínimo comercial y cargos adicionales separados.
              </p>
            </div>
            <div v-if="miamiOwnLclBreakdownRows.length" class="overflow-x-auto rounded-xl border border-[var(--dh-border)]">
              <table class="w-full min-w-[620px] text-xs">
                <thead class="bg-[var(--dh-input)] text-left text-[10px] font-black uppercase tracking-wide text-[var(--dh-text-muted)]">
                  <tr><th class="px-3 py-3">Concepto</th><th class="px-3 py-3 text-right">Cantidad / base</th><th class="px-3 py-3 text-right">Costo</th><th class="px-3 py-3 text-right">Venta</th></tr>
                </thead>
                <tbody>
                  <tr v-for="line in miamiOwnLclBreakdownRows" :key="line.key" class="border-t border-[var(--dh-border)]">
                    <td class="px-3 py-3">
                      <p class="font-bold">{{ line.name }}</p>
                      <p v-if="line.freight" class="mt-1 text-[11px] text-[var(--dh-text-muted)]">{{ miamiOwnLclFreightBasis }}</p>
                    </td>
                    <td class="px-3 py-3 text-right">{{ line.quantity.toFixed(line.freight ? 2 : 0) }} · {{ line.basis }}</td>
                    <td class="px-3 py-3 text-right">{{ formatMoney(line.cost, 'USD') }}</td>
                    <td class="px-3 py-3 text-right font-black">{{ formatMoney(line.sale, 'USD') }}</td>
                  </tr>
                </tbody>
                <tfoot class="border-t border-[var(--dh-border)] bg-[var(--dh-input)] font-black">
                  <tr><td class="px-3 py-3" colspan="2">Total de conceptos</td><td class="px-3 py-3 text-right">{{ formatMoney(miamiOwnLclBreakdownCost, 'USD') }}</td><td class="px-3 py-3 text-right">{{ formatMoney(miamiOwnLclBreakdownSale, 'USD') }}</td></tr>
                </tfoot>
              </table>
            </div>
            <p v-else class="text-xs font-bold text-[var(--dh-text-muted)]">Seleccione el consolidado Miami para visualizar los conceptos.</p>
          </section>
`;
function patch(code: string) {
  if (code.includes(MARKER)) return code
  const start = code.indexOf('<div v-else-if="step === 6" class="space-y-6">')
  const end = code.indexOf('<div v-else-if="step === 4" class="space-y-6">', start)
  if (start < 0 || end < start) throw new Error('[pricingMiamiOwnLclBreakdown] Missing step 6 section')
  const original = code.slice(start, end)
  let section = original
  for (const field of ['freightCost', 'freightSale']) {
    const regex = new RegExp('(<DhInput\\b[^>]*v-model\\.number="form\\.' + field + '"[^>]*\\/>)', 'g')
    if ([...section.matchAll(regex)].length !== 1) {
      throw new Error('[pricingMiamiOwnLclBreakdown] Expected one input ' + field)
    }
    section = section.replace(regex, '<template v-if="!showMiamiOwnLclBreakdown">$1</template>')
  }
  const summary = /<div(?: v-if="([^"]+)")? class="crystal-route-summary grid gap-3 md:grid-cols-4">/g
  if ([...section.matchAll(summary)].length !== 1) {
    throw new Error('[pricingMiamiOwnLclBreakdown] Missing provider summary')
  }
  section = section.replace(summary, (_tag, priorCondition: string | undefined) =>
    '<div v-if="' + (priorCondition ? '(' + priorCondition + ') && ' : '')
      + '!showMiamiOwnLclBreakdown" class="crystal-route-summary grid gap-3 md:grid-cols-4">',
  )
  const close = /\n        <\/div>\s*$/.exec(section)
  if (!close) throw new Error('[pricingMiamiOwnLclBreakdown] Missing closing step 6 tag')
  section = section.slice(0, close.index) + '\n' + TEMPLATE + section.slice(close.index)
  const helperAnchor = 'const providerCost = computed(() =>'
  if (code.split(helperAnchor).length !== 2) throw new Error('[pricingMiamiOwnLclBreakdown] Missing helper anchor')
  return code.replace(helperAnchor, HELPERS + '\n' + helperAnchor).replace(original, section)
}
export function pricingMiamiOwnLclBreakdown(): Plugin {
  return {
    name: 'dhole-pricing-miami-own-lcl-breakdown',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?') || !id.replace(/\\/g, '/').endsWith(WIZARD)) return null
      return { code: patch(source), map: null }
    },
  }
}
