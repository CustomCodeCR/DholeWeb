from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:140]!r}')
    write(path, text.replace(old, new, 1))

# -----------------------------------------------------------------------------
# Contracts
# -----------------------------------------------------------------------------
interfaces = 'src/core/interfaces/pricing.ts'
replace_once(interfaces,
'''export interface CostIncotermDto {
  id: string
  name: string
  code: string
}
''',
'''export interface CostIncotermDto {
  id: string
  name: string
  code: string
}

export interface CostServiceDto {
  id: string
  name: string
  code: string
}

export interface RateServiceDto {
  id: string
  name: string
  code: string
}

export type RateOperationType = 'Import' | 'Export' | 'TransitDomestic'
''')
replace_once(interfaces,
'''  incoterms: CostIncotermDto[]
  shipmentMode?: ShipmentMode | null
''',
'''  incoterms: CostIncotermDto[]
  services?: CostServiceDto[]
  shipmentMode?: ShipmentMode | null
''')
replace_once(interfaces,
'''  incoterms?: CostIncotermDto[]
  shipmentMode?: ShipmentMode | null
''',
'''  incoterms?: CostIncotermDto[]
  services?: CostServiceDto[]
  shipmentMode?: ShipmentMode | null
''')
replace_once(interfaces,
'''  rateType: RateType
  shipmentMode: ShipmentMode
''',
'''  rateType: RateType
  shipmentMode: ShipmentMode
  operationType: RateOperationType
''')
replace_once(interfaces,
'''  totalCostAmount: number
  totalSaleAmount: number
  totalUtilityAmount: number
  marginPercentage: number
''',
'''  totalCostAmount: number
  totalSaleAmount: number
  totalUtilityAmount: number
  totalCostUsd: number
  totalSaleUsd: number
  totalUtilityUsd: number
  totalCostCrc: number
  totalSaleCrc: number
  totalUtilityCrc: number
  marginPercentage: number
''')
replace_once(interfaces,
'''  containers?: RateContainerDto[]
  rateDetails: RateDetailDto[]
''',
'''  containers?: RateContainerDto[]
  rateDetails: RateDetailDto[]
  services?: RateServiceDto[]
''')
replace_once(interfaces,
'''  rateType?: RateType
  containers?: CreateRateContainerRequest[]
''',
'''  rateType?: RateType
  operationType?: RateOperationType
  services?: RateServiceDto[]
  containers?: CreateRateContainerRequest[]
''')
replace_once(interfaces,
'''  currencyId?: string | null
  isActive?: boolean | null
}
''',
'''  currencyId?: string | null
  isActive?: boolean | null
  polId?: string | null
  poeId?: string | null
  podId?: string | null
  incotermId?: string | null
  shipmentMode?: ShipmentMode | null
  applicableToContext?: boolean | null
  serviceIds?: string | null
}
''')

# -----------------------------------------------------------------------------
# Pricing common catalogs: expose pricing-services to Cost editor too.
# -----------------------------------------------------------------------------
catalogs = 'src/modules/pricing/composables/usePricingCatalogs.ts'
replace_once(catalogs,
'''  incoterms: 'incoterms',
} as const
''',
'''  incoterms: 'incoterms',
  services: 'pricing-services',
} as const
''')
replace_once(catalogs,
'''const incoterms = ref<PricingCatalogItem[]>([])
const loading = ref(false)
''',
'''const incoterms = ref<PricingCatalogItem[]>([])
const services = ref<PricingCatalogItem[]>([])
const loading = ref(false)
''')
replace_once(catalogs,
'''      profileRows,
      incotermRows,
    ] = await Promise.all([
''',
'''      profileRows,
      incotermRows,
      serviceRows,
    ] = await Promise.all([
''')
replace_once(catalogs,
'''      loadFirstAvailable([PRICING_CATALOG_SLUGS.importProfiles]),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.incoterms]),
    ])
''',
'''      loadFirstAvailable([PRICING_CATALOG_SLUGS.importProfiles]),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.incoterms]),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.services]),
    ])
''')
replace_once(catalogs,
'''    incoterms.value = incotermRows.map(normalizeIncoterm)
    loaded.value = true
''',
'''    incoterms.value = incotermRows.map(normalizeIncoterm)
    services.value = serviceRows
    loaded.value = true
''')
replace_once(catalogs,
'''    incoterms,
    loading,
''',
'''    incoterms,
    services,
    loading,
''')
replace_once(catalogs,
'''    incotermOptions: computed(() => options(incoterms.value)),
    loadAll,
''',
'''    incotermOptions: computed(() => options(incoterms.value)),
    serviceOptions: computed(() => options(services.value)),
    loadAll,
''')
replace_once(catalogs,
'''      incoterms: (cost.incoterms ?? []).map((costIncoterm) => {
''',
'''      services: (cost.services ?? []).map((costService) => {
        const current = services.value.find((item) => item.id === costService.id)
        return current
          ? { id: current.id, name: current.name, code: current.code }
          : costService
      }),
      incoterms: (cost.incoterms ?? []).map((costIncoterm) => {
''')

