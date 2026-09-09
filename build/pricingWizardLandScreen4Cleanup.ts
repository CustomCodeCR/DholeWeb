import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function guardButtonsForLand(source: string, handler: 'toggleMerchantHaulage' | 'toggleCarrierHaulage') {
  const pattern = new RegExp(`<button\\s+([^>]*@click="${handler}"[^>]*)>`, 'g')
  return source.replace(pattern, (opening) => {
    if (opening.includes(`form.modality !== 'Land'`)) return opening
    const vif = opening.match(/v-if="([^"]*)"/)
    if (vif) {
      return opening.replace(vif[0], `v-if="form.modality !== 'Land' && (${vif[1]})"`)
    }
    return opening.replace('<button ', `<button v-if="form.modality !== 'Land'" `)
  })
}

function guardCardBeforeText(source: string, text: string) {
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
    if (!opening.includes(`form.modality !== 'Land'`)) {
      const vif = opening.match(/v-if="([^"]*)"/)
      if (vif) {
        const replacement = opening.replace(vif[0], `v-if="form.modality !== 'Land' && (${vif[1]})"`)
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

  // Terrestre no usa Merchant/Naviera en ninguna etapa del wizard.
  code = guardButtonsForLand(code, 'toggleMerchantHaulage')
  code = guardButtonsForLand(code, 'toggleCarrierHaulage')

  // Anticipado/Redestino es muellaje marítimo; ocultar tanto flujo Pricing como Ventas.
  code = guardCardBeforeText(code, 'Muellaje en destino')

  // Al cambiar de marítimo a terrestre, limpiar estados antiguos del borrador para evitar
  // que cargos marítimos queden seleccionados aunque sus botones ya no sean visibles.
  const watchAnchor = `watch(\n  () => [form.dangerousCargo, form.overweight, form.merchantHaulage, form.carrierHaulage, form.portHandlingMode] as const,`
  if (code.includes(watchAnchor) && !code.includes('dholeLandMaritimeStateCleanup')) {
    code = code.replace(
      watchAnchor,
      `const dholeLandMaritimeStateCleanup = watch(\n  () => form.modality,\n  (modality) => {\n    if (modality !== 'Land') return\n    form.merchantHaulage = false\n    form.carrierHaulage = false\n    form.portHandlingMode = ''\n    sellerPortHandlingMode.value = ''\n    syncHaulageOptionalLines()\n  },\n  { immediate: true },\n)\n\n${watchAnchor}`,
    )
  }

  return code
}

export function pricingWizardLandScreen4Cleanup(): Plugin {
  return {
    name: 'dhole-pricing-wizard-land-screen4-cleanup',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
