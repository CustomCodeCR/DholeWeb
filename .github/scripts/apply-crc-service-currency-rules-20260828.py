from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected exactly one match, found {count}: {old[:160]!r}')
    text = text.replace(old, new, 1)


replace_once(
    "  salesExecutiveId?: string\n}",
    "  salesExecutiveId?: string\n  forceCrcInCostaRica?: boolean\n}",
)

replace_once(
    """function isCostaRica(item: CatalogItemSelectDto) {\n  const meta = metadata(item)\n  if (meta?.countryCode?.toUpperCase() === 'CR') return true\n  const text = displayValue(item).toLocaleLowerCase()\n  return text.includes('costa rica') || text.includes('costarica')\n}\n""",
    """function isCostaRica(item?: CatalogItemSelectDto | null) {\n  if (!item) return false\n  const meta = metadata(item)\n  if (meta?.countryCode?.toUpperCase() === 'CR') return true\n\n  const code = String(item.code ?? '').trim().toUpperCase()\n  if (code === 'CR' || /^CR[A-Z0-9]{3}$/.test(code)) return true\n\n  const text = normalizeCatalogValue([displayValue(item), item.label, item.code, item.slug].filter(Boolean).join(' '))\n  return text.includes('costa rica') || text.includes('costarica')\n}\n""",
)

replace_once(
    """const destinationCountryCode = computed(() => {\n  const configured = String(metadata(selectedDestination.value)?.countryCode ?? '').trim().toUpperCase()\n  if (configured) return configured\n  const destination = normalizeCatalogValue(displayValue(selectedDestination.value))\n  if (destination.includes('costa rica')) return 'CR'\n  if (destination.includes('panama')) return 'PA'\n  if (destination.includes('guatemala')) return 'GT'\n  return ''\n})\n""",
    """const destinationCountryCode = computed(() => {\n  const configured = String(metadata(selectedDestination.value)?.countryCode ?? '').trim().toUpperCase()\n  if (configured) return configured\n  if (isCostaRica(selectedDestination.value)) return 'CR'\n  const destination = normalizeCatalogValue([\n    displayValue(selectedDestination.value),\n    selectedDestination.value?.label,\n    selectedDestination.value?.code,\n    selectedDestination.value?.slug,\n  ].filter(Boolean).join(' '))\n  if (destination.includes('panama')) return 'PA'\n  if (destination.includes('guatemala')) return 'GT'\n  return ''\n})\n""",
)

replace_once(
    """const forcedCrcServiceIds = computed(() => {\n  const forcedNames = new Set([\n    'agencia de aduanas crc',\n    'almacenamiento',\n    'embalaje de carga',\n    'picking cargas',\n    'recepcion de carga',\n    'transporte de entrega',\n    'transporte de recoleccion',\n  ])\n  return new Set(\n    catalogs.services\n      .filter((service) => {\n        const values = [displayValue(service), service.label, service.code, service.slug]\n          .map((value) => normalizeCatalogValue(String(value ?? '')))\n        return values.some((value) => forcedNames.has(value))\n      })\n      .map((service) => service.id),\n  )\n})\nconst crcImportContext = computed(() => operationType.value === 'Import' && destinationCountryCode.value === 'CR')\n""",
    """const forcedCrcServiceIds = computed(() => {\n  const forcedNames = new Set([\n    'agencia de aduanas crc',\n    'almacenamiento',\n    'embalaje de carga',\n    'picking cargas',\n    'recepcion de carga',\n    'transporte de entrega',\n    'transporte de recoleccion',\n  ])\n  return new Set(\n    catalogs.services\n      .filter((service) => {\n        const configured = metadata(service)?.forceCrcInCostaRica\n        if (typeof configured === 'boolean') return configured\n\n        const values = [displayValue(service), service.label, service.code, service.slug]\n          .map((value) => normalizeCatalogValue(String(value ?? '')))\n        return values.some((value) => forcedNames.has(value))\n      })\n      .map((service) => service.id),\n  )\n})\n// Un POE de Costa Rica o una operación clasificada como importación activa la regla CRC.\n// El OR evita que un catálogo incompleto de país deje una importación CR cobrando en USD.\nconst crcImportContext = computed(() => operationType.value === 'Import' || destinationCountryCode.value === 'CR')\n""",
)