# -----------------------------------------------------------------------------
# Cost editor: Cost <-> pricing-services association
# -----------------------------------------------------------------------------
cost_form = 'src/modules/pricing/components/PricingCostFormDrawer.vue'
replace_once(cost_form,
'''  incotermIds: props.cost?.incoterms?.map((item) => item.id) ?? [],
  currencyId: props.cost?.currencyId ?? '',
''',
'''  incotermIds: props.cost?.incoterms?.map((item) => item.id) ?? [],
  serviceIds: props.cost?.services?.map((item) => item.id) ?? [],
  currencyId: props.cost?.currencyId ?? '',
''')
replace_once(cost_form,
'''  const incoterms = form.incotermIds
    .map((id) => selected(catalogs.incoterms.value, id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ id: item.id, name: item.name, code: item.code }))

  if (
''',
'''  const incoterms = form.incotermIds
    .map((id) => selected(catalogs.incoterms.value, id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ id: item.id, name: item.name, code: item.code }))
  const services = form.serviceIds
    .map((id) => selected(catalogs.services.value, id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ id: item.id, name: item.name, code: item.code }))

  if (
''')
replace_once(cost_form,
'''    isAccountant: isEquipmentBasis.value,
    incoterms,
    shipmentMode: form.shipmentMode || null,
''',
'''    isAccountant: isEquipmentBasis.value,
    incoterms,
    services,
    shipmentMode: form.shipmentMode || null,
''')
replace_once(cost_form,
'''        <div class="md:col-span-2">
          <PricingMultiSelect
            v-model="form.incotermIds"
''',
'''        <div class="md:col-span-2">
          <PricingMultiSelect
            v-model="form.serviceIds"
            :options="catalogs.serviceOptions.value"
            label="Servicios de Pricing asociados"
            placeholder="Aplica a cualquier servicio"
            empty-text="No hay servicios activos en pricing-services."
            search-placeholder="Buscar servicio..."
          />
          <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
            Si selecciona servicios, este costo o recargo solo se ofrecerá cuando la tarifa incluya al menos uno de ellos.
          </p>
        </div>
        <div class="md:col-span-2">
          <PricingMultiSelect
            v-model="form.incotermIds"
''')

# -----------------------------------------------------------------------------
# Wizard: line currencies, Costa Rica CRC rules, and dual totals.
# -----------------------------------------------------------------------------
wizard = 'src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
replace_once(wizard,
'''  ImportRateSelectDto,
  ShipmentMode,
} from '@/core/interfaces/pricing'
''',
'''  ImportRateSelectDto,
  RateOperationType,
  ShipmentMode,
} from '@/core/interfaces/pricing'
''')
replace_once(wizard,
'''  manual: boolean
  applyDestinationTax?: boolean
}
''',
'''  manual: boolean
  serviceIds?: string[]
  applyDestinationTax?: boolean
}
''')

