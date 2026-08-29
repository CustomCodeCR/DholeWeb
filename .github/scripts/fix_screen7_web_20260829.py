from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


wizard_path = Path("src/modules/pricing/components/PricingAlternativeWizardCrystal.vue")
wizard = wizard_path.read_text(encoding="utf-8-sig")

wizard = replace_once(
    wizard,
    """  lines.forEach(enforceLineCurrency)
  rateLines.value = lines
}

function addManualCharge() {""",
    """  lines.forEach(enforceLineCurrency)
  rateLines.value = lines
}

function mergeConfiguredOptionalCostsIntoRateLines() {
  const visible = new Set(visibleSections.value)
  const existingCostIds = new Set(
    rateLines.value.map((line) => line.costId).filter((value): value is string => Boolean(value)),
  )
  const existingKeys = new Set(
    rateLines.value.map((line) => `${normalizeCatalogValue(line.name)}|${line.costDetailType}`),
  )

  applicableConfiguredCosts()
    .filter((cost) => cost.costType === 'Optional')
    .forEach((cost) => {
      const section = sectionForCost(cost)
      const equivalentKey = `${normalizeCatalogValue(cost.name)}|${cost.costDetailType}`
      if (!visible.has(section) || existingCostIds.has(cost.id) || existingKeys.has(equivalentKey)) return

      rateLines.value.push({
        key: `cost:${cost.id}`,
        section,
        name: cost.name,
        costDetailType: cost.costDetailType,
        costType: cost.costType,
        chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),
        costId: cost.id,
        contextLabel: costContextLabel(cost),
        notes: cost.notes?.trim() || null,
        serviceIds: cost.services?.map((service) => service.id) ?? [],
        currencyId: cost.currencyId,
        currencyName: cost.currencyName,
        currencyCode: cost.currencyCode,
        costAmount: number(cost.costAmount),
        saleAmount: number(cost.saleAmount),
        included: false,
        optional: true,
        manual: false,
        applyDestinationTax: false,
        destinationTaxRate: 0,
      })
    })

  rateLines.value.forEach(enforceLineCurrency)
}

function addManualCharge() {""",
    "optional costs merge",
)

wizard = replace_once(
    wizard,
    """    form.carrierId = rate.carrierId ?? ''
    form.currencyId = rate.currencyId
    exchangeRatePurchase.value = Number(rate.exchangeRatePurchase || rate.exchangeRateApplied || 0) || null""",
    """    form.carrierId = rate.carrierId ?? ''
    form.currencyId = rate.currencyId
    await loadApplicableCosts()
    exchangeRatePurchase.value = Number(rate.exchangeRatePurchase || rate.exchangeRateApplied || 0) || null""",
    "hydrate applicable costs",
)

wizard = replace_once(
    wizard,
    """    })
    step.value = props.viewOnly ? 9 : 8
  } catch (error) {""",
    """    })
    mergeConfiguredOptionalCostsIntoRateLines()
    step.value = props.viewOnly ? 9 : 8
  } catch (error) {""",
    "hydrate optional costs",
)

