import type { Plugin } from 'vite'

// This transform runs AFTER FCL weight and own-LTL catalog transforms.
// For FCL Panama excess, the four LTL weight-tier masters live in the same
// wizard-bundle CATALOG; its applicable collection is filtered to FCL.
// The LTL resolver further restricts masters to the CFZ/San José corridor.
const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-fcl-panama-excess-lcl-20261116'
const ADDITIONAL_SCRIPT = "\n// FCL multimodal Panamá -> Costa Rica: 19,000 kg allowed per physical container.\n// Calculate the LCL-land supplement ONLY for the excess, using four master costs.\nfunction isPanamaOverweightRoute(): boolean {\n  return shipmentModeForApi.value === 'Fcl'\n    && (form.modality === 'Maritime' || form.modality === 'Multimodal')\n    && Boolean(multimodalAllInPresentation.value)\n}\n\nconst panamaOverweightQuote = computed(() => pricePanamaMultimodalOverweight(\n  fclContainerAllocations.value.flatMap((row) =>\n    fclUnitWeightsFor(row.containerTypeId, row.quantity)),\n  allCosts.value,\n  { incotermId: form.incotermId, serviceIds: form.serviceIds },\n))\n\nfunction syncPanamaOverweightLines() {\n  if (props.viewOnly || hydratingExistingRate.value) return\n  const old = rateLines.value\n  const panama = isPanamaOverweightRoute()\n  const quote = panamaOverweightQuote.value\n  const selectedIds = new Set(quote.charges.map((entry) => entry.cost.id))\n\n  const other = old.filter((line) => {\n    if (line.key.startsWith('panama-overweight:')) return false\n    if (!panama) return true\n    // Generic 3-axle/overweight fees must not be added to this LCL excess.\n    if (!line.manual && (line.key === 'cargo-condition:overweight'\n      || /sobrepeso|overweight/.test(normalizeCatalogValue(line.name)))) return false\n    if (!line.manual && line.costId && selectedIds.has(line.costId)) return false\n    return true\n  })\n\n  const supplement: RateLine[] = panama && quote.excessKg > 0 && !quote.missing.length\n    ? quote.charges.map(({ kind, cost, costAmount, saleAmount }) => {\n      const line: RateLine = {\n        key: 'panama-overweight:' + kind,\n        section: 'destination_charges',\n        name: 'Excedente Panamá · ' + cost.name,\n        // This is additional inland freight, not a second ocean freight.\n        costDetailType: cost.costDetailType === 'Freight' ? 'InlandTransport' : cost.costDetailType,\n        costType: 'Variable',\n        chargeBasis: 'PerShipment',\n        costId: cost.id,\n        contextLabel: 'FCL multimodal · LCL Panamá → Costa Rica · ' + quote.excessKg + ' kg excedentes',\n        notes: 'Sobrepeso sobre 19.000 kg por contenedor; costo maestro calculado únicamente por '\n          + quote.excessKg + ' kg excedentes. ' + String(cost.notes ?? ''),\n        serviceIds: cost.services?.map((service) => service.id) ?? [],\n        currencyId: cost.currencyId,\n        currencyName: cost.currencyName,\n        currencyCode: cost.currencyCode,\n        amountCurrencyCode: cost.currencyCode,\n        costAmount,\n        saleAmount,\n        included: true,\n        optional: false,\n        manual: false,\n        applyDestinationTax: false,\n        destinationTaxRate: 0,\n      }\n      enforceLineCurrency(line)\n      return line\n    })\n    : []\n\n  const next = [...other, ...supplement]\n  // Idempotency: updating an unrelated line must not cause a watch loop.\n  const unchanged = old.length === next.length && old.every((line, index) => {\n    const replacement = next[index]\n    return line === replacement || (replacement !== undefined\n      && line.key === replacement.key\n      && line.costId === replacement.costId\n      && line.costAmount === replacement.costAmount\n      && line.saleAmount === replacement.saleAmount\n      && line.included === replacement.included\n      && line.currencyCode === replacement.currencyCode)\n  })\n  if (!unchanged) rateLines.value = next\n}\n\nwatch(\n  () => [\n    isPanamaOverweightRoute(),\n    panamaOverweightQuote.value,\n    rateLines.value.map((line) =>\n      [line.key, line.costId ?? '', line.costAmount, line.saleAmount, line.included].join(':')).join('|'),\n    props.viewOnly,\n    hydratingExistingRate.value,\n  ] as const,\n  () => syncPanamaOverweightLines(),\n  { flush: 'post' },\n)\n"