# Operation is persisted from the same origin/POE rule already visible to the user.
replace_once(wizard,
'''const direction = computed(() => {
  if (!selectedOrigin.value || !selectedDestination.value) return ''
  const originCr = isCostaRica(selectedOrigin.value)
  const destinationCr = isCostaRica(selectedDestination.value)
  if (originCr && !destinationCr) return 'Exportación'
  if (!originCr && destinationCr) return 'Importación'
  return 'Tránsito / doméstico'
})
''',
'''const direction = computed(() => {
  if (!selectedOrigin.value || !selectedDestination.value) return ''
  const originCr = isCostaRica(selectedOrigin.value)
  const destinationCr = isCostaRica(selectedDestination.value)
  if (originCr && !destinationCr) return 'Exportación'
  if (!originCr && destinationCr) return 'Importación'
  return 'Tránsito / doméstico'
})
const operationType = computed<RateOperationType>(() => {
  if (direction.value === 'Importación') return 'Import'
  if (direction.value === 'Exportación') return 'Export'
  return 'TransitDomestic'
})

const forcedCrcServiceIds = computed(() => {
  const forcedNames = new Set([
    'agencia de aduanas crc',
    'almacenamiento',
    'embalaje de carga',
    'picking cargas',
    'recepcion de carga',
    'transporte de entrega',
    'transporte de recoleccion',
  ])
  return new Set(
    catalogs.services
      .filter((service) => {
        const values = [displayValue(service), service.label, service.code, service.slug]
          .map((value) => normalizeCatalogValue(String(value ?? '')))
        return values.some((value) => forcedNames.has(value))
      })
      .map((service) => service.id),
  )
})
const crcImportContext = computed(() => operationType.value === 'Import' && destinationCountryCode.value === 'CR')
const usdCurrency = computed(() => catalogs.currencies.find((item) => String(item.code || displayValue(item)).trim().toUpperCase() === 'USD') ?? null)
const crcCurrency = computed(() => catalogs.currencies.find((item) => String(item.code || displayValue(item)).trim().toUpperCase() === 'CRC') ?? null)
const lineCurrencyOptions = computed(() => {
  const options = catalogs.currencies
    .filter((item) => ['USD', 'CRC'].includes(String(item.code || displayValue(item)).trim().toUpperCase()))
    .map((item) => ({ value: item.id, label: String(item.code || displayValue(item)).trim().toUpperCase() }))
  return options.length ? options : currencyOptions.value
})

function isLineCrcForced(line: RateLine) {
  if (!crcImportContext.value || !line.serviceIds?.length) return false
  return line.serviceIds.some((id) => forcedCrcServiceIds.value.has(id) && form.serviceIds.includes(id))
}

function setLineCurrency(line: RateLine, currencyId: string) {
  const currency = findById(catalogs.currencies, currencyId)
  if (!currency) return
  line.currencyId = currency.id
  line.currencyName = displayValue(currency) || currency.label || currency.code
  line.currencyCode = String(currency.code || displayValue(currency)).trim().toUpperCase()
}

function enforceLineCurrency(line: RateLine) {
  if (isLineCrcForced(line) && crcCurrency.value) setLineCurrency(line, crcCurrency.value.id)
}
''')

# Filter configured costs by selected pricing services.
replace_once(wizard,
'''function applicableCost(cost: CostSelectDto) {
  if (cost.shipmentMode && cost.shipmentMode !== shipmentModeForApi.value) return false
''',
'''function applicableCost(cost: CostSelectDto) {
  if (cost.services?.length && !cost.services.some((service) => form.serviceIds.includes(service.id))) return false
  if (cost.shipmentMode && cost.shipmentMode !== shipmentModeForApi.value) return false
''')
replace_once(wizard,
'''  if (cost.incoterms?.length) score += 2
  if (cost.carrierId) score += 3
''',
'''  if (cost.incoterms?.length) score += 2
  if (cost.services?.length) score += 2
  if (cost.carrierId) score += 3
''')
replace_once(wizard,
'''      applicableToContext: true,
    } as any)
''',
'''      applicableToContext: true,
      serviceIds: form.serviceIds.join(',') || undefined,
    })
''')

