import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardUiParity] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

export function pricingWizardUiParity(): Plugin {
  return {
    name: 'dhole-pricing-wizard-ui-parity',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId?.endsWith(WIZARD_PATH)) return null

      let code = source

      // PricingAlternativeWizardCrystal owns insurance activation. This parity layer
      // only keeps the established pricing formula and presentation enhancements;
      // it must never reintroduce the removed "Aplicar póliza" toggle or gate the line.
      code = replaceOne(code, '  calculateCargoInsurance,\n', '', 'legacy Crystal insurance calculator import')
      code = replaceOne(code, '  cargoInsuranceNote,\n', '', 'legacy Crystal insurance note import')

      const stateAnchor = 'const draftCommercialTermsInitialized = ref(false)'
      const sharedInsuranceLogic = `function calculateCargoInsurance(cargoValue: number, _freightAmount: number) {\n  const value = Math.max(0, Number(cargoValue) || 0)\n  const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100\n  return {\n    insuredValue: roundMoney(value),\n    cost: Math.max(35, roundMoney(value * 0.002)),\n    sale: Math.max(95, roundMoney(value * 0.0065)),\n  }\n}\n\nfunction cargoInsuranceNote(cargoValue: number, freightAmount: number) {\n  const calculated = calculateCargoInsurance(cargoValue, freightAmount)\n  return \`Seguro de carga · valor carga USD \${calculated.insuredValue.toFixed(2)} · venta 0.65% · mínimo USD 95 · costo 0.20% · mínimo costo USD 35\`\n}`
      code = replaceOne(
        code,
        stateAnchor,
        `${stateAnchor}\n${sharedInsuranceLogic}`,
        'shared cargo insurance business rule',
      )

      // Preserve cargo value when reopening an existing insured rate without adding
      // any build-time enable/disable state.
      const hydrationAnchor = `    form.cargoDescription = rate.cargoLines?.[0]?.description ?? ''`
      const hydrationReplacement = `${hydrationAnchor}\n    const persistedInsurance = rate.rateDetails.find((detail) => detail.costDetailType === 'Insurance')\n    if (persistedInsurance) {\n      const cargoValueMatch = String(persistedInsurance.notes ?? '').match(/valor (?:carga|FOB) USD\\s+([0-9]+(?:\\.[0-9]+)?)/i)\n      if (cargoValueMatch?.[1]) form.cargoValue = Number(cargoValueMatch[1])\n    }`
      code = replaceOne(code, hydrationAnchor, hydrationReplacement, 'existing rate insurance hydration')

      const resetAnchor = `  draftCommercialTerms.value = { includes: [], subjectTo: [], excludes: [] }\n  draftCommercialTermsInitialized.value = false\n  supportEntityId.value = crypto.randomUUID()`
      const resetReplacement = `  draftCommercialTerms.value = { includes: [], subjectTo: [], excludes: [] }\n  draftCommercialTermsInitialized.value = false\n  form.cargoValue = 0\n  supportEntityId.value = crypto.randomUUID()`
      code = replaceOne(code, resetAnchor, resetReplacement, 'insurance wizard reset')

      const termsSectionAnchor = `          <section class="crystal-soft p-5">\n            <PricingCommercialTermsSelector v-model="draftCommercialTerms" :disabled="viewOnly" />\n          </section>`
      const linesTable = `          <section class="crystal-soft overflow-hidden p-0">\n            <div class="border-b border-[var(--dh-border)] px-5 py-4">\n              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Líneas completas de la tarifa</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Estas son exactamente las líneas que se guardarán al crear la tarifa.</p>\n            </div>\n            <div class="overflow-x-auto">\n              <table class="min-w-[1180px] w-full text-left text-xs">\n                <thead class="bg-[var(--dh-card-hover)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">\n                  <tr><th class="px-4 py-3">Rubro</th><th class="px-4 py-3">Base</th><th class="px-4 py-3">Cant.</th><th class="px-4 py-3">Divisa</th><th class="px-4 py-3 text-right">Costo unit.</th><th class="px-4 py-3 text-right">Venta unit.</th><th class="px-4 py-3 text-right">Venta subtotal</th><th class="px-4 py-3 text-right">IVA</th><th class="px-4 py-3 text-right">Venta total</th></tr>\n                </thead>\n                <tbody>\n                  <tr v-for="line in includedLines" :key="\`draft:\${line.key}\`" class="border-t border-[var(--dh-border)]">\n                    <td class="px-4 py-3">\n                      <strong>{{ line.name }}</strong>\n                      <p v-if="line.notes" class="mt-1 max-w-[360px] whitespace-pre-wrap text-[10px] font-semibold text-[var(--dh-text-muted)]">{{ line.notes }}</p>\n                    </td>\n                    <td class="px-4 py-3">{{ chargeBasisLabel(line.chargeBasis) }}</td>\n                    <td class="px-4 py-3">{{ quantityForChargeBasis(line.chargeBasis).toLocaleString('es-CR') }}</td>\n                    <td class="px-4 py-3 font-black">{{ detailCurrencyValue(line) }}</td>\n                    <td class="px-4 py-3 text-right">{{ formatMoney(number(line.costAmount), detailCurrencyValue(line)) }}</td>\n                    <td class="px-4 py-3 text-right">{{ formatMoney(number(line.saleAmount), detailCurrencyValue(line)) }}</td>\n                    <td class="px-4 py-3 text-right font-semibold">{{ formatMoney(number(line.saleAmount) * quantityForChargeBasis(line.chargeBasis), detailCurrencyValue(line)) }}</td>\n                    <td class="px-4 py-3 text-right font-semibold" :class="lineTaxTotalAmount(line) > 0 ? 'text-[var(--dh-primary)]' : 'text-[var(--dh-text-muted)]'">{{ formatMoney(lineTaxTotalAmount(line), detailCurrencyValue(line)) }}</td>\n                    <td class="px-4 py-3 text-right font-black">{{ formatMoney(lineSaleWithTax(line) * quantityForChargeBasis(line.chargeBasis), detailCurrencyValue(line)) }}</td>\n                  </tr>\n                </tbody>\n              </table>\n            </div>\n          </section>\n\n${termsSectionAnchor}`
      code = replaceOne(code, termsSectionAnchor, linesTable, 'Pantalla 8 complete tariff lines')

      return { code, map: null }
    },
  }
}
