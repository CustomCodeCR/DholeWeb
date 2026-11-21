import type { Plugin } from 'vite'

const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-pricing-p7-ltl-lcl-multimodal-final-391'

const MIAMI_EXTRA394 = String.raw`
// DH-394: Miami own LCL commercial items come from the selected A/B/C/D,
// NVOCC or LITTLE plan, not generic /wizard-bundle catalog applicability.
// Only fill omissions: provider-quoted rows (and existing revisions) win.
function p7SyncMiamiCommercialItems394() {
  if (props.viewOnly || props.rateId || hydratingExistingRate.value
      || step.value !== 7 || !isMiamiLcl.value
      || lclSelectedSource.value?.kind !== 'Own') return
  const plan = miamiCommercialRate.value
  const currency = selectedCurrency.value ?? catalogs.currencies.find(
    c => normalizeCatalogValue(displayValue(c)) === 'usd')
  if (!currency) return
  const sedQty = Math.max(1, Math.trunc(number(form.miamiSedQty)))
  const rows = [
    { name: 'SED', sale: form.miamiIncludeSed ? plan.sed * sedQty : 0 },
    { name: 'Manejos', sale: plan.handling },
    { name: 'VGM', sale: plan.vgm },
    { name: 'TICA', sale: plan.tica },
    { name: 'Marchamo', sale: plan.seal },
    { name: 'Documentación', sale: plan.documentation },
    { name: 'Forwarding', sale: plan.forwarding },
    { name: 'Seguro de carga', sale: number(form.cargoValue) > 0
      ? miamiInsuranceSale.value : 0 },
  ]
  for (const item of rows) {
    const key = 'p7-394-miami:' + normalizeCatalogValue(item.name)
    const existing = rateLines.value.find(line =>
      line.key === key ||
      normalizeCatalogValue(line.name) === normalizeCatalogValue(item.name) ||
      (item.name === 'Documentación' && normalizeCatalogValue(line.name) === 'documentacion') ||
      (item.name === 'Seguro de carga'
        && (line.costDetailType === 'Insurance' || /seguro|insurance/i.test(line.name))))
    if (existing) {
      if (existing.key === key && !existing.detailId && !existing.manual) {
        existing.saleAmount = item.sale
        existing.included = item.sale > 0
      }
      continue
    }
    if (item.sale <= 0) continue
    const line: RateLine = {
      key,
      section: 'destination_charges',
      name: item.name,
      costDetailType: item.name === 'Seguro de carga' ? 'Insurance' : 'DestinationCharge',
      costType: 'Fixed', chargeBasis: 'PerShipment', costId: null,
      contextLabel: 'Cargo comercial del consolidado propio Miami',
      notes: 'LCL PROPIO · Plan Miami: ' + String(form.miamiCommercialPlan || 'A'),
      serviceIds: [...form.serviceIds],
      currencyId: currency.id, currencyName: displayValue(currency),
      currencyCode: currency.code, amountCurrencyCode: currency.code,
      costAmount: 0, saleAmount: item.sale, included: true,
      optional: false, manual: false,
      applyDestinationTax: false, destinationTaxRate: 0,
    }
    enforceLineCurrency(line)
    rateLines.value = [...rateLines.value, line]
  }
}
`

