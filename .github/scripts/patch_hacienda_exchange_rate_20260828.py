from pathlib import Path


def replace(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, 1))


# 1) Pricing interfaces: official snapshot + editable applied exchange rate.
replace(
    "src/core/interfaces/pricing.ts",
    "export interface RateDto extends Record<string, unknown> {\n",
    "export interface PricingExchangeRateDto extends Record<string, unknown> {\n  purchase: number\n  sale: number\n  rateDate: string\n  capturedAtUtc: string\n  source: string\n}\n\nexport interface RateDto extends Record<string, unknown> {\n",
)
replace(
    "src/core/interfaces/pricing.ts",
    "  currencyCode: string\n  freeDays: number\n",
    "  currencyCode: string\n  exchangeRatePurchase?: number | null\n  exchangeRateSale?: number | null\n  exchangeRateApplied?: number | null\n  exchangeRateDate?: string | null\n  exchangeRateCapturedAtUtc?: string | null\n  exchangeRateSource?: string | null\n  exchangeRateManualOverride: boolean\n  freeDays: number\n",
)
replace(
    "src/core/interfaces/pricing.ts",
    "  pickupLongitude?: number | null\n  currencyId: string\n",
    "  pickupLongitude?: number | null\n  exchangeRateApplied?: number | null\n  currencyId: string\n",
)

# 2) Endpoint and service.
replace(
    "src/core/composables/endpoints.ts",
    "  getRateDashboard: { method: 'GET', path: '/api/pricing/rates/dashboard', headers: acceptJson },\n",
    "  getRateDashboard: { method: 'GET', path: '/api/pricing/rates/dashboard', headers: acceptJson },\n  getUsdCrcExchangeRate: { method: 'GET', path: '/api/pricing/rates/exchange-rate/usd-crc', headers: acceptJson },\n",
)
replace(
    "src/core/services/pricingService.ts",
    "  PricingRateDashboardQuery,\n",
    "  PricingRateDashboardQuery,\n  PricingExchangeRateDto,\n",
)
replace(
    "src/core/services/pricingService.ts",
    "  async browseRates(query?: BrowseRatesQuery): Promise<PagedResponse<RateDto>> {",
    "  async getUsdCrcExchangeRate(): Promise<PricingExchangeRateDto> {\n    const response = await callEndpoint<unknown>(Endpoints.getUsdCrcExchangeRate)\n    return unwrapApiResponse<PricingExchangeRateDto>(response as never)\n  },\n\n  async browseRates(query?: BrowseRatesQuery): Promise<PagedResponse<RateDto>> {",
)

# 3) Wizard state and loader.
replace(
    "src/modules/pricing/components/PricingAlternativeWizardCrystal.vue",
    "const saving = ref(false)\nconst createdRateId = ref('')",
    "const saving = ref(false)\nconst exchangeRateLoading = ref(false)\nconst exchangeRatePurchase = ref<number | null>(null)\nconst exchangeRateSale = ref<number | null>(null)\nconst exchangeRateApplied = ref<number | null>(null)\nconst exchangeRateDate = ref('')\nconst exchangeRateSource = ref('Ministerio de Hacienda de Costa Rica')\nconst exchangeRateError = ref('')\nconst createdRateId = ref('')",
)
# Add loader before support upload section.
replace(
    "src/modules/pricing/components/PricingAlternativeWizardCrystal.vue",
    "async function uploadSupportDocument(category: string, categoryLabel: string, event: Event) {",
    '''async function loadHaciendaExchangeRate(resetApplied = false) {\n  if (exchangeRateLoading.value) return\n  try {\n    exchangeRateLoading.value = true\n    exchangeRateError.value = ''\n    const snapshot = await PricingService.getUsdCrcExchangeRate()\n    exchangeRatePurchase.value = Number(snapshot.purchase)\n    exchangeRateSale.value = Number(snapshot.sale)\n    exchangeRateDate.value = snapshot.rateDate\n    exchangeRateSource.value = snapshot.source || 'Ministerio de Hacienda de Costa Rica'\n    if (resetApplied || !exchangeRateApplied.value || exchangeRateApplied.value <= 0) {\n      exchangeRateApplied.value = Number(snapshot.sale)\n    }\n  } catch (error) {\n    exchangeRateError.value = 'Hacienda no respondió. Puede ingresar manualmente el tipo de cambio aplicado y continuar.'\n  } finally {\n    exchangeRateLoading.value = false\n  }\n}\n\nasync function uploadSupportDocument(category: string, categoryLabel: string, event: Event) {''',
)
# Send applied value on both open request and normal rate creation.
replace(
    "src/modules/pricing/components/PricingAlternativeWizardCrystal.vue",
    "      pickupLongitude: form.pickupLongitude,\n      currencyId: currency.id,",
    "      pickupLongitude: form.pickupLongitude,\n      exchangeRateApplied: exchangeRateApplied.value && exchangeRateApplied.value > 0 ? exchangeRateApplied.value : null,\n      currencyId: currency.id,",
)
replace(
    "src/modules/pricing/components/PricingAlternativeWizardCrystal.vue",
    "      pickupLongitude: ['EXW', 'FCA'].includes(selectedIncotermCode.value) ? form.pickupLongitude : null,\n      currencyId: currency!.id,",
    "      pickupLongitude: ['EXW', 'FCA'].includes(selectedIncotermCode.value) ? form.pickupLongitude : null,\n      exchangeRateApplied: exchangeRateApplied.value && exchangeRateApplied.value > 0 ? exchangeRateApplied.value : null,\n      currencyId: currency!.id,",
)
# Refresh when reaching draft, without overwriting a value the user already typed.
replace(
    "src/modules/pricing/components/PricingAlternativeWizardCrystal.vue",
    "watch(() => form.currencyId, () => {\n  if (step.value === 7) rebuildRateLines()\n})\n\nonMounted(loadCatalogs)",
    "watch(() => form.currencyId, () => {\n  if (step.value === 7) rebuildRateLines()\n})\n\nwatch(step, (value) => {\n  if (value === 8) void loadHaciendaExchangeRate(false)\n})\n\nonMounted(async () => {\n  await Promise.allSettled([loadCatalogs(), loadHaciendaExchangeRate(true)])\n})",
)

