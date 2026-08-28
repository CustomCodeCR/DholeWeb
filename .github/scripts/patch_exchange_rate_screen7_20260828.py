from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


def replace_all(path: str, old: str, new: str, min_count: int = 1):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count < min_count:
        raise SystemExit(f"expected at least {min_count} occurrences in {path}, found {count}: {old[:160]!r}")
    p.write_text(text.replace(old, new))

wizard = "src/modules/pricing/components/PricingAlternativeWizardCrystal.vue"

# Remove the third visible/applied rate. Compra and Venta are now the actual editable inputs.
replace_once(
    wizard,
    "const exchangeRatePurchase = ref<number | null>(null)\nconst exchangeRateSale = ref<number | null>(null)\nconst exchangeRateApplied = ref<number | null>(null)\nconst exchangeRateDate = ref('')",
    "const exchangeRatePurchase = ref<number | null>(null)\nconst exchangeRateSale = ref<number | null>(null)\nconst exchangeRateDate = ref('')",
)

old_loader = '''async function loadHaciendaExchangeRate(resetApplied = false) {
  if (exchangeRateLoading.value) return
  try {
    exchangeRateLoading.value = true
    exchangeRateError.value = ''
    const snapshot = await PricingService.getUsdCrcExchangeRate()
    exchangeRatePurchase.value = Number(snapshot.purchase)
    exchangeRateSale.value = Number(snapshot.sale)
    exchangeRateDate.value = snapshot.rateDate
    exchangeRateSource.value = snapshot.source || 'Ministerio de Hacienda de Costa Rica'
    if (resetApplied || !exchangeRateApplied.value || exchangeRateApplied.value <= 0) {
      exchangeRateApplied.value = Number(snapshot.sale)
    }
  } catch (error) {
    exchangeRateError.value = 'Hacienda no respondió. Puede ingresar manualmente el tipo de cambio aplicado y continuar.'
  } finally {
    exchangeRateLoading.value = false
  }
}'''
new_loader = '''async function loadHaciendaExchangeRate(force = false) {
  if (exchangeRateLoading.value) return
  if (!force && exchangeRatePurchase.value && exchangeRateSale.value) return

  try {
    exchangeRateLoading.value = true
    exchangeRateError.value = ''
    const snapshot = await PricingService.getUsdCrcExchangeRate()
    const purchase = Number(snapshot.purchase)
    const sale = Number(snapshot.sale)

    if (!Number.isFinite(purchase) || purchase <= 0 || !Number.isFinite(sale) || sale <= 0) {
      throw new Error('Hacienda devolvió un tipo de cambio inválido')
    }

    exchangeRatePurchase.value = purchase
    exchangeRateSale.value = sale
    exchangeRateDate.value = snapshot.rateDate || ''
    exchangeRateSource.value = snapshot.source || 'Ministerio de Hacienda de Costa Rica'
  } catch {
    // No borrar valores escritos por el usuario si una actualización falla.
    exchangeRateError.value = 'No fue posible consultar Hacienda. Ingrese Compra y Venta manualmente o intente actualizar.'
  } finally {
    exchangeRateLoading.value = false
  }
}'''
replace_once(wizard, old_loader, new_loader)

# Fetch/prefill when Screen 7 is reached, not Screen 8.
replace_once(
    wizard,
    "watch(step, (value) => {\n  if (value === 8) void loadHaciendaExchangeRate(false)\n})",
    "watch(step, (value) => {\n  if (value === 7) void loadHaciendaExchangeRate(false)\n})",
)

# Validate both visible values before creation. This sends the user back to Screen 7.
replace_once(
    wizard,
    "async function saveRate() {\n  const origin = selectedOrigin.value",
    "async function saveRate() {\n  if (\n    !exchangeRatePurchase.value ||\n    exchangeRatePurchase.value <= 0 ||\n    !exchangeRateSale.value ||\n    exchangeRateSale.value <= 0\n  ) {\n    step.value = 7\n    exchangeRateError.value = 'Ingrese los tipos de cambio de Compra y Venta antes de crear la tarifa.'\n    return\n  }\n\n  const origin = selectedOrigin.value",
)

# Send Compra/Venta to Pricing. ExchangeRateApplied remains internal/backwards-compatible and follows Venta.
replace_all(
    wizard,
    "      exchangeRateApplied: exchangeRateApplied.value && exchangeRateApplied.value > 0 ? exchangeRateApplied.value : null,",
    "      exchangeRatePurchase: exchangeRatePurchase.value,\n      exchangeRateSale: exchangeRateSale.value,\n      exchangeRateApplied: exchangeRateSale.value,",
)

# Put the exchange-rate controls immediately below the sticky Screen 7 header.
header_marker = '''    <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalMarginPercentage)}`">Margen <strong>{{ totalMarginPercentage.toFixed(2) }}%</strong></span>
  </div>
          </div>

          <div v-for="group in orderedRateGroups" :key="group.key" class="space-y-2">'''
