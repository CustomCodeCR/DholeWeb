import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function guardButtonForPanama(
  source: string,
  handler: 'toggleMerchantHaulage' | 'toggleCarrierHaulage',
) {
  const pattern = new RegExp(`<button\\b([^>]*@click="${handler}"[^>]*)>`, 'g')
  return source.replace(pattern, (opening) => {
    if (opening.includes('!isMultimodalViaPanama(selectedDestination)')) return opening

    const vif = opening.match(/v-if="([^"]*)"/)
    if (vif) {
      return opening.replace(
        vif[0],
        `v-if="(${vif[1]}) && !isMultimodalViaPanama(selectedDestination)"`,
      )
    }

    return opening.replace(
      '<button',
      '<button v-if="!isMultimodalViaPanama(selectedDestination)"',
    )
  })
}

function guardConditionalCardBeforeText(source: string, text: string) {
  let code = source
  let searchFrom = 0

  while (true) {
    const textIndex = code.indexOf(text, searchFrom)
    if (textIndex < 0) break

    const cardStart = code.lastIndexOf('<div v-if="', textIndex)
    if (cardStart < 0) {
      searchFrom = textIndex + text.length
      continue
    }

    const cardEnd = code.indexOf('>', cardStart)
    if (cardEnd < 0 || cardEnd > textIndex) {
      searchFrom = textIndex + text.length
      continue
    }

    const opening = code.slice(cardStart, cardEnd + 1)
    if (!opening.includes('!isMultimodalViaPanama(selectedDestination)')) {
      const vif = opening.match(/v-if="([^"]*)"/)
      if (vif) {
        const replacement = opening.replace(
          vif[0],
          `v-if="(${vif[1]}) && !isMultimodalViaPanama(selectedDestination)"`,
        )
        code = code.slice(0, cardStart) + replacement + code.slice(cardEnd + 1)
        searchFrom = cardStart + replacement.length + text.length
        continue
      }
    }

    searchFrom = textIndex + text.length
  }

  return code
}

