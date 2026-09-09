import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const CATALOGS_PATH = '/src/modules/pricing/composables/usePricingCatalogs.ts'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingLandProviderCurrencyValue] Missing ${label} anchor.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  // Keep catalog Code for technical matching, but always render Config.Value to the user.
  code = code.replace(
    `.map((item) => ({ value: item.id, label: String(item.code || displayValue(item)).trim().toUpperCase() }))`,
    `.map((item) => ({ value: item.id, label: displayValue(item) }))`,
  )

  code = replaceRequired(
    code,
    `const selectedAgent = computed(() => findById(catalogs.agents, form.agentId))`,
    `const landAgentPlaceholder = {\n  id: '7f4ed7d4-60a3-4f69-90e0-e2e2b24b4c42',\n  code: 'LAND',\n  value: 'No aplica (terrestre)',\n  slug: 'land-internal-agent',\n} as CatalogItemSelectDto\nconst landCarrierPlaceholder = {\n  id: '7f4ed7d4-60a3-4f69-90e0-e2e2b24b4c43',\n  code: 'LAND',\n  value: 'No aplica (terrestre)',\n  slug: 'land-internal-carrier',\n} as CatalogItemSelectDto\nconst selectedAgent = computed(() => form.modality === 'Land' ? landAgentPlaceholder : findById(catalogs.agents, form.agentId))`,
    'selected agent',
  )
  code = replaceRequired(
    code,
    `const selectedCarrier = computed(() => findById(catalogs.carriers, form.carrierId))`,
    `const selectedCarrier = computed(() => form.modality === 'Land' ? landCarrierPlaceholder : findById(catalogs.carriers, form.carrierId))`,
    'selected carrier',
  )

  // Terrestrial rates do not have an external agent/carrier selector and do not include agent charges.
  code = replaceRequired(
    code,
    `const providerAgentCosts = computed(() => {\n  const seen = new Set<string>()`,
    `const providerAgentCosts = computed(() => {\n  if (form.modality === 'Land') return []\n  const seen = new Set<string>()`,
    'provider agent costs',
  )

  const lclOwnProvider = `v-if="shipmentModeForApi === 'Lcl' && lclSelectedSource?.kind === 'Own'"`
  if (code.includes(lclOwnProvider)) {
    code = code.replace(
      lclOwnProvider,
      `v-if="form.modality !== 'Land' && shipmentModeForApi === 'Lcl' && lclSelectedSource?.kind === 'Own'"`,
    )
  }

  if (code.includes(`<DhSelect v-else v-model="form.agentId"`)) {
    code = code.replace(
      `<DhSelect v-else v-model="form.agentId"`,
      `<DhSelect v-else-if="form.modality !== 'Land'" v-model="form.agentId"`,
    )
  } else if (code.includes(`<DhSelect v-model="form.agentId"`)) {
    code = code.replace(
      `<DhSelect v-model="form.agentId"`,
      `<DhSelect v-if="form.modality !== 'Land'" v-model="form.agentId"`,
    )
  }

  code = replaceRequired(
    code,
    `<DhSelect v-model="form.carrierId" label="Naviera / proveedor" :options="carrierOptions" />`,
    `<DhSelect v-if="form.modality !== 'Land'" v-model="form.carrierId" label="Naviera / proveedor" :options="carrierOptions" />`,
    'carrier selector',
  )

  code = code.replace(
    `<h2 class="crystal-title">Proveedor y flete internacional</h2>`,
    `<h2 class="crystal-title">{{ form.modality === 'Land' ? 'Flete terrestre' : 'Proveedor y flete internacional' }}</h2>`,
  )
  code = code.replace(
    `<p class="crystal-description">Los selects muestran el Value configurado en Config.</p>`,
    `<p class="crystal-description">{{ form.modality === 'Land' ? 'Para terrestre no se requiere agente ni naviera. La moneda muestra el Value configurado en Config.' : 'Los selects muestran el Value configurado en Config.' }}</p>`,
  )

  // Earlier LCL transforms own this block. Add Land as an explicit no-provider path.
  const enhancedCanNext = `  if (step.value === 6) {\n    const providerReady = shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value ? true : Boolean(form.agentId)\n    return Boolean(providerReady && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)\n  }`
  if (code.includes(enhancedCanNext)) {
    code = code.replace(
      enhancedCanNext,
      `  if (step.value === 6) {\n    if (form.modality === 'Land') {\n      return Boolean(form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)\n    }\n    const providerReady = shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value ? true : Boolean(form.agentId)\n    return Boolean(providerReady && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)\n  }`,
    )
  } else {
    code = replaceRequired(
      code,
      `  if (step.value === 6) return Boolean(form.agentId && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)`,
      `  if (step.value === 6) {\n    const providerReady = form.modality === 'Land' || Boolean(form.agentId && form.carrierId)\n    return Boolean(providerReady && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)\n  }`,
      'step 6 validation',
    )
  }

  code = code.replace(
    `  if (!agent && !(shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value)) missing.push('agente')`,
    `  if (form.modality !== 'Land' && !agent && !(shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value)) missing.push('agente')`,
  )
  code = code.replace(
    `  if (!agent) missing.push('agente')`,
    `  if (form.modality !== 'Land' && !agent) missing.push('agente')`,
  )
  code = code.replace(
    `  if (!carrier) missing.push('proveedor')`,
    `  if (form.modality !== 'Land' && !carrier) missing.push('proveedor')`,
  )

  // Do not auto-resolve a country agent for land. It is not part of the terrestrial tariff.
  code = code.replace(
    `  if (hydratingExistingRate.value || !form.originId) return`,
    `  if (hydratingExistingRate.value || !form.originId || form.modality === 'Land') return`,
  )

  // Intl.NumberFormat still needs the technical ISO Code even though the select renders Value.
  code = code.split(`displayValue(selectedCurrency) || 'USD'`).join(`selectedCurrency?.code || 'USD'`)

  // Resolve USD by technical code; Value is display-only and may be localized.
  code = code.replace(
    `const usd = currencies.find((item) => normalizeCatalogValue(displayValue(item)) === 'usd') ?? currencies[0]`,
    `const usd = currencies.find((item) => String(item.code ?? '').trim().toUpperCase() === 'USD')\n      ?? currencies.find((item) => normalizeCatalogValue(displayValue(item)).includes('dolar'))\n      ?? currencies[0]`,
  )

  // Imported rates carry technical currency code, so resolve by Code first and display Value afterwards.
  code = code.replace(
    `  const rateCurrency = normalizeCatalogValue(String(rate.currency ?? ''))\n  const currency = catalogs.currencies.find((item) =>\n    normalizeCatalogValue(displayValue(item)).includes(rateCurrency),\n  )`,
    `  const rateCurrencyCode = String(rate.currency ?? '').trim().toUpperCase()\n  const rateCurrencyValue = normalizeCatalogValue(String(rate.currency ?? ''))\n  const currency = catalogs.currencies.find((item) => String(item.code ?? '').trim().toUpperCase() === rateCurrencyCode)\n    ?? catalogs.currencies.find((item) => normalizeCatalogValue(displayValue(item)).includes(rateCurrencyValue))`,
  )

  return code
}

function patchPricingCatalogs(source: string) {
  // CatalogOption.name is what common selects render. Currency Code remains in `code` for calculations/API payloads.
  return source.replace(
    `  const isoCode = resolveCurrencyCode(item)\n  return {\n    id: item.id,\n    name: isoCode,`,
    `  return {\n    id: item.id,\n    name: catalogDisplayValue(item),`,
  )
}

export function pricingLandProviderCurrencyValue(): Plugin {
  return {
    name: 'dhole-pricing-land-provider-currency-value',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(CATALOGS_PATH)) return { code: patchPricingCatalogs(source), map: null }
      return null
    },
  }
}