header_replacement = '''    <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalMarginPercentage)}`">Margen <strong>{{ totalMarginPercentage.toFixed(2) }}%</strong></span>
  </div>
          </div>

          <div class="crystal-soft p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tipo de cambio USD / CRC</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Se consulta automáticamente a Hacienda. Compra y Venta se pueden ajustar manualmente.</p>
              </div>
              <DhButton variant="secondary" size="sm" :loading="exchangeRateLoading" :disabled="exchangeRateLoading" @click="loadHaciendaExchangeRate(true)">Actualizar Hacienda</DhButton>
            </div>
            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <DhInput v-model.number="exchangeRatePurchase" type="number" min="0.000001" step="0.01" label="Compra Hacienda (editable)" />
              <DhInput v-model.number="exchangeRateSale" type="number" min="0.000001" step="0.01" label="Venta Hacienda (editable)" />
            </div>
            <p v-if="exchangeRateDate" class="mt-3 text-[11px] font-bold text-[var(--dh-text-muted)]">{{ exchangeRateSource }} · fecha {{ formatDate(exchangeRateDate) }}</p>
            <p v-if="exchangeRateError" class="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-700">{{ exchangeRateError }}</p>
          </div>

          <div v-for="group in orderedRateGroups" :key="group.key" class="space-y-2">'''
replace_once(wizard, header_marker, header_replacement)

# Remove the old Screen 8 exchange-rate card entirely.
old_screen8 = '''          <div class="crystal-soft p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tipo de cambio USD / CRC</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Se consulta automáticamente a Hacienda. El valor aplicado queda editable antes de crear la tarifa.</p>
              </div>
              <DhButton variant="secondary" size="sm" :loading="exchangeRateLoading" :disabled="exchangeRateLoading" @click="loadHaciendaExchangeRate(true)">Actualizar Hacienda</DhButton>
            </div>
            <div class="mt-4 grid gap-3 md:grid-cols-3">
              <div class="crystal-exchange-metric">
                <span>Compra Hacienda</span>
                <strong>{{ exchangeRatePurchase ? `₡ ${exchangeRatePurchase.toFixed(2)}` : '—' }}</strong>
              </div>
              <div class="crystal-exchange-metric">
                <span>Venta Hacienda</span>
                <strong>{{ exchangeRateSale ? `₡ ${exchangeRateSale.toFixed(2)}` : '—' }}</strong>
              </div>
              <DhInput v-model.number="exchangeRateApplied" type="number" min="0.000001" step="0.01" label="Tipo de cambio aplicado (editable)" />
            </div>
            <p v-if="exchangeRateDate" class="mt-3 text-[11px] font-bold text-[var(--dh-text-muted)]">{{ exchangeRateSource }} · fecha {{ formatDate(exchangeRateDate) }} · el valor se vuelve a validar al crear.</p>
            <p v-if="exchangeRateSale && exchangeRateApplied && Math.abs(exchangeRateApplied - exchangeRateSale) > 0.0001" class="mt-2 text-[11px] font-black text-amber-600">Valor manual: la tarifa conservará Compra/Venta de Hacienda y también el tipo de cambio aplicado por el usuario.</p>
            <p v-if="exchangeRateError" class="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-700">{{ exchangeRateError }}</p>
          </div>
'''
replace_once(wizard, old_screen8, '')

# Request contract used by PricingService.
replace_once(
    "src/core/interfaces/pricing.ts",
    "  pickupLongitude?: number | null\n  exchangeRateApplied?: number | null\n  currencyId: string",
    "  pickupLongitude?: number | null\n  exchangeRatePurchase?: number | null\n  exchangeRateSale?: number | null\n  exchangeRateApplied?: number | null\n  currencyId: string",
)

# Official rate detail: do not show a third 'Aplicado' value anymore.
detail = "src/modules/pricing/components/PricingRateDetailDrawer.vue"
replace_once(
    detail,
    '      v-if="current.exchangeRateApplied"',
    '      v-if="current.exchangeRatePurchase || current.exchangeRateSale"',
)
replace_once(
    detail,
    '<DhBadge v-if="current.exchangeRateManualOverride" label="Aplicado manualmente" variant="warning" />\n        <DhBadge v-else label="Venta Hacienda aplicada" variant="success" />',
    '<DhBadge v-if="current.exchangeRateManualOverride" label="Ajustado manualmente" variant="warning" />\n        <DhBadge v-else label="Hacienda" variant="success" />',
)
replace_once(
    detail,
    '''      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        <div class="rounded-2xl border border-[var(--dh-border)] px-3 py-2"><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Compra</span><strong class="mt-1 block">{{ current.exchangeRatePurchase ? `₡ ${Number(current.exchangeRatePurchase).toFixed(2)}` : '—' }}</strong></div>
        <div class="rounded-2xl border border-[var(--dh-border)] px-3 py-2"><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Venta</span><strong class="mt-1 block">{{ current.exchangeRateSale ? `₡ ${Number(current.exchangeRateSale).toFixed(2)}` : '—' }}</strong></div>
        <div class="rounded-2xl border border-[var(--dh-border)] px-3 py-2"><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Aplicado</span><strong class="mt-1 block text-[var(--dh-primary)]">₡ {{ Number(current.exchangeRateApplied).toFixed(2) }}</strong></div>
      </div>''',
    '''      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <div class="rounded-2xl border border-[var(--dh-border)] px-3 py-2"><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Compra</span><strong class="mt-1 block">{{ current.exchangeRatePurchase ? `₡ ${Number(current.exchangeRatePurchase).toFixed(2)}` : '—' }}</strong></div>
        <div class="rounded-2xl border border-[var(--dh-border)] px-3 py-2"><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Venta</span><strong class="mt-1 block text-[var(--dh-primary)]">{{ current.exchangeRateSale ? `₡ ${Number(current.exchangeRateSale).toFixed(2)}` : '—' }}</strong></div>
      </div>''',
)

print("Screen 7 editable Hacienda Compra/Venta patch applied")