function patchWizard(source: string) {
  let code = source

  // Pantalla 4: Multimodal Via Panamá no usa Merchant/Naviera ni muellaje.
  code = guardButtonForPanama(code, 'toggleMerchantHaulage')
  code = guardButtonForPanama(code, 'toggleCarrierHaulage')
  code = guardConditionalCardBeforeText(code, 'Muellaje en destino')

  // El POE visible del wizard es sintético para Multimodal Via Panamá. Desde Pantalla 5
  // en adelante, costos y recargos deben usar el POE real de la tarifa importada elegida.
  const selectedRateAnchor = `const selectedImportRate = computed(() => availableRates.value.find((rate) => rate.id === form.selectedImportRateId) ?? null)`
  if (code.includes(selectedRateAnchor) && !code.includes('const effectiveCostPoeId = computed')) {
    code = code.replace(
      selectedRateAnchor,
      `${selectedRateAnchor}\nconst effectiveCostPoeId = computed(() => {\n  if (!isMultimodalViaPanama(selectedDestination.value)) return form.destinationId\n  return String(selectedImportRate.value?.poeId ?? '').trim() || form.destinationId\n})`,
    )
  }

  // En una combinación FCL multimodal, todas las líneas deben pertenecer al mismo POE
  // real para no mezclar Balboa/Colón (u otros puertos) bajo una sola alternativa.
  code = code.replace(
    /function fclRateBundleGroupKey\(rate: ImportRateSelectDto\) \{[\s\S]*?\n\}\n\nfunction compareFclCandidateRates/,
    `function fclRateBundleGroupKey(rate: ImportRateSelectDto) {\n  const agent = String(rate.agentId || normalizeCatalogValue(String(rate.agent ?? ''))).trim()\n  const currency = String(rate.currencyId || normalizeCatalogValue(String(rate.currency ?? 'USD'))).trim()\n  const poe = isMultimodalViaPanama(selectedDestination.value)\n    ? String(rate.poeId || normalizeCatalogValue(String(rate.poe ?? ''))).trim()\n    : ''\n  return poe ? [agent, currency, poe].join('|') : [agent, currency].join('|')\n}\n\nfunction compareFclCandidateRates`,
  )

  // Pantalla 5: las tarjetas FCL deben exponer el POE real y el comentario de cada tarifa.
  const fclCarrierAnchor = `<span class="mt-0.5 block text-[11px] font-black text-[var(--dh-text-muted)]">{{ line.rate.carrier || 'Naviera' }}</span>`
  if (code.includes(fclCarrierAnchor) && !code.includes('POE tarifa: {{ line.rate.poe')) {
    code = code.replace(
      fclCarrierAnchor,
      `${fclCarrierAnchor}\n                        <span class="mt-0.5 block text-[11px] font-semibold text-[var(--dh-text-muted)]">POE tarifa: <strong>{{ line.rate.poe || line.rate.pod || '—' }}</strong></span>\n                        <p v-if="line.rate.spaceComment" class="mt-2 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-surface)] px-2.5 py-2 text-[11px] font-semibold leading-relaxed text-[var(--dh-text-soft)]">Comentario: {{ line.rate.spaceComment }}</p>`,
    )
  }

  // Pantalla 7: el contexto del endpoint de costos y la validación local usan el POE
  // de la tarifa elegida cuando el destino visual es Multimodal Via Panamá.
  code = code.replace(
    `    form.destinationId,\n    form.podId,`,
    `    effectiveCostPoeId.value,\n    form.podId,`,
  )
  code = code.replace(
    `if (cost.poeId && cost.poeId !== form.destinationId) return false`,
    `if (cost.poeId && cost.poeId !== effectiveCostPoeId.value) return false`,
  )
  code = code.replace(
    `: cost.portRole === 'Poe'\n          ? cost.portId === form.destinationId`,
    `: cost.portRole === 'Poe'\n          ? cost.portId === effectiveCostPoeId.value`,
  )
  code = code.replace(
    `[form.originId, form.destinationId, form.podId].includes(cost.portId)`,
    `[form.originId, effectiveCostPoeId.value, form.podId].includes(cost.portId)`,
  )
  code = code.replace(
    `poeId: form.destinationId || undefined,`,
    `poeId: effectiveCostPoeId.value || undefined,`,
  )

  // EXW/FCA: por requerimiento comercial no se muestran Recolecta ni Cargos de origen.
  code = code.replace(
    /const visibleSections = computed<RateSection\[]>\(\(\) => \{[\s\S]*?\n\}\)\n\nconst includedLines = computed/,
    `const visibleSections = computed<RateSection[]>(() => {\n  let sections: RateSection[]\n\n  if (form.modality === 'Land' || shipmentModeForApi.value === 'Ftl' || shipmentModeForApi.value === 'Ltl') {\n    sections = [...sectionOrder]\n  } else {\n    const allowed = new Set<RateSection>(incotermResponsibilitySections.value)\n    sections = sectionOrder.filter((section) => allowed.has(section))\n  }\n\n  if (selectedIncotermCode.value === 'EXW' || selectedIncotermCode.value === 'FCA') {\n    return sections.filter((section) => section !== 'pickup_origin' && section !== 'origin_charges')\n  }\n\n  return sections\n})\n\nconst includedLines = computed`,
  )

  code = code.replace(
    `function standardSectionLines(section: RateSection) {\n  return rateLines.value.filter(`,
    `function standardSectionLines(section: RateSection) {\n  if (!visibleSections.value.includes(section)) return []\n  return rateLines.value.filter(`,
  )

  code = code.replace(
    `const selectableOptionalLines = computed(() =>\n  rateLines.value.filter((line) => line.optional),\n)`,
    `const selectableOptionalLines = computed(() =>\n  rateLines.value.filter((line) => line.optional && visibleSections.value.includes(line.section)),\n)`,
  )

  code = code.replace(
    `(line) => line.included && (line.optional || line.manual) && line.costDetailType !== 'Insurance',`,
    `(line) => line.included && visibleSections.value.includes(line.section) && (line.optional || line.manual) && line.costDetailType !== 'Insurance',`,
  )

  // Pantalla 8 ALL IN: CatalogItem.Code es técnico; el usuario debe ver Config.Value.
  code = code.replace(
    `{{ formatMoney(number(line.saleAmount) * quantityForChargeBasis(line.chargeBasis), line.currencyCode || line.currencyName || 'USD') }}`,
    `{{ formatMoney(number(line.saleAmount) * quantityForChargeBasis(line.chargeBasis), displayValue(findById(catalogs.currencies, line.currencyId)) || line.currencyName || 'USD') }}`,
  )

  // Al entrar/cambiar a Multimodal Via Panamá, limpiar selecciones marítimas que ya no aplican.
  const cleanupAnchor = `watch(\n  () => selectedIncotermCode.value,`
  if (code.includes(cleanupAnchor) && !code.includes('dholeMultimodalPanamaScreen4Cleanup')) {
    code = code.replace(
      cleanupAnchor,
      `const dholeMultimodalPanamaScreen4Cleanup = watch(\n  () => isMultimodalViaPanama(selectedDestination.value),\n  (active) => {\n    if (!active) return\n    form.merchantHaulage = false\n    form.carrierHaulage = false\n    form.portHandlingMode = ''\n    syncHaulageOptionalLines()\n  },\n  { immediate: true },\n)\n\n${cleanupAnchor}`,
    )
  }

  return code
}

export function pricingWizardPanamaContextFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-panama-context-fix',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
