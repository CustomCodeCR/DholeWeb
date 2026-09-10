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

      // Pantalla 9 is a persisted snapshot. Never let reactive refreshes rebuild an
      // already hydrated rate from Costos y recargos while the user is only viewing it.
      const persistedSnapshotAnchor = `function refreshRateLinesForCurrentSource() {\n  // When an existing LCL rate is opened, hydrateExistingRate() already populated`
      const persistedSnapshotReplacement = `function refreshRateLinesForCurrentSource() {\n  if (props.viewOnly && props.rateId && rateLines.value.some((line) => Boolean(line.detailId))) return\n\n  // When an existing LCL rate is opened, hydrateExistingRate() already populated`
      code = replaceOne(
        code,
        persistedSnapshotAnchor,
        persistedSnapshotReplacement,
        'view-only persisted rate snapshot guard',
      )

      // The API detail currency is authoritative in Pantalla 9. Config is only a
      // fallback for legacy rows whose persisted display currency is missing.
      const detailCurrencyAnchor = `function detailCurrencyValue(detail: { currencyId: string; currencyName: string; currencyCode: string }) {\n  const configuredCurrency = findById(catalogs.currencies, detail.currencyId)\n  const configuredValue = displayValue(configuredCurrency)\n  if (configuredValue) return configuredValue\n\n  // Historical rates can predate the current catalog item. In that case prefer\n  // the persisted display value/name and use the internal CODE only as last fallback.\n  const persistedValue = String(detail.currencyName ?? '').trim()\n  if (persistedValue) return persistedValue\n  return String(detail.currencyCode ?? '').trim()\n}`
      const detailCurrencyReplacement = `function detailCurrencyValue(detail: { currencyId: string; currencyName: string; currencyCode: string }) {\n  const persistedName = String(detail.currencyName ?? '').trim().toUpperCase()\n  if (persistedName === 'USD' || persistedName === 'CRC') return persistedName\n\n  const canonical = canonicalCurrencyCode(detail)\n  if (canonical === 'USD' || canonical === 'CRC') return canonical\n\n  const configuredCurrency = findById(catalogs.currencies, detail.currencyId)\n  const configuredValue = String(displayValue(configuredCurrency) ?? '').trim()\n  if (configuredValue) return configuredValue\n\n  return String(detail.currencyCode ?? '').trim()\n}`
      code = replaceOne(
        code,
        detailCurrencyAnchor,
        detailCurrencyReplacement,
        'persisted detail currency precedence',
      )

      // Normalized USD/CRC totals remain useful while building/editing a rate. In
      // Pantalla 9, however, commercial totals must stay in their original currency
      // instead of converting every line into both currencies.
      const totalsAnchor = `function sumLinesInCurrency(amount: (line: RateLine) => number, target: 'USD' | 'CRC') {\n  return includedLines.value.reduce((sum, line) => {\n    const quantity = Math.max(0, number(quantityForChargeBasis(line.chargeBasis)))\n    const lineTotal = number(amount(line)) * quantity\n    return sum + convertUsdCrc(lineTotal, canonicalCurrencyCode(line), target)\n  }, 0)\n}`
      const totalsReplacement = `function sumLinesInCurrency(amount: (line: RateLine) => number, target: 'USD' | 'CRC') {\n  return includedLines.value.reduce((sum, line) => {\n    const quantity = Math.max(0, number(quantityForChargeBasis(line.chargeBasis)))\n    const lineTotal = number(amount(line)) * quantity\n    const sourceCode = canonicalCurrencyCode(line)\n\n    if (props.viewOnly && step.value === 9) {\n      return sourceCode === target ? sum + lineTotal : sum\n    }\n\n    return sum + convertUsdCrc(lineTotal, sourceCode, target)\n  }, 0)\n}`
      code = replaceOne(code, totalsAnchor, totalsReplacement, 'Pantalla 9 native currency totals')

      const marginAnchor = `const totalMarginPercentage = computed(() =>\n  totalSaleBeforeTaxUsd.value > 0 ? (totalUtilityUsd.value / totalSaleBeforeTaxUsd.value) * 100 : 0,\n)`
      const marginReplacement = `const totalMarginPercentage = computed(() => {\n  if (props.viewOnly && step.value === 9 && editingRate.value) {\n    return number(editingRate.value.marginPercentage)\n  }\n  return totalSaleBeforeTaxUsd.value > 0 ? (totalUtilityUsd.value / totalSaleBeforeTaxUsd.value) * 100 : 0\n})`
      code = replaceOne(code, marginAnchor, marginReplacement, 'Pantalla 9 persisted margin')

      code = replaceOne(
        code,
        `        amountCurrencyCode: detail.currencyCode,`,
        `        amountCurrencyCode: canonicalCurrencyCode({ currencyId: detail.currencyId, currencyName: detail.currencyName, currencyCode: detail.currencyCode }),`,
        'hydrated amount currency code',
      )

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