wizard = replace_once(
    wizard,
    """            <div class="crystal-total-card">
    <span class="crystal-total-card__metric crystal-total-card__metric--cost">Costo USD <strong>{{ formatMoney(totalCostUsd, 'USD') }}</strong></span>
    <span class="crystal-total-card__metric crystal-total-card__metric--cost">Costo CRC <strong>{{ formatMoney(totalCostCrc, 'CRC') }}</strong></span>
    <span class="crystal-total-card__metric crystal-total-card__metric--sale">Venta USD <strong>{{ formatMoney(totalSaleBeforeTaxUsd, 'USD') }}</strong></span>
    <span class="crystal-total-card__metric crystal-total-card__metric--sale">Venta CRC <strong>{{ formatMoney(totalSaleBeforeTaxCrc, 'CRC') }}</strong></span>
    <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalUtilityUsd)}`">Utilidad USD <strong>{{ formatMoney(totalUtilityUsd, 'USD') }}</strong></span>
    <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalMarginPercentage)}`">Margen <strong>{{ totalMarginPercentage.toFixed(2) }}%</strong></span>
    <span v-if="hasMixedCurrencies" class="crystal-total-card__metric crystal-total-card__metric--neutral">Oferta mixta <strong>USD + CRC</strong></span>
  </div>""",
    """            <div class="crystal-total-card" aria-label="Resumen financiero de la tarifa">
              <span class="crystal-total-card__metric crystal-total-card__metric--cost">Costo USD <strong>{{ formatMoney(totalCostUsd, 'USD') }}</strong></span>
              <span class="crystal-total-card__metric crystal-total-card__metric--cost">Costo CRC <strong>{{ formatMoney(totalCostCrc, 'CRC') }}</strong></span>
              <span class="crystal-total-card__metric crystal-total-card__metric--subtotal">Subtotal USD <strong>{{ formatMoney(totalSaleBeforeTaxUsd, 'USD') }}</strong></span>
              <span class="crystal-total-card__metric crystal-total-card__metric--subtotal">Subtotal CRC <strong>{{ formatMoney(totalSaleBeforeTaxCrc, 'CRC') }}</strong></span>
              <span class="crystal-total-card__metric crystal-total-card__metric--tax">IVA USD <strong>{{ formatMoney(totalTaxUsd, 'USD') }}</strong></span>
              <span class="crystal-total-card__metric crystal-total-card__metric--tax">IVA CRC <strong>{{ formatMoney(totalTaxCrc, 'CRC') }}</strong></span>
              <span class="crystal-total-card__metric crystal-total-card__metric--total">Total USD <strong>{{ formatMoney(totalSaleUsd, 'USD') }}</strong></span>
              <span class="crystal-total-card__metric crystal-total-card__metric--total">Total CRC <strong>{{ formatMoney(totalSaleCrc, 'CRC') }}</strong></span>
              <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalUtilityUsd)}`">Utilidad USD <strong>{{ formatMoney(totalUtilityUsd, 'USD') }}</strong></span>
              <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalUtilityCrc)}`">Utilidad CRC <strong>{{ formatMoney(totalUtilityCrc, 'CRC') }}</strong></span>
              <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalMarginPercentage)}`">Margen <strong>{{ totalMarginPercentage.toFixed(2) }}%</strong></span>
              <span v-if="hasMixedCurrencies" class="crystal-total-card__metric crystal-total-card__metric--neutral">Oferta mixta <strong>USD + CRC</strong></span>
            </div>""",
    "screen 7 totals",
)

wizard = replace_once(
    wizard,
    '              class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_130px_160px_160px_minmax(220px,280px)]"',
    '              :class="[\'crystal-line grid items-end gap-3 p-3 lg:grid-cols-[minmax(200px,1fr)_120px_140px_140px_minmax(190px,230px)]\', group.key === \'freight\' ? \'crystal-line--freight\' : \'\']"',
    "main rate line grid",
)

wizard = replace_once(
    wizard,
    '                class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_130px_160px_160px_minmax(220px,280px)_auto]"',
    '                class="crystal-line grid items-end gap-3 p-3 lg:grid-cols-[minmax(200px,1fr)_120px_140px_140px_minmax(190px,230px)_auto]"',
    "bottom rate line grid",
)

wizard = wizard.replace(
    "El IVA se guarda por rubro y se refleja en esta pantalla y en Pantalla 8.",
    "Importe del IVA se refleja en pantalla 8",
)
wizard = replace_once(
    wizard,
    '                <p class="text-[11px] font-bold text-[var(--dh-text-muted)]">El IVA se selecciona individualmente en cada rubro.</p>\n',
    "",
    "optional IVA helper",
)

wizard = replace_once(
    wizard,
    "Incoterm {{ editingRate.incotermCode || editingRate.incotermName || '—' }}",
    "Incoterm {{ displayValue(selectedIncoterm) || editingRate.incotermName || editingRate.incotermCode || '—' }}",
    "full view incoterm value",
)