export function patchPricingP7Reconcile391(source: string): string {
  if (source.includes(MARKER)) return source
  for (const anchor of ['function rebuildRateLines()', 'function quoteEditApplyDelta387()',
    'function syncPanamaOverweightLines()', 'function syncOwnLclCrcAgencyLine(']) {
    if (!source.includes(anchor)) throw new Error('[DH-391] Missing final wizard: ' + anchor)
  }
  const importAnchor = '<script setup lang="ts">'
  const imports = [
    "import { isPanamaCostaRicaRoute391, selectPanamaLtlCharges391,",
    "  selectMultimodalLandFreight391, freightModeTitle391 }",
    "  from '@/modules/pricing/utils/pricingP7Context391'",
  ].join('\n')
  if (source.split(importAnchor).length !== 2) throw new Error('[DH-391] Script anchor')
  let code = source.replace(importAnchor, importAnchor + '\n' + imports + '\n')
  const runtime = "\n// DH-391 final P7 reconciliation. Preserve persisted RateDetails unless a\n// source/service/route/weight change was explicitly made by the operator.\nfunction p7Route391() {\n  return {\n    originIds: [...new Set([costContextPoeId(), form.originId, form.destinationId]\n      .filter((x): x is string => Boolean(x)))],\n    destinationIds: [...new Set([form.podId, form.destinationId]\n      .filter((x): x is string => Boolean(x)))],\n    originNames: [selectedOrigin.value, selectedDestination.value]\n      .filter(Boolean).map(item => displayValue(item)),\n    destinationNames: [selectedPod.value, selectedDestination.value]\n      .filter(Boolean).map(item => displayValue(item)),\n    incotermId: form.incotermId || null,\n    agentId: costContextAgentId() || null,\n    serviceIds: form.serviceIds,\n    weightKg: number(form.cargoWeightKg),\n  }\n}\nfunction p7IsPanamaCorridor391() {\n  const origin = [\n    selectedOrigin.value && displayValue(selectedOrigin.value),\n    selectedDestination.value && displayValue(selectedDestination.value),\n  ].filter(Boolean).join(' · ')\n  const destination = [\n    selectedPod.value && displayValue(selectedPod.value),\n    selectedDestination.value && displayValue(selectedDestination.value),\n  ].filter(Boolean).join(' · ')\n  return isPanamaCostaRicaRoute391(origin, destination)\n}\nfunction p7ChangedQuote391() {\n  if (!props.rateId) return true\n  if (!quoteEditOriginalContext387.value) return false\n  const changed = quoteEditChangedKeys387()\n  return ['modality', 'shipmentMode', 'originId', 'destinationId', 'podId',\n    'agentId', 'carrierId', 'services', 'overweight', 'cargoWeightKg']\n    .some(field => changed.has(field))\n}\nfunction p7FreightTitle391(line: { name?: string | null; costDetailType?: string | null }) {\n  return freightModeTitle391(String(line.name ?? ''), line.costDetailType, String(form.modality))\n}\nfunction p7PresentOrReconcile391() {\n  if (props.viewOnly || hydratingExistingRate.value || step.value !== 7) return\n  const canAppend = p7ChangedQuote391()\n  const route = p7Route391()\n\n  // The ocean and Panama/CR land legs are distinct Freight rows and CostIds.\n  if (form.modality === 'Multimodal' && shipmentModeForApi.value === 'Fcl'\n      && hasInternationalTransportService.value && canAppend) {\n    // Pricing's applicable list is ALREADY route/agent/service validated.
    // Prefer that concrete cost (e.g. Balboa -> San José USD 2140) over
    // reinterpreting commercial POE/agent context on the client.
    const master = costs.value.find(cost =>
      cost.costDetailType === 'Freight'
      && /flete.*terrestre|terrestre.*flete|land freight/i.test(normalizeCatalogValue(cost.name))
      && number(cost.costAmount) > 0)
      ?? selectMultimodalLandFreight391(allCosts.value, route)\n    if (master && (!props.rateId || costs.value.some(c => c.id === master.id))) {\n      const previous = rateLines.value.find(line => line.costId === master.id\n        || (line.costDetailType === 'Freight'\n          && /terrestre|land freight/.test(normalizeCatalogValue(line.name))\n          && !line.manual))\n      if (!previous && !dismissedAutomaticOptionalCostIds.value.has(master.id)) {\n        const price = resolvedConditionalCost(master)\n        if (price) {\n          const line: RateLine = {\n            key: 'p7-391-multimodal-land:' + master.id,\n            section: 'international_freight',\n            name: 'Flete internacional terrestre',\n            costDetailType: 'Freight', costType: master.costType,\n            chargeBasis: master.chargeBasis ?? 'PerContainer',\n            costId: master.id,\n            contextLabel: 'Tramo terrestre internacional independiente del marítimo',\n            notes: master.notes ?? null,\n            serviceIds: master.services?.map(s => s.id) ?? [],\n            currencyId: master.currencyId, currencyName: master.currencyName,\n            currencyCode: master.currencyCode, amountCurrencyCode: master.currencyCode,\n            costAmount: price.costAmount, saleAmount: price.saleAmount,\n            included: true, optional: false, manual: false,\n            applyDestinationTax: false, destinationTaxRate: 0,\n          }\n          enforceLineCurrency(line)\n          rateLines.value = [...rateLines.value, line]\n        }\n      }\n    }\n    // Existing backend rule (Panama POE -> GAM POD): USD 2,140 per FCL\n    // container. Create a quoted snapshot only if no matching catalog\n    // freight was provided, without inventing a master CostId or modifying\n    // the maritime freight line.\n    if (!master && p7IsPanamaCorridor391()\n        && /san jose|san josé|gam|alajuela|heredia|cartago|coyol/i.test(\n          selectedPod.value ? displayValue(selectedPod.value) : '')\n        && !rateLines.value.some(line =>\n          /flete.*terrestre|terrestre.*flete|land freight/i.test(line.name)\n          && line.included && !line.manual)) {\n      const usd = catalogs.currencies.find(item =>\n        String(item.value ?? item.code ?? '').toUpperCase() === 'USD')\n      if (usd) {\n        const line: RateLine = {\n          key: 'p7-393-panama-gam-fcl-land',\n          section: 'international_freight', name: 'Flete internacional terrestre',\n          costDetailType: 'Freight', costType: 'Fixed', chargeBasis: 'PerContainer',\n          costId: null,\n          contextLabel: 'Tramo terrestre internacional Panamá → GAM · regla USD 2140',\n          notes: 'Referencia: regla interna Panamá POE → GAM POD, USD 2140 por contenedor.',\n          serviceIds: [...form.serviceIds],\n          currencyId: usd.id, currencyName: displayValue(usd),\n          currencyCode: usd.code, amountCurrencyCode: usd.code,\n          costAmount: 2140, saleAmount: 2140,\n          included: true, optional: false, manual: false,\n          applyDestinationTax: false, destinationTaxRate: 0,\n        }\n        enforceLineCurrency(line)\n        rateLines.value = [...rateLines.value, line]\n      }\n    }\n  }\n\n  // All four WeightKg LTL Panama charges (including a legitimate 0/0\n  // Gastos tier) are selected from their exact POE/POD + service masters.\n  if (shipmentModeForApi.value === 'Ltl' && p7IsPanamaCorridor391()\n      && hasInternationalTransportService.value && canAppend) {\n    const selected = selectPanamaLtlCharges391(allCosts.value, route)\n    if (selected.size > 0) {\n      const incoming: RateLine[] = []\n      for (const [kind, { cost, costAmount, saleAmount }] of selected) {\n        if (dismissedAutomaticOptionalCostIds.value.has(cost.id)) continue\n        const existing = rateLines.value.find(line => line.costId === cost.id\n          || line.key === 'p7-391-ltl:' + kind\n          || line.key === 'ltl-panama-cost:' + kind)\n        if (existing) {\n          // A newly derived automatic row must reflect its matched weight band\n          // even when P7's catalog loader inserted the row first with base 0.\n          // Persisted and manually entered snapshots are never repriced.\n          if (!existing.detailId && !existing.manual) {\n            existing.costAmount = costAmount\n            existing.saleAmount = saleAmount\n            existing.chargeBasis = 'PerShipment'\n            existing.costId = cost.id\n            existing.included = true\n            existing.optional = false\n            if (kind === 'freight') {\n              existing.name = 'Flete internacional terrestre'\n              existing.section = 'international_freight'\n            }\n            enforceLineCurrency(existing)\n          }\n          continue\n        }\n        const genericFreight = kind === 'freight'\n          ? rateLines.value.find(line => line.costDetailType === 'Freight'\n              && !line.costId && !line.detailId && !line.manual)\n          : null\n        if (genericFreight) {\n          genericFreight.name = 'Flete internacional terrestre'\n          genericFreight.section = 'international_freight'\n          genericFreight.costId = cost.id\n          genericFreight.chargeBasis = 'PerShipment'\n          genericFreight.costAmount = costAmount\n          genericFreight.saleAmount = saleAmount\n          genericFreight.included = true\n          genericFreight.optional = false\n          genericFreight.currencyId = cost.currencyId\n          genericFreight.currencyName = cost.currencyName\n          genericFreight.currencyCode = cost.currencyCode\n          genericFreight.amountCurrencyCode = cost.currencyCode\n          enforceLineCurrency(genericFreight)\n          continue\n        }\n        const freight = kind === 'freight'\n        const line: RateLine = {\n          key: 'p7-391-ltl:' + kind,\n          section: freight ? 'international_freight' : 'destination_charges',\n          name: freight ? 'Flete internacional terrestre' : cost.name,\n          costDetailType: freight ? 'Freight' : cost.costDetailType,\n          costType: 'Variable', chargeBasis: 'PerShipment', costId: cost.id,\n          contextLabel: 'LTL Panamá → Costa Rica · tramo por peso',\n          notes: cost.notes ?? null,\n          serviceIds: cost.services?.map(s => s.id) ?? [],\n          currencyId: cost.currencyId, currencyName: cost.currencyName,\n          currencyCode: cost.currencyCode, amountCurrencyCode: cost.currencyCode,\n          costAmount, saleAmount, included: true, optional: false, manual: false,\n          applyDestinationTax: false, destinationTaxRate: 0,\n        }\n        enforceLineCurrency(line)\n        incoming.push(line)\n      }\n      if (incoming.length) rateLines.value = [...rateLines.value, ...incoming]\n    }\n  }\n\n  // Rename only new, generated freight. Persisted original values/IDs remain.\n  if (canAppend) {\n    for (const line of rateLines.value) {\n      if (line.costDetailType === 'Freight' && !line.detailId && !line.manual) {\n        const name = p7FreightTitle391(line)\n        if (name !== line.name) line.name = name\n      }\n    }\n  }\n}\nwatch(() => [\n  step.value, hydratingExistingRate.value, form.modality,\n  shipmentModeForApi.value, form.originId, form.destinationId, form.podId,\n  form.agentId, form.incotermId, form.cargoWeightKg, form.overweight,\n  form.serviceIds.join('|'), allCosts.value.map(c => c.id).join('|'),\n  costs.value.map(c => c.id).join('|'),\n  rateLines.value.map(line => line.key + ':' + (line.costId ?? '')).join('|'),\n] as const, () => p7PresentOrReconcile391(), { flush: 'post' })\n"
  if (code.split('</script>').length !== 2) throw new Error('[DH-391] Script close')
  const runtime394 = runtime.replace(
    '  // Rename only new, generated freight.',
    '  p7SyncMiamiCommercialItems394()\n\n  // Rename only new, generated freight.',
  ).replace(
    "  form.serviceIds.join('|'), allCosts.value.map",
    "  form.serviceIds.join('|'), form.miamiCommercialPlan, form.miamiIncludeSed, form.miamiSedQty, form.cargoValue, allCosts.value.map",
  )
  code = code.replace('</script>', runtime394 + '\n' + MIAMI_EXTRA394 + '\n' + MARKER + '\n</script>')
  code = code.replaceAll('{{ line.name }}', '{{ p7FreightTitle391(line) }}')
  const oldName = "name: form.modality === 'Air' && line.costDetailType === 'Freight' ? 'Flete Internacional' : line.name,"
  if (code.includes(oldName))
    code = code.replace(oldName,
      "name: line.costDetailType === 'Freight' ? p7FreightTitle391(line) : line.name,")
  return code
}

export function pricingP7Reconcile391(): Plugin {
  return {
    name: 'dhole-pricing-p7-contextual-cost-reconcile-391',
    transform(source, id) {
      if (id.includes('?') || !id.replace(/\\/g, '/').endsWith(WIZARD)) return null
      return { code: patchPricingP7Reconcile391(source), map: null }
    },
  }
}