# Attach service IDs to configured lines and then enforce the CR import currency rule.
replace_once(wizard,
'''      notes: cost.notes?.trim() || null,
      currencyId: cost.currencyId,
''',
'''      notes: cost.notes?.trim() || null,
      serviceIds: cost.services?.map((service) => service.id) ?? [],
      currencyId: cost.currencyId,
''')
replace_once(wizard,
'''  rateLines.value = lines
}
''',
'''  lines.forEach(enforceLineCurrency)
  rateLines.value = lines
}
''')

# Converted financials. Use Hacienda sale rate as the commercial USD/CRC conversion rate.
replace_once(wizard,
'''const totalCost = computed(() => includedLines.value.reduce((sum, line) => sum + number(line.costAmount), 0))
const totalSaleBeforeTax = computed(() => includedLines.value.reduce((sum, line) => sum + number(line.saleAmount), 0))
const totalTax = computed(() => includedLines.value.reduce((sum, line) => sum + lineTaxAmount(line), 0))
// totalSale es el total a cobrar al cliente; el IVA se muestra, pero queda fuera de utilidad y margen.
const totalSale = computed(() => totalSaleBeforeTax.value + totalTax.value)
const totalUtility = computed(() => totalSaleBeforeTax.value - totalCost.value)
const totalMarginPercentage = computed(() =>
  totalSaleBeforeTax.value > 0 ? (totalUtility.value / totalSaleBeforeTax.value) * 100 : 0,
)
''',
'''function convertUsdCrc(amount: number, sourceCode: string, targetCode: 'USD' | 'CRC') {
  const source = String(sourceCode || 'USD').trim().toUpperCase()
  if (source === targetCode) return number(amount)
  const rate = number(exchangeRateSale.value)
  if (rate <= 0) return 0
  if (source === 'USD' && targetCode === 'CRC') return number(amount) * rate
  if (source === 'CRC' && targetCode === 'USD') return number(amount) / rate
  return 0
}
function sumLinesInCurrency(amount: (line: RateLine) => number, target: 'USD' | 'CRC') {
  return includedLines.value.reduce(
    (sum, line) => sum + convertUsdCrc(amount(line), line.currencyCode, target),
    0,
  )
}
const totalCostUsd = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'USD'))
const totalCostCrc = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'CRC'))
const totalSaleBeforeTaxUsd = computed(() => sumLinesInCurrency((line) => number(line.saleAmount), 'USD'))
const totalSaleBeforeTaxCrc = computed(() => sumLinesInCurrency((line) => number(line.saleAmount), 'CRC'))
const totalTaxUsd = computed(() => sumLinesInCurrency(lineTaxAmount, 'USD'))
const totalTaxCrc = computed(() => sumLinesInCurrency(lineTaxAmount, 'CRC'))
const totalSaleUsd = computed(() => totalSaleBeforeTaxUsd.value + totalTaxUsd.value)
const totalSaleCrc = computed(() => totalSaleBeforeTaxCrc.value + totalTaxCrc.value)
const totalUtilityUsd = computed(() => totalSaleBeforeTaxUsd.value - totalCostUsd.value)
const totalUtilityCrc = computed(() => totalSaleBeforeTaxCrc.value - totalCostCrc.value)
const totalMarginPercentage = computed(() =>
  totalSaleBeforeTaxUsd.value > 0 ? (totalUtilityUsd.value / totalSaleBeforeTaxUsd.value) * 100 : 0,
)
const includedCurrencyCodes = computed(() => new Set(includedLines.value.map((line) => String(line.currencyCode).trim().toUpperCase())))
const hasMixedCurrencies = computed(() => includedCurrencyCodes.value.size > 1)
// Compatibility aliases used by existing visual helpers. Header currency is still preserved in the persisted rate.
const totalCost = computed(() => String(selectedCurrency.value?.code ?? '').toUpperCase() === 'CRC' ? totalCostCrc.value : totalCostUsd.value)
const totalSale = computed(() => String(selectedCurrency.value?.code ?? '').toUpperCase() === 'CRC' ? totalSaleCrc.value : totalSaleUsd.value)
const totalUtility = computed(() => String(selectedCurrency.value?.code ?? '').toUpperCase() === 'CRC' ? totalUtilityCrc.value : totalUtilityUsd.value)
''')