wizard = replace_once(
    wizard,
    """.crystal-total-card {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 1rem;
  border-radius: 18px;
  padding: 0.75rem 0.9rem;
  font-size: 0.78rem;
}

.crystal-lines-header {
  position: -webkit-sticky;
  position: sticky;
  top: 6.25rem;
  z-index: 29;
  align-self: flex-start;
  width: 100%;
  border: 1px solid var(--dh-border);
  border-radius: 20px;
  padding: 0.8rem;
  background-color: var(--dh-card-solid);
  background-image: none;
  opacity: 1;
  box-shadow: var(--dh-shadow-md);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
""",
    """.crystal-total-card {
  display: flex;
  width: 100%;
  max-width: 100%;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.3rem;
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 16px;
  padding: 0.42rem 0.5rem;
  font-size: 0.62rem;
  scrollbar-width: thin;
  overscroll-behavior-inline: contain;
}

.crystal-total-card__metric {
  display: inline-flex;
  flex: 0 0 auto;
  min-width: max-content;
  align-items: center;
  gap: 0.22rem;
  white-space: nowrap;
  line-height: 1;
}

.crystal-total-card__metric strong {
  font-size: 0.69rem;
  white-space: nowrap;
}

.crystal-total-card__metric--subtotal {
  color: rgb(2 132 199);
  border-color: rgb(2 132 199 / 0.28);
  background: rgb(2 132 199 / 0.08);
}

.crystal-total-card__metric--tax {
  color: rgb(124 58 237);
  border-color: rgb(124 58 237 / 0.28);
  background: rgb(124 58 237 / 0.08);
}

.crystal-total-card__metric--total {
  color: rgb(5 150 105);
  border-color: rgb(5 150 105 / 0.3);
  background: rgb(5 150 105 / 0.1);
}

.crystal-lines-header {
  position: -webkit-sticky;
  position: sticky;
  top: 5.75rem;
  z-index: 120;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr);
  align-self: flex-start;
  width: 100%;
  min-width: 0;
  gap: 0.55rem !important;
  isolation: isolate;
  border: 1px solid var(--dh-border);
  border-radius: 20px;
  padding: 0.72rem;
  background-color: var(--dh-card-solid);
  background-image: none;
  opacity: 1;
  box-shadow: 0 14px 34px rgb(15 23 42 / 0.22);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.crystal-lines-header > div {
  min-width: 0;
}

.crystal-lines-stage {
  isolation: isolate;
}
""",
    "sticky totals css",
)

wizard = replace_once(
    wizard,
    """.crystal-line-vat {
  display: grid;
  gap: 0.45rem;
  align-self: stretch;
  border: 1px solid var(--dh-border);
  border-radius: 16px;
  background: var(--dh-card);
  padding: 0.6rem 0.7rem;
}


.crystal-total-card span {""",
    """@media (min-width: 1024px) {
  .crystal-line--freight {
    grid-template-columns: minmax(260px, 500px) 120px 140px 140px !important;
    justify-content: start;
    max-width: 1040px;
  }

  .crystal-line--freight .crystal-line-vat {
    grid-column: 1 / -1;
    max-width: 320px;
  }
}

.crystal-line-vat {
  display: grid;
  gap: 0.35rem;
  align-self: stretch;
  border: 1px solid var(--dh-border);
  border-radius: 16px;
  background: var(--dh-card);
  padding: 0.55rem 0.65rem;
}

.crystal-line-vat p {
  white-space: nowrap;
  font-size: 0.62rem;
  line-height: 1.15;
}

.crystal-total-card span {""",
    "freight and VAT css",
)

wizard = replace_once(
    wizard,
    """  .crystal-lines-header .crystal-total-card {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
    padding: 0.4rem;
  }

  .crystal-lines-header .crystal-total-card__metric {
    min-width: 0;
    justify-content: space-between;
    border-radius: 12px;
    padding: 0.4rem 0.5rem;
  }

  .crystal-line-vat {
    width: 100%;
    min-width: 0;
  }
""",
    """  .crystal-lines-header .crystal-total-card {
    display: flex;
    width: 100%;
    flex-wrap: nowrap;
    gap: 0.28rem;
    padding: 0.32rem;
  }

  .crystal-lines-header .crystal-total-card__metric {
    flex: 0 0 auto;
    min-width: max-content;
    justify-content: flex-start;
    border-radius: 999px;
    padding: 0.32rem 0.42rem;
  }

  .crystal-line-vat {
    width: 100%;
    min-width: 0;
  }

  .crystal-line-vat p {
    white-space: normal;
  }
""",
    "mobile totals css",
)

