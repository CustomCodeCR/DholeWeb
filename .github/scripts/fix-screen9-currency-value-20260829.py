from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')

anchor = """function displayValue(item?: CatalogItemSelectDto | null) {\n  return item ? String(item.value ?? '').trim() : ''\n}\n"""
helper = """function displayValue(item?: CatalogItemSelectDto | null) {\n  return item ? String(item.value ?? '').trim() : ''\n}\n\nfunction detailCurrencyValue(detail: { currencyId: string; currencyName: string; currencyCode: string }) {\n  const configuredCurrency = findById(catalogs.currencies, detail.currencyId)\n  const configuredValue = displayValue(configuredCurrency)\n  if (configuredValue) return configuredValue\n\n  // Historical rates can predate the current catalog item. In that case prefer\n  // the persisted display value/name and use the internal CODE only as last fallback.\n  const persistedValue = String(detail.currencyName ?? '').trim()\n  if (persistedValue) return persistedValue\n  return String(detail.currencyCode ?? '').trim()\n}\n"""

if 'function detailCurrencyValue(' not in text:
    if anchor not in text:
        raise SystemExit('displayValue anchor not found')
    text = text.replace(anchor, helper, 1)

screen9_start = text.index('<div v-else-if="step === 9 && viewOnly && editingRate"')
screen9_end = text.index('</template>', screen9_start)
prefix = text[:screen9_start]
screen9 = text[screen9_start:screen9_end]
suffix = text[screen9_end:]

replacements = {
    '{{ detail.currencyCode }}': '{{ detailCurrencyValue(detail) }}',
    "formatMoney(Number(detail.costAmount || 0), detail.currencyCode)": "formatMoney(Number(detail.costAmount || 0), detailCurrencyValue(detail))",
    "formatMoney(Number(detail.saleAmount || 0), detail.currencyCode)": "formatMoney(Number(detail.saleAmount || 0), detailCurrencyValue(detail))",
    "formatMoney(Number(detail.saleAmount || 0) * Number(detail.quantity || 0), detail.currencyCode)": "formatMoney(Number(detail.saleAmount || 0) * Number(detail.quantity || 0), detailCurrencyValue(detail))",
}

for old, new in replacements.items():
    if old not in screen9:
        raise SystemExit(f'expected Screen 9 expression not found: {old}')
    screen9 = screen9.replace(old, new, 1)

if 'detail.currencyCode' in screen9:
    raise SystemExit('Screen 9 still references detail.currencyCode directly')

path.write_text(prefix + screen9 + suffix, encoding='utf-8')
