import type { Plugin } from 'vite'

// Únicamente desglosa el costo del flete LCL Miami en la tabla de Pantalla 8.
const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// miami-freight-matrix-screen8-20261016'
const HELPERS = String.raw`
// miami-freight-matrix-screen8-20261016
const miamiFreightCostMatrix = computed(() => {
  // Valores de costo por CFT de la matriz Miami facilitada por Pricing.
  const rates: Record<string, Array<{ name: string; rate: number }>> = {
    A: [{ name: 'Flete', rate: 1.75 }, { name: 'Bunker', rate: 0.70 }, { name: 'THC', rate: 0.35 }],
    B: [{ name: 'Flete', rate: 1.80 }, { name: 'Bunker', rate: 0.80 }, { name: 'THC', rate: 0.35 }],
    C: [{ name: 'Flete', rate: 1.85 }, { name: 'Bunker', rate: 0.80 }, { name: 'THC', rate: 0.35 }],
    D: [{ name: 'Flete', rate: 1.85 }, { name: 'Bunker', rate: 0.72 }, { name: 'THC', rate: 0.35 }],
    'NVOCC-B': [{ name: 'Flete', rate: 1.85 }, { name: 'Bunker', rate: 0.70 }, { name: 'THC', rate: 0.35 }],
    'NVOCC-A': [{ name: 'Flete', rate: 2.04 }, { name: 'GRI', rate: 0.22 }, { name: 'THC', rate: 0.34 }],
  }
  return rates[String(form.miamiCommercialPlan || 'A')] ?? []
})
const showMiamiFreightCostMatrix = computed(() =>
  isMiamiLcl.value && shipmentModeForApi.value === 'Lcl'
  && isOwnLclMatrixContext() && miamiFreightCostMatrix.value.length > 0,
)
function miamiFreightMatrixParts(line: RateLine) {
  const rates = miamiFreightCostMatrix.value
  const cft = Math.max(0, number(quantityForRateLine(line)))
  const costTotal = number(line.costAmount) * cft
  const sumRates = rates.reduce((sum, part) => sum + part.rate, 0)
  let allocated = 0
  return rates.map((part, index) => {
    // Repartir el COSTO existente según la matriz, sin crear nuevas ventas.
    // El último componente absorbe residuos de redondeo para conciliar el total.
    const cost = index === rates.length - 1
      ? Math.round((costTotal - allocated) * 100) / 100
      : Math.round(costTotal * part.rate / sumRates * 100) / 100
    allocated += cost
    return { ...part, cft, cost }
  })
}
`;
const FREIGHT_ROWS = String.raw`
                  <template v-if="showMiamiFreightCostMatrix && line.costDetailType === 'Freight'">
                    <tr v-for="(part, index) in miamiFreightMatrixParts(line)" :key="'miami-part:' + line.key + ':' + index" class="border-t border-[var(--dh-border)]">
                      <td class="px-4 py-3">
                        <strong>{{ part.name }}</strong>
                        <p class="mt-1 text-[10px] font-semibold text-[var(--dh-text-muted)]">Componente de costo de la matriz Miami</p>
                      </td>
                      <td class="px-4 py-3">Por CFT cobrable</td>
                      <td class="px-4 py-3">{{ part.cft.toLocaleString('es-CR', { maximumFractionDigits: 3 }) }}</td>
                      <td class="px-4 py-3 font-black">USD</td>
                      <td class="px-4 py-3 text-right">
                        {{ formatMoney(part.rate, 'USD') }} / CFT
                        <span class="mt-1 block text-[10px] text-[var(--dh-text-muted)]">Total {{ formatMoney(part.cost, 'USD') }}</span>
                      </td>
                      <td class="px-4 py-3 text-right text-[var(--dh-text-muted)]">—</td>
                      <td class="px-4 py-3 text-right text-[var(--dh-text-muted)]">—</td>
                      <td class="px-4 py-3 text-right text-[var(--dh-text-muted)]">—</td>
                      <td class="px-4 py-3 text-right text-[var(--dh-text-muted)]">—</td>
                    </tr>
                    <tr class="border-t border-[var(--dh-border)] bg-[var(--dh-input)]">
                      <td class="px-4 py-3">
                        <strong>Subtotal comercial del flete Miami</strong>
                        <p class="mt-1 text-[10px] font-semibold text-[var(--dh-text-muted)]">
                          Tarifa de venta {{ formatMoney(miamiCommercialRate.salePerCft, 'USD') }} / CFT · mínimo {{ formatMoney(miamiCommercialRate.minimumFreightSale, 'USD') }}
                        </p>
                      </td>
                      <td class="px-4 py-3">{{ chargeBasisLabel(line.chargeBasis) }}</td>
                      <td class="px-4 py-3">{{ quantityForRateLine(line).toLocaleString('es-CR', { maximumFractionDigits: 3 }) }}</td>
                      <td class="px-4 py-3 font-black">{{ detailCurrencyValue(line) }}</td>
                      <td class="px-4 py-3 text-right text-[var(--dh-text-muted)]">Desglosado arriba</td>
                      <td class="px-4 py-3 text-right text-[var(--dh-text-muted)]">—</td>
                      <td class="px-4 py-3 text-right font-semibold">{{ formatMoney(number(line.saleAmount) * quantityForRateLine(line), canonicalCurrencyCode(line)) }}</td>
                      <td class="px-4 py-3 text-right font-semibold">{{ formatMoney(lineTaxTotalAmount(line), canonicalCurrencyCode(line)) }}</td>
                      <td class="px-4 py-3 text-right font-black">{{ formatMoney(lineSaleWithTax(line) * quantityForRateLine(line), canonicalCurrencyCode(line)) }}</td>
                    </tr>
                  </template>
`;
function patch(source: string) {
  if (source.includes(MARKER)) return source
  const start = source.indexOf('<div v-else-if="step === 8" class="space-y-6">')
  const end = source.indexOf('<div v-else-if="step === 9', start)
  if (start < 0 || end <= start) throw new Error('[MiamiFreightMatrix] No se encontró Pantalla 8')
  const screen = source.slice(start, end)
  const rowAnchor = '<tr v-for="line in includedLines"'
  const rowStart = screen.indexOf(rowAnchor)
  if (rowStart < 0 || screen.indexOf(rowAnchor, rowStart + rowAnchor.length) >= 0) {
    throw new Error('[MiamiFreightMatrix] No se encontró una única fila comercial de Pantalla 8')
  }
  const rowEnd = screen.indexOf('</tr>', rowStart)
  if (rowEnd <= rowStart) throw new Error('[MiamiFreightMatrix] Fila comercial sin cierre')
  const oldRow = screen.slice(rowStart, rowEnd + 5)
  const standardRow = oldRow.replace(
    /<tr v-for="line in includedLines" :key="[^"]+" class=/,
    '<tr v-else class=',
  )
  if (standardRow === oldRow) throw new Error('[MiamiFreightMatrix] No se pudo preservar la fila estándar')
  const replacement = '<template v-for="line in includedLines" :key="line.key">\n'
    + FREIGHT_ROWS + '\n' + standardRow + '\n</template>'
  const newScreen = screen.replace(oldRow, replacement)
  const anchor = 'const providerCost = computed(() =>'
  if (source.split(anchor).length !== 2) throw new Error('[MiamiFreightMatrix] Sin ancla de cálculo')
  return source.replace(anchor, HELPERS + '\n' + anchor).replace(screen, newScreen)
}
export function pricingMiamiOwnLclBreakdown(): Plugin {
  return {
    name: 'dhole-pricing-miami-own-lcl-breakdown',
    // Vite runs this after pricingWizardUiParity added the standard draft table.
    transform(source, id) {
      if (id.includes('?') || !id.replace(/\\/g, '/').endsWith(WIZARD_PATH)) return null
      return { code: patch(source), map: null }
    },
  }
}