required_wizard = [
    "Subtotal USD",
    "IVA USD",
    "Total USD",
    "Utilidad CRC",
    "Importe del IVA se refleja en pantalla 8",
    "mergeConfiguredOptionalCostsIntoRateLines()",
    "displayValue(selectedIncoterm)",
]
missing = [value for value in required_wizard if value not in wizard]
if missing:
    raise SystemExit(f"Missing Screen 7 changes: {missing}")
if "El IVA se guarda por rubro y se refleja en esta pantalla y en Pantalla 8." in wizard:
    raise SystemExit("Legacy IVA helper still present")

wizard_path.write_text(wizard, encoding="utf-8")


metric_path = Path("src/assets/pricing-metric-colors.css")
metric_path.write_text(
    """.crystal-route-summary > div {
  border-radius: 14px;
  padding: 0.5rem 0.65rem;
}

.crystal-route-summary > div:nth-child(1) {
  background: color-mix(in srgb, #f59e0b 14%, transparent);
  border: 1px solid color-mix(in srgb, #f59e0b 34%, transparent);
}

.crystal-route-summary > div:nth-child(1) strong { color: #f59e0b; }

.crystal-route-summary > div:nth-child(2) {
  background: color-mix(in srgb, #38bdf8 14%, transparent);
  border: 1px solid color-mix(in srgb, #38bdf8 34%, transparent);
}

.crystal-route-summary > div:nth-child(2) strong { color: #38bdf8; }

.crystal-route-summary > div:nth-child(3) {
  background: color-mix(in srgb, #22c55e 14%, transparent);
  border: 1px solid color-mix(in srgb, #22c55e 34%, transparent);
}

.crystal-route-summary > div:nth-child(3) strong { color: #22c55e; }

.crystal-route-summary > div:nth-child(4) {
  background: color-mix(in srgb, #a78bfa 14%, transparent);
  border: 1px solid color-mix(in srgb, #a78bfa 34%, transparent);
}

.crystal-route-summary > div:nth-child(4) strong { color: #a78bfa; }

.crystal-total-card { align-items: center; }
.crystal-total-card span {
  border-radius: 999px;
  padding: 0.38rem 0.48rem;
  font-weight: 700;
}
.crystal-total-card strong { font-size: inherit; }
""",
    encoding="utf-8",
)


types_path = Path("src/core/interfaces/pricing.ts")
types = types_path.read_text(encoding="utf-8-sig")
types = replace_once(
    types,
    """  totalCostCrc: number
  totalSaleCrc: number
  totalUtilityCrc: number
  marginPercentage: number""",
    """  totalCostCrc: number
  totalSaleCrc: number
  totalUtilityCrc: number
  totalTaxUsd?: number
  totalTaxCrc?: number
  totalSaleWithTaxUsd?: number
  totalSaleWithTaxCrc?: number
  marginPercentage: number""",
    "RateDto tax fields",
)
types_path.write_text(types, encoding="utf-8")


