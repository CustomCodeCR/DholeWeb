import type { Plugin } from 'vite'

// Runs after the land-cost loader and LTL master transforms, before Vue compiles
// the SFC. No change to REST/SignalR contracts or non-LTL quotation routes.
const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-own-ltl-cfz-san-jose-costs-20261112'

function replaceOnce(text: string, before: string, after: string) {
  if (!text.includes(before)) throw new Error('[pricingOwnLtlPanamaCosts] Missing anchor: ' + before.slice(0, 100))
  return text.replace(before, after)
}

export function patchPricingOwnLtlPanamaCosts(source: string): string {
  if (source.includes(MARKER)) return source
  let code = source
  if (!code.includes('function syncResolvedLandLtlTariffLines() {')) {
    throw new Error('[pricingOwnLtlPanamaCosts] LTL tariff sync must run first.')
  }

  code = replaceOnce(
    code,
    "import { resolveCostPricing } from '@/modules/pricing/utils/pricingCostRules'",
    "import { resolveCostPricing } from '@/modules/pricing/utils/pricingCostRules'\n"
      + "import { isCfzToSanJoseOwnLtl, ltlPanamaCostKind, selectLtlPanamaCosts } from '@/modules/pricing/utils/ltlPanamaOwnCosts'",
  )

  const loaderStart = code.indexOf('async function loadApplicableCosts()')
  const loaderEnd = code.indexOf('\nfunction rebuildRateLines()', loaderStart)
  if (loaderStart < 0 || loaderEnd < 0) throw new Error('[pricingOwnLtlPanamaCosts] Cost loader not found.')
  let loader = code.slice(loaderStart, loaderEnd)

  loader = replaceOnce(loader,
    "    const maritimeFcl = ['Maritime', 'Multimodal'].includes(String(form.modality)) && costShipmentModeForApi() === 'Fcl'",
    `    const panamaOwnLtl = isCfzToSanJoseOwnLtl(
      selectedOrigin.value ? displayValue(selectedOrigin.value) : resolvedFtlTariff.value?.originName,
      selectedDestination.value ? displayValue(selectedDestination.value) : resolvedFtlTariff.value?.destinationName,
      shipmentModeForApi.value,
      landLtlCommercialProfile.value,
    )
    const maritimeFcl = ['Maritime', 'Multimodal'].includes(String(form.modality)) && costShipmentModeForApi() === 'Fcl'`,
  )
  loader = replaceOnce(loader,
    "      maritimeFcl\n        ? PricingService.selectCosts({ isActive: true })",
    "      (maritimeFcl || panamaOwnLtl)\n        ? PricingService.selectCosts({ isActive: true })",
  )
  loader = replaceOnce(loader,
    "(!maritimeFcl || fullCatalogResult.status === 'rejected')",
    "(!(maritimeFcl || panamaOwnLtl) || fullCatalogResult.status === 'rejected')",
  )
  loader = replaceOnce(loader,
    "    if (activeContext !== activeCostContextKey()) return false\n    costs.value = [...mergedCosts.values()]",
    `    if (panamaOwnLtl) {
      // The contextual API uses exact POE/POD IDs. CFZ -> San José is an LTL
      // warehouse route; the configured Panama -> Costa Rica charges instead
      // select their eligible border ports. Resolve the four charges from the
      // full active catalog while retaining all other contextual restrictions.
      for (const cost of selectLtlPanamaCosts(fullCatalog, {
        incotermId: form.incotermId,
        serviceIds: form.serviceIds,
      }).values()) mergedCosts.set(cost.id, cost)
    }

    if (activeContext !== activeCostContextKey()) return false
    costs.value = [...mergedCosts.values()]`,
  )
  loader = replaceOnce(loader,
    "    return true\n  } catch (error) {",
    `    if (panamaOwnLtl && resolvedFtlTariff.value && rateLines.value.length) {
      syncResolvedLandLtlTariffLines()
    }
    return true
  } catch (error) {`,
  )
  code = code.slice(0, loaderStart) + loader + code.slice(loaderEnd)

  const helper = `
// The selected cost master is authoritative for CFZ -> San José own LTL.
// Unlike the CBM tariff, weight-band prices are TOTALS (including PerKg bands).
// Persist as PerShipment to avoid multiplying a band amount again.
function applyOwnLtlPanamaCosts() {
  const tariff = resolvedFtlTariff.value
  if (!tariff || !isCfzToSanJoseOwnLtl(
    selectedOrigin.value ? displayValue(selectedOrigin.value) : tariff.originName,
    selectedDestination.value ? displayValue(selectedDestination.value) : tariff.destinationName,
    shipmentModeForApi.value,
    landLtlCommercialProfile.value,
  )) return

  const selected = selectLtlPanamaCosts(costs.value, {
    incotermId: form.incotermId,
    serviceIds: form.serviceIds,
  })
  if (!selected.size) return

  const amounts = new Map<string, { costAmount: number; saleAmount: number }>()
  for (const [kind, cost] of selected) {
    const resolved = resolvedConditionalCost(cost)
    if (!resolved) continue
    amounts.set(kind, {
      costAmount: Math.max(0, resolved.costAmount, number(cost.minimumCostAmount)),
      saleAmount: Math.max(0, resolved.saleAmount, number(cost.minimumSaleAmount)),
    })
  }

  // The regular loader can have already added those same catalog costs.
  // Remove all copies before inserting the one authoritative charge per kind.
  rateLines.value = rateLines.value.filter((line) => {
    const kind = ltlPanamaCostKind(line.name)
    return line.costDetailType === 'Freight' || !kind || !amounts.has(kind)
  })

  for (const [kind, cost] of selected) {
    const amount = amounts.get(kind)
    if (!amount) continue

    if (kind === 'freight') {
      const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')
      if (!freight) continue
      freight.name = cost.name
      freight.costId = cost.id
      freight.chargeBasis = 'PerShipment'
      freight.costAmount = amount.costAmount
      freight.saleAmount = amount.saleAmount
      freight.currencyId = cost.currencyId
      freight.currencyName = cost.currencyName
      freight.currencyCode = cost.currencyCode
      freight.amountCurrencyCode = cost.currencyCode
      freight.optional = false
      freight.included = true
      freight.manual = false
      freight.notes = cost.notes?.trim() || 'Flete terrestre LTL calculado según el rango de peso del catálogo.'
      freight.contextLabel = 'LTL propio · CFZ → San José · Costos y recargos'
      form.freightCost = amount.costAmount
      form.freightSale = amount.saleAmount
      enforceLineCurrency(freight)
      continue
    }

    const section = sectionForCost(cost)
    const line: RateLine = {
      key: 'ltl-panama-cost:' + kind,
      section,
      name: cost.name,
      costDetailType: cost.costDetailType,
      // Keep the evaluated amount as an explicit quote snapshot: the backend\n      // fixed-cost synchronizer otherwise removes/recreates foreign-POE costs.\n      costType: 'Variable',
      chargeBasis: 'PerShipment',
      costId: cost.id,
      contextLabel: 'LTL propio · CFZ → San José · Costos y recargos',
      notes: cost.notes?.trim() || 'Importe calculado con las reglas vigentes del catálogo.',
      serviceIds: cost.services?.map((service) => service.id) ?? [],
      currencyId: cost.currencyId,
      currencyName: cost.currencyName,
      currencyCode: cost.currencyCode,
      amountCurrencyCode: cost.currencyCode,
      costAmount: amount.costAmount,
      saleAmount: amount.saleAmount,
      included: true,
      optional: false,
      manual: false,
      applyDestinationTax: false,
      destinationTaxRate: 0,
    }
    enforceLineCurrency(line)
    rateLines.value.push(line)
  }
}
`
  // A catalog-driven LTL route uses only the four Costos y recargos rows.
  // Do not manufacture default DUA/DUCA/Stuffing lines from the old CBM matrix.
  code = replaceOnce(code,
    '  const chargeItems = [...configuredCharges, ...requiredExtras]',
    "  const chargeItems = String(tariff.id) === 'ltl-catalog:cfz-san-jose' ? [] : [...configuredCharges, ...requiredExtras]",
  )

  const syncStart = code.indexOf('function syncResolvedLandLtlTariffLines() {')
  const syncEnd = code.indexOf('\n}\n', syncStart)
  if (syncEnd < 0) throw new Error('[pricingOwnLtlPanamaCosts] LTL sync closing brace missing.')
  code = code.slice(0, syncStart) + helper + '\n' + code.slice(syncStart, syncEnd)
    + '\n  applyOwnLtlPanamaCosts()' + code.slice(syncEnd)

  return code.replace('</script>', MARKER + '\n</script>')
}

export function pricingOwnLtlPanamaCosts(): Plugin {
  return {
    name: 'dhole-own-ltl-cfz-san-jose-costs',
    transform(source, id) {
      if (id.includes('?') || !id.replace(/\\/g, '/').endsWith(WIZARD)) return null
      return { code: patchPricingOwnLtlPanamaCosts(source), map: null }
    },
  }
}