function replaceRequired(source: string, before: string, after: string, label: string): string {
  if (!source.includes(before)) throw new Error('[pricingPanamaFclOverweight] Missing ' + label)
  return source.replace(before, after)
}

export function patchPricingPanamaFclOverweight(source: string): string {
  if (source.includes(MARKER)) return source
  let code = source
  code = replaceRequired(
    code,
    '<script setup lang="ts">',
    '<script setup lang="ts">\nimport { pricePanamaMultimodalOverweight } from "@/modules/pricing/utils/panamaMultimodalOverweight"',
    'wizard script',
  )
  // Preserve 21,500 kg on non-Panama routes; 19,000 kg only on multimodal Panama.
  code = replaceRequired(
    code,
    'function fclUnitIsOverweight(kg: number) {\n  return fclRegionalOverweight.value && Number(kg) > 21500\n}',
    'function fclUnitIsOverweight(kg: number) {\n  return isPanamaOverweightRoute() ? Number(kg) > 19000\n    : fclRegionalOverweight.value && Number(kg) > 21500\n}',
    'individual FCL limit',
  )
  code = replaceRequired(
    code,
    'async function saveRate() {',
    'async function saveRate() {\n'
      + '  if (isPanamaOverweightRoute() && panamaOverweightQuote.value.excessKg > 0) {\n'
      + '    const quote = panamaOverweightQuote.value\n'
      + '    if (quote.missing.length || quote.charges.length !== 4) {\n'
      + '      step.value = 7\n'
      + '      toastStore.warning("Sobrepeso Panamá sin tarifa completa",\n'
      + '        "Configure los cuatro costos Panamá → Costa Rica por el peso excedente: " + quote.missing.join(", "))\n'
      + '      return\n'
      + '    }\n'
      + '    syncPanamaOverweightLines()\n'
      + '    if (rateLines.value.filter((line) => line.key.startsWith("panama-overweight:")).length !== 4) {\n'
      + '      step.value = 7\n'
      + '      toastStore.warning("Sobrepeso Panamá pendiente", "Revise el desglose de los cuatro costos antes de guardar.")\n'
      + '      return\n'
      + '    }\n'
      + '  }\n',
    'saveRate validation',
  )

  // Late wizard transforms may have already replaced the markup for the FCL flag.
  // Its reactive form.overweight state is authoritative; label enrichment is optional.
  code = code.replace(
    '<Check v-if="form.overweight" class="h-4 w-4" /> Sobrepeso',
    '<Check v-if="form.overweight" class="h-4 w-4" /> {{ isPanamaOverweightRoute() ? "Sobrepeso Panamá · " + panamaOverweightQuote.excessKg.toLocaleString("es-CR") + " kg excedentes" : "Sobrepeso" }}',
  )

  const end = code.lastIndexOf('</script>')
  if (end < 0) throw new Error('[pricingPanamaFclOverweight] Script end missing')
  return code.slice(0, end) + '\n' + ADDITIONAL_SCRIPT + '\n' + MARKER + '\n' + code.slice(end)
}

export function pricingPanamaFclOverweight(): Plugin {
  return {
    name: 'dhole-fcl-panama-overweight-lcl',
    transform(source, id) {
      if (id.includes('?') || !id.replace(/\\/g, '/').endsWith(WIZARD)) return null
      return { code: patchPricingPanamaFclOverweight(source), map: null }
    },
  }
}