rates_path = Path("src/modules/pricing/views/PricingRatesView.vue")
rates = rates_path.read_text(encoding="utf-8-sig")
rates = replace_once(
    rates,
    """function containerSummary(rate: RateDto) {
  if (rate.shipmentMode === 'Lcl' || rate.shipmentMode === 'Ltl') {
    return `${rate.shipmentMode.toUpperCase()} · ${Number(rate.chargeableQuantity || 0).toFixed(3)} CBM`
  }
  if (rate.shipmentMode === 'Ftl') return `${rate.containerQuantity} × FTL`
  const allocations = rate.containers?.filter((item) => item.quantity > 0) ?? []
  if (allocations.length === 0) return `${rate.containerQuantity} × ${rate.containerTypeName}`
  return allocations.map((item) => `${item.quantity} × ${item.containerTypeName}`).join(' + ')
}
""",
    """function containerSummary(rate: RateDto) {
  if (rate.shipmentMode === 'Lcl' || rate.shipmentMode === 'Ltl') {
    return `${rate.shipmentMode.toUpperCase()} · ${Number(rate.chargeableQuantity || 0).toFixed(3)} CBM`
  }
  if (rate.shipmentMode === 'Ftl') return `${rate.containerQuantity} × FTL`
  const allocations = rate.containers?.filter((item) => item.quantity > 0) ?? []
  if (allocations.length === 0) return `${rate.containerQuantity} × ${rate.containerTypeName}`
  return allocations.map((item) => `${item.quantity} × ${item.containerTypeName}`).join(' + ')
}

function rateFinancialSummary(rate: RateDto) {
  const exchangeRate = Number(rate.exchangeRateApplied || rate.exchangeRateSale || 0)
  let costUsd = 0
  let subtotalUsd = 0
  let costCrc = 0
  let subtotalCrc = 0
  let taxUsd = 0
  let taxCrc = 0
  let recognized = false

  for (const detail of rate.rateDetails ?? []) {
    const quantity = Number(detail.quantity || 1) > 0 ? Number(detail.quantity || 1) : 1
    const cost = Number(detail.costAmount || 0) * quantity
    const sale = Number(detail.saleAmount || 0) * quantity
    const fallbackTax = detail.applyDestinationTax
      ? sale * Number(detail.destinationTaxRate || 0) / 100
      : 0
    const tax = Number(detail.destinationTaxAmount ?? fallbackTax)
    const currency = String(detail.currencyCode || '').trim().toUpperCase()

    if (currency === 'USD') {
      recognized = true
      costUsd += cost
      subtotalUsd += sale
      taxUsd += tax
      if (exchangeRate > 0) {
        costCrc += cost * exchangeRate
        subtotalCrc += sale * exchangeRate
        taxCrc += tax * exchangeRate
      }
    } else if (currency === 'CRC') {
      recognized = true
      costCrc += cost
      subtotalCrc += sale
      taxCrc += tax
      if (exchangeRate > 0) {
        costUsd += cost / exchangeRate
        subtotalUsd += sale / exchangeRate
        taxUsd += tax / exchangeRate
      }
    }
  }

  if (!recognized) {
    costUsd = Number(rate.totalCostUsd || 0)
    subtotalUsd = Number(rate.totalSaleUsd || 0)
    costCrc = Number(rate.totalCostCrc || 0)
    subtotalCrc = Number(rate.totalSaleCrc || 0)
    taxUsd = Number(rate.totalTaxUsd || 0)
    taxCrc = Number(rate.totalTaxCrc || 0)
  }

  const utilityUsd = subtotalUsd - costUsd
  const utilityCrc = subtotalCrc - costCrc
  return {
    subtotalUsd,
    subtotalCrc,
    taxUsd,
    taxCrc,
    totalUsd: subtotalUsd + taxUsd,
    totalCrc: subtotalCrc + taxCrc,
    utilityUsd,
    utilityCrc,
    margin: subtotalUsd > 0 ? utilityUsd / subtotalUsd * 100 : Number(rate.marginPercentage || 0),
  }
}
""",
    "rate financial summary",
)