# 4) Draft screen: show official Compra/Venta and editable applied field.
replace(
    "src/modules/pricing/components/PricingAlternativeWizardCrystal.vue",
    "          <div class=\"grid gap-4 lg:grid-cols-2\">\n            <div class=\"crystal-soft p-5\">",
    '''          <div class="crystal-soft p-5">\n            <div class="flex flex-wrap items-start justify-between gap-3">\n              <div>\n                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tipo de cambio USD / CRC</p>\n                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Se consulta automáticamente a Hacienda. El valor aplicado queda editable antes de crear la tarifa.</p>\n              </div>\n              <DhButton variant="secondary" size="sm" :loading="exchangeRateLoading" :disabled="exchangeRateLoading" @click="loadHaciendaExchangeRate(true)">Actualizar Hacienda</DhButton>\n            </div>\n            <div class="mt-4 grid gap-3 md:grid-cols-3">\n              <div class="crystal-exchange-metric">\n                <span>Compra Hacienda</span>\n                <strong>{{ exchangeRatePurchase ? `₡ ${exchangeRatePurchase.toFixed(2)}` : '—' }}</strong>\n              </div>\n              <div class="crystal-exchange-metric">\n                <span>Venta Hacienda</span>\n                <strong>{{ exchangeRateSale ? `₡ ${exchangeRateSale.toFixed(2)}` : '—' }}</strong>\n              </div>\n              <DhInput v-model.number="exchangeRateApplied" type="number" min="0.000001" step="0.01" label="Tipo de cambio aplicado (editable)" />\n            </div>\n            <p v-if="exchangeRateDate" class="mt-3 text-[11px] font-bold text-[var(--dh-text-muted)]">{{ exchangeRateSource }} · fecha {{ formatDate(exchangeRateDate) }} · el valor se vuelve a validar al crear.</p>\n            <p v-if="exchangeRateSale && exchangeRateApplied && Math.abs(exchangeRateApplied - exchangeRateSale) > 0.0001" class="mt-2 text-[11px] font-black text-amber-600">Valor manual: la tarifa conservará Compra/Venta de Hacienda y también el tipo de cambio aplicado por el usuario.</p>\n            <p v-if="exchangeRateError" class="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-700">{{ exchangeRateError }}</p>\n          </div>\n          <div class="grid gap-4 lg:grid-cols-2">\n            <div class="crystal-soft p-5">''',
)
# Style for exchange metrics.
replace(
    "src/modules/pricing/components/PricingAlternativeWizardCrystal.vue",
    ".crystal-metric {\n",
    ".crystal-exchange-metric {\n  display: grid;\n  gap: 0.3rem;\n  min-height: 66px;\n  align-content: center;\n  border: 1px solid var(--dh-border);\n  border-radius: 16px;\n  padding: 0.65rem 0.8rem;\n  background: var(--dh-card);\n}\n\n.crystal-exchange-metric span {\n  font-size: 0.65rem;\n  font-weight: 900;\n  text-transform: uppercase;\n  letter-spacing: 0.08em;\n  color: var(--dh-text-muted);\n}\n\n.crystal-exchange-metric strong {\n  font-size: 1rem;\n  color: var(--dh-text);\n}\n\n.crystal-metric {\n",
)

# 5) Official rate detail keeps the historical snapshot visible.
replace(
    "src/modules/pricing/components/PricingRateDetailDrawer.vue",
    "    <section\n      class=\"dh-liquid overflow-hidden rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5\"\n    >",
    '''    <section\n      v-if="current.exchangeRateApplied"\n      class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"\n    >\n      <div class="flex flex-wrap items-center justify-between gap-3">\n        <div>\n          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Tipo de cambio guardado con la tarifa</p>\n          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ current.exchangeRateSource || 'Ministerio de Hacienda de Costa Rica' }}<span v-if="current.exchangeRateDate"> · {{ formatDate(current.exchangeRateDate) }}</span></p>\n        </div>\n        <DhBadge v-if="current.exchangeRateManualOverride" label="Aplicado manualmente" variant="warning" />\n        <DhBadge v-else label="Venta Hacienda aplicada" variant="success" />\n      </div>\n      <div class="mt-3 grid gap-2 sm:grid-cols-3">\n        <div class="rounded-2xl border border-[var(--dh-border)] px-3 py-2"><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Compra</span><strong class="mt-1 block">{{ current.exchangeRatePurchase ? `₡ ${Number(current.exchangeRatePurchase).toFixed(2)}` : '—' }}</strong></div>\n        <div class="rounded-2xl border border-[var(--dh-border)] px-3 py-2"><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Venta</span><strong class="mt-1 block">{{ current.exchangeRateSale ? `₡ ${Number(current.exchangeRateSale).toFixed(2)}` : '—' }}</strong></div>\n        <div class="rounded-2xl border border-[var(--dh-border)] px-3 py-2"><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Aplicado</span><strong class="mt-1 block text-[var(--dh-primary)]">₡ {{ Number(current.exchangeRateApplied).toFixed(2) }}</strong></div>\n      </div>\n    </section>\n\n    <section\n      class="dh-liquid overflow-hidden rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5"\n    >''',
)

print('Web Hacienda exchange-rate patch applied')
