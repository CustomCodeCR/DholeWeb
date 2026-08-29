from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')


def replace_exact(old: str, new: str, expected: int = 1) -> None:
    global text
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'Expected {expected} matches, found {count}: {old[:180]!r}')
    text = text.replace(old, new)


# Pantalla 7 y el resumen comercial de Pantalla 8 muestran venta SIN IVA.
replace_exact(
    "{{ formatMoney(totalSaleUsd, 'USD') }}",
    "{{ formatMoney(totalSaleBeforeTaxUsd, 'USD') }}",
    expected=2,
)
replace_exact(
    "{{ formatMoney(totalSaleCrc, 'CRC') }}",
    "{{ formatMoney(totalSaleBeforeTaxCrc, 'CRC') }}",
    expected=2,
)

# En Pantalla 7 solo se marca si el rubro lleva IVA; los importes se presentan en Pantalla 8.
vat_amounts = '''                  <div class="crystal-line-vat__amounts">\n                    <span>IVA <strong>{{ formatMoney(lineTaxAmount(line), line.currencyName || line.currencyCode || 'USD') }}</strong></span>\n                    <span>Venta + IVA <strong>{{ formatMoney(lineSaleWithTax(line), line.currencyName || line.currencyCode || 'USD') }}</strong></span>\n                  </div>'''
vat_note = '''                  <p class="text-[10px] font-bold leading-snug text-[var(--dh-text-muted)]">\n                    El importe del IVA se refleja en Pantalla 8.\n                  </p>'''
replace_exact(vat_amounts, vat_note, expected=2)

replace_exact(
    '''                <span>Venta USD <strong class="block">{{ formatMoney(totalSaleBeforeTaxUsd, 'USD') }}</strong></span>\n                <span>Venta CRC <strong class="block">{{ formatMoney(totalSaleBeforeTaxCrc, 'CRC') }}</strong></span>''',
    '''                <span>Venta sin IVA USD <strong class="block">{{ formatMoney(totalSaleBeforeTaxUsd, 'USD') }}</strong></span>\n                <span>Venta sin IVA CRC <strong class="block">{{ formatMoney(totalSaleBeforeTaxCrc, 'CRC') }}</strong></span>''',
)

cargo_card = '''            <div class="crystal-soft p-5 lg:col-span-2">\n              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Carga y respaldos</p>'''
vat_summary = '''            <div class="crystal-soft p-5 lg:col-span-2">\n              <div class="flex flex-wrap items-start justify-between gap-3">\n                <div>\n                  <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Totales de la oferta</p>\n                  <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">El IVA no forma parte de los totales de Pantalla 7. Aquí se presenta separado del subtotal.</p>\n                </div>\n                <DhBadge :variant="totalTaxUsd > 0 ? 'primary' : 'neutral'">\n                  {{ totalTaxUsd > 0 ? `IVA aplicado ${destinationTaxRate}%` : 'Sin IVA aplicado' }}\n                </DhBadge>\n              </div>\n\n              <div class="mt-4 overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">\n                <div class="grid grid-cols-[minmax(100px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)] gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">\n                  <span>Concepto</span>\n                  <span>USD</span>\n                  <span>CRC</span>\n                </div>\n                <div class="grid grid-cols-[minmax(100px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)] items-center gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-sm">\n                  <strong>Subtotal</strong>\n                  <strong>{{ formatMoney(totalSaleBeforeTaxUsd, 'USD') }}</strong>\n                  <strong>{{ formatMoney(totalSaleBeforeTaxCrc, 'CRC') }}</strong>\n                </div>\n                <div class="grid grid-cols-[minmax(100px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)] items-center gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-sm">\n                  <strong>IVA</strong>\n                  <strong>{{ formatMoney(totalTaxUsd, 'USD') }}</strong>\n                  <strong>{{ formatMoney(totalTaxCrc, 'CRC') }}</strong>\n                </div>\n                <div class="grid grid-cols-[minmax(100px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)] items-center gap-3 bg-[rgb(var(--dh-primary-rgb)/0.07)] px-4 py-4 text-base">\n                  <strong>Total</strong>\n                  <strong class="text-[var(--dh-primary)]">{{ formatMoney(totalSaleUsd, 'USD') }}</strong>\n                  <strong class="text-[var(--dh-primary)]">{{ formatMoney(totalSaleCrc, 'CRC') }}</strong>\n                </div>\n              </div>\n            </div>\n\n''' + cargo_card
replace_exact(cargo_card, vat_summary)

# Quitar CSS ya sin uso de los importes IVA por línea.
replace_exact(
    '''\n.crystal-line-vat__amounts {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 0.4rem;\n  font-size: 0.68rem;\n  font-weight: 800;\n  color: var(--dh-text-muted);\n}\n\n.crystal-line-vat__amounts span {\n  display: grid;\n  gap: 0.1rem;\n}\n\n.crystal-line-vat__amounts strong {\n  color: var(--dh-text);\n  font-size: 0.76rem;\n}\n''',
    '\n',
)
replace_exact(
    '''\n  .crystal-line-vat__amounts {\n    grid-template-columns: minmax(0, 1fr);\n  }\n''',
    '\n',
)

path.write_text(text, encoding='utf-8')
print('Screen 7 VAT exclusion and Screen 8 subtotal/IVA/total summary applied.')