rates = replace_once(
    rates,
    """          <template #cell-commercial="{ row }">
            <div class="min-w-[190px] text-right">
              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Venta de la revisión</p>
              <p class="font-black text-[var(--dh-text)]">USD {{ Number(row.totalSaleUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
              <p class="text-sm font-black text-[var(--dh-primary)]">CRC ₡{{ Number(row.totalSaleCrc || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
              <div class="mt-2 flex items-center justify-end gap-2">
                <span class="text-xs font-black" :class="row.totalUtilityUsd >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'">
                  Utilidad USD {{ Number(row.totalUtilityUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                </span>
                <DhBadge :label="`${row.marginPercentage.toFixed(2)}%`" :variant="marginTone(row.marginPercentage)" />
              </div>
            </div>
          </template>""",
    """          <template #cell-commercial="{ row }">
            <div class="min-w-[300px] text-right">
              <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Subtotal · IVA · Total</p>
              <div class="mt-1 grid grid-cols-[auto_auto] justify-end gap-x-2 gap-y-0.5 text-xs">
                <span class="font-semibold text-[var(--dh-text-muted)]">Subtotal</span>
                <strong>{{ formatMoney(rateFinancialSummary(row).subtotalUsd, 'USD') }} · {{ formatMoney(rateFinancialSummary(row).subtotalCrc, 'CRC') }}</strong>
                <span class="font-semibold text-[var(--dh-text-muted)]">IVA</span>
                <strong>{{ formatMoney(rateFinancialSummary(row).taxUsd, 'USD') }} · {{ formatMoney(rateFinancialSummary(row).taxCrc, 'CRC') }}</strong>
                <span class="font-black text-[var(--dh-primary)]">Total</span>
                <strong class="text-[var(--dh-primary)]">{{ formatMoney(rateFinancialSummary(row).totalUsd, 'USD') }} · {{ formatMoney(rateFinancialSummary(row).totalCrc, 'CRC') }}</strong>
              </div>
              <div class="mt-2 flex flex-wrap items-center justify-end gap-2">
                <span class="text-xs font-black" :class="rateFinancialSummary(row).utilityUsd >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'">
                  Utilidad {{ formatMoney(rateFinancialSummary(row).utilityUsd, 'USD') }} · {{ formatMoney(rateFinancialSummary(row).utilityCrc, 'CRC') }}
                </span>
                <DhBadge :label="`${rateFinancialSummary(row).margin.toFixed(2)}%`" :variant="marginTone(rateFinancialSummary(row).margin)" />
              </div>
            </div>
          </template>""",
    "rates list financial summary",
)
rates_path.write_text(rates, encoding="utf-8")


for path_string in [
    "src/modules/pricing/components/PricingEmailSourceModal.vue",
    "src/modules/pricing/views/PricingEmailSourceView.vue",
]:
    path = Path(path_string)
    text = path.read_text(encoding="utf-8-sig")
    text = text.replace('class="space-y-4"', 'class="min-w-0 space-y-4"', 1)
    text = text.replace('class="space-y-5 p-1"', 'class="min-w-0 space-y-4 p-0.5 sm:space-y-5 sm:p-1"', 1)
    text = text.replace(
        'class="mt-2 text-xl font-black text-[var(--dh-text)]"',
        'class="mt-2 break-words text-lg font-black text-[var(--dh-text)] sm:text-xl"',
    )
    text = text.replace(
        'class="mt-2 text-sm font-semibold text-[var(--dh-text-muted)]"',
        'class="mt-2 break-words text-xs font-semibold text-[var(--dh-text-muted)] sm:text-sm"',
    )
    text = text.replace(
        'class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Para:',
        'class="mt-1 break-words text-xs font-semibold text-[var(--dh-text-muted)]">Para:',
    )
    text = text.replace(
        'class="mt-5 whitespace-pre-wrap rounded-[20px] bg-black/[0.035] p-4 text-sm font-medium leading-6',
        'class="mt-5 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-[20px] bg-black/[0.035] p-3 text-xs font-medium leading-5 sm:p-4 sm:text-sm sm:leading-6',
    )
    text = text.replace(
        'class="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[18px] bg-black/[0.035] p-4 text-sm font-medium leading-6',
        'class="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-[18px] bg-black/[0.035] p-3 text-xs font-medium leading-5 sm:p-4 sm:text-sm sm:leading-6',
    )
    text = text.replace('class="mt-4 grid gap-2 md:grid-cols-2"', 'class="mt-4 grid min-w-0 gap-2 sm:grid-cols-2"')
    text = text.replace('class="truncate text-sm font-black"', 'class="min-w-0 truncate text-xs font-black sm:text-sm"')
    text = text.replace(
        'class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5"',
        'class="min-w-0 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 sm:rounded-[28px] sm:p-5"',
    )
    text = text.replace(
        'class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"',
        'class="min-w-0 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 sm:rounded-[22px] sm:p-4"',
    )
    path.write_text(text, encoding="utf-8")

print("DholeWeb Screen 7 and email responsive patch applied.")