# Persist operation + selected services for open requests too.
replace_once(wizard,
'''      rateType: 'Spot',
      shipmentMode: shipmentModeForApi.value,
''',
'''      rateType: 'Spot',
      operationType: operationType.value,
      services: effectiveServices.value.map((service) => ({ id: service.id, name: displayValue(service) || service.label, code: service.code })),
      shipmentMode: shipmentModeForApi.value,
''')
# Second saveRate occurrence of rateType block.
text = read(wizard)
needle = "      rateType: 'Spot',\n      shipmentMode: shipmentModeForApi.value,\n"
if text.count(needle) != 1:
    raise RuntimeError(f'{wizard}: expected one remaining save rate type block, found {text.count(needle)}')
text = text.replace(needle, "      rateType: 'Spot',\n      operationType: operationType.value,\n      services: effectiveServices.value.map((service) => ({ id: service.id, name: displayValue(service) || service.label, code: service.code })),\n      shipmentMode: shipmentModeForApi.value,\n", 1)
write(wizard, text)

# Header totals: always show both equivalent currencies; label mixed-currency state explicitly.
replace_once(wizard,
'''            <div class="crystal-total-card">
    <span class="crystal-total-card__metric crystal-total-card__metric--cost">Costo <strong>{{ formatMoney(totalCost, displayValue(selectedCurrency) || 'USD') }}</strong></span>
    <span class="crystal-total-card__metric crystal-total-card__metric--sale">Venta <strong>{{ formatMoney(totalSale, displayValue(selectedCurrency) || 'USD') }}</strong></span>
    <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalUtility)}`">Utilidad <strong>{{ formatMoney(totalUtility, displayValue(selectedCurrency) || 'USD') }}</strong></span>
    <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalMarginPercentage)}`">Margen <strong>{{ totalMarginPercentage.toFixed(2) }}%</strong></span>
  </div>
''',
'''            <div class="crystal-total-card">
    <span class="crystal-total-card__metric crystal-total-card__metric--cost">Costo USD <strong>{{ formatMoney(totalCostUsd, 'USD') }}</strong></span>
    <span class="crystal-total-card__metric crystal-total-card__metric--cost">Costo CRC <strong>{{ formatMoney(totalCostCrc, 'CRC') }}</strong></span>
    <span class="crystal-total-card__metric crystal-total-card__metric--sale">Venta USD <strong>{{ formatMoney(totalSaleUsd, 'USD') }}</strong></span>
    <span class="crystal-total-card__metric crystal-total-card__metric--sale">Venta CRC <strong>{{ formatMoney(totalSaleCrc, 'CRC') }}</strong></span>
    <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalUtilityUsd)}`">Utilidad USD <strong>{{ formatMoney(totalUtilityUsd, 'USD') }}</strong></span>
    <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalMarginPercentage)}`">Margen <strong>{{ totalMarginPercentage.toFixed(2) }}%</strong></span>
    <span v-if="hasMixedCurrencies" class="crystal-total-card__metric crystal-total-card__metric--neutral">Oferta mixta <strong>USD + CRC</strong></span>
  </div>
''')