replace_once(
    """function setLineCurrency(line: RateLine, currencyId: string) {\n  const currency = findById(catalogs.currencies, currencyId)\n  if (!currency) return\n\n  const previousCode = String(line.currencyCode || '').trim().toUpperCase()\n  const nextCode = String(currency.code || displayValue(currency)).trim().toUpperCase()\n  const exchangeRate = number(exchangeRateSale.value)\n\n  // Cambiar la divisa no debe reinterpretar USD 100 como CRC 100. Se conserva\n  // el valor económico de la línea usando el tipo de cambio visible de Hacienda.\n  if (previousCode && previousCode !== nextCode && exchangeRate > 0) {\n    if (previousCode === 'USD' && nextCode === 'CRC') {\n      line.costAmount = Math.round(number(line.costAmount) * exchangeRate * 100) / 100\n      line.saleAmount = Math.round(number(line.saleAmount) * exchangeRate * 100) / 100\n    } else if (previousCode === 'CRC' && nextCode === 'USD') {\n      line.costAmount = Math.round((number(line.costAmount) / exchangeRate) * 100) / 100\n      line.saleAmount = Math.round((number(line.saleAmount) / exchangeRate) * 100) / 100\n    }\n  }\n\n  line.currencyId = currency.id\n  line.currencyName = displayValue(currency) || currency.label || currency.code\n  line.currencyCode = nextCode\n}\n""",
    """function setLineCurrency(line: RateLine, currencyId: string) {\n  const currency = findById(catalogs.currencies, currencyId)\n  if (!currency) return\n\n  const previousCode = canonicalCurrencyCode(line)\n  const nextRaw = String(currency.code || displayValue(currency)).trim()\n  const nextNormalized = normalizeCatalogValue([nextRaw, currency.label, currency.slug, displayValue(currency)].filter(Boolean).join(' '))\n  const nextCode = nextRaw.toUpperCase() === 'CRC' || nextNormalized.includes('colon') ? 'CRC' : 'USD'\n  const exchangeRate = number(exchangeRateSale.value)\n  const requiresUsdCrcConversion =\n    previousCode !== nextCode &&\n    ['USD', 'CRC'].includes(previousCode) &&\n    ['USD', 'CRC'].includes(nextCode)\n\n  // Nunca se cambia solamente la etiqueta de moneda. Si falta tipo de cambio,\n  // la línea conserva su moneda original y el watcher la convierte cuando llegue Hacienda.\n  if (requiresUsdCrcConversion && exchangeRate <= 0) return\n\n  if (requiresUsdCrcConversion) {\n    if (previousCode === 'USD' && nextCode === 'CRC') {\n      line.costAmount = Math.round(number(line.costAmount) * exchangeRate * 100) / 100\n      line.saleAmount = Math.round(number(line.saleAmount) * exchangeRate * 100) / 100\n    } else if (previousCode === 'CRC' && nextCode === 'USD') {\n      line.costAmount = Math.round((number(line.costAmount) / exchangeRate) * 100) / 100\n      line.saleAmount = Math.round((number(line.saleAmount) / exchangeRate) * 100) / 100\n    }\n  }\n\n  line.currencyId = currency.id\n  line.currencyName = displayValue(currency) || currency.label || currency.code\n  line.currencyCode = nextCode\n}\n""",
)

replace_once(
    """watch(\n  [crcImportContext, () => form.serviceIds.join('|'), crcCurrency],\n  () => rateLines.value.forEach(enforceLineCurrency),\n)\n""",
    """watch(\n  [crcImportContext, () => form.serviceIds.join('|'), crcCurrency, exchangeRateSale],\n  () => rateLines.value.forEach(enforceLineCurrency),\n)\n""",
)

label_count = text.count("CRC obligatorio · Importación Costa Rica")
if label_count != 2:
    raise RuntimeError(f'Expected two CRC mandatory labels, found {label_count}')
text = text.replace(
    "CRC obligatorio · Importación Costa Rica",
    "CRC obligatorio · POE Costa Rica / importación",
)

path.write_text(text, encoding='utf-8')
print('CRC service currency rules applied.')