# Add currency column to ordinary lines and show forced rule/equivalent.
replace_once(wizard,
'''              class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_160px_160px_minmax(220px,280px)]"
''',
'''              class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_130px_160px_160px_minmax(220px,280px)]"
''')
replace_once(wizard,
'''              <DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" label="Costo" :disabled="line.costDetailType === 'AgentCharge' || line.costType !== 'Variable'" />
              <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" :disabled="line.costDetailType === 'AgentCharge'" />
''',
'''              <div>
                <DhSelect
                  :model-value="line.currencyId"
                  label="Divisa"
                  :options="lineCurrencyOptions"
                  :disabled="isLineCrcForced(line)"
                  @update:model-value="(value) => setLineCurrency(line, String(value))"
                />
                <p v-if="isLineCrcForced(line)" class="mt-1 text-[10px] font-black text-[var(--dh-primary)]">CRC obligatorio · Importación Costa Rica</p>
              </div>
              <DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" label="Costo" :disabled="line.costDetailType === 'AgentCharge' || line.costType !== 'Variable'" />
              <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" :disabled="line.costDetailType === 'AgentCharge'" />
''')

# Bottom optional/manual lines get the same currency selector.
replace_once(wizard,
'''                class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_160px_160px_minmax(220px,280px)_auto]"
''',
'''                class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_130px_160px_160px_minmax(220px,280px)_auto]"
''')
replace_once(wizard,
'''                <DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" label="Costo" :disabled="line.costDetailType === 'AgentCharge'" />
                <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" :disabled="line.costDetailType === 'AgentCharge'" />
''',
'''                <div>
                  <DhSelect
                    :model-value="line.currencyId"
                    label="Divisa"
                    :options="lineCurrencyOptions"
                    :disabled="isLineCrcForced(line)"
                    @update:model-value="(value) => setLineCurrency(line, String(value))"
                  />
                  <p v-if="isLineCrcForced(line)" class="mt-1 text-[10px] font-black text-[var(--dh-primary)]">CRC obligatorio · Importación Costa Rica</p>
                </div>
                <DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" label="Costo" :disabled="line.costDetailType === 'AgentCharge'" />
                <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" :disabled="line.costDetailType === 'AgentCharge'" />
''')

# Draft shows operation + both totals.
replace_once(wizard,
'''              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ form.modality }} · {{ form.shipmentMode }} · {{ displayValue(selectedEquipment) }} · {{ displayValue(selectedIncoterm) }}</p>
''',
'''              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ direction }} · {{ form.modality }} · {{ form.shipmentMode }} · {{ displayValue(selectedEquipment) }} · {{ displayValue(selectedIncoterm) }}</p>
''')
replace_once(wizard,
'''              <div class="mt-4 grid grid-cols-2 gap-2 text-sm"><span>Costo <strong class="block">{{ formatMoney(totalCost, displayValue(selectedCurrency) || 'USD') }}</strong></span><span>Venta <strong class="block">{{ formatMoney(totalSale, displayValue(selectedCurrency) || 'USD') }}</strong></span><span>Utilidad <strong class="block">{{ formatMoney(totalUtility, displayValue(selectedCurrency) || 'USD') }}</strong></span><span>Margen <strong class="block">{{ totalMarginPercentage.toFixed(2) }}%</strong></span></div>
''',
'''              <div class="mt-4 grid grid-cols-2 gap-2 text-sm">
                <span>Costo USD <strong class="block">{{ formatMoney(totalCostUsd, 'USD') }}</strong></span>
                <span>Costo CRC <strong class="block">{{ formatMoney(totalCostCrc, 'CRC') }}</strong></span>
                <span>Venta USD <strong class="block">{{ formatMoney(totalSaleUsd, 'USD') }}</strong></span>
                <span>Venta CRC <strong class="block">{{ formatMoney(totalSaleCrc, 'CRC') }}</strong></span>
                <span>Utilidad USD <strong class="block">{{ formatMoney(totalUtilityUsd, 'USD') }}</strong></span>
                <span>Utilidad CRC <strong class="block">{{ formatMoney(totalUtilityCrc, 'CRC') }}</strong></span>
                <span>Margen <strong class="block">{{ totalMarginPercentage.toFixed(2) }}%</strong></span>
                <span>Operación <strong class="block">{{ direction }}</strong></span>
              </div>
''')

print('Web service/currency patch applied.')
