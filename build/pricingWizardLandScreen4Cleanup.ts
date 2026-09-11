import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function guardButtonsForScreen4(source: string, handler: 'toggleMerchantHaulage' | 'toggleCarrierHaulage') {
  const pattern = new RegExp(`<button\\s+([^>]*@click="${handler}"[^>]*)>`, 'g')
  return source.replace(pattern, (opening) => {
    const guards: string[] = []
    if (!opening.includes(`form.modality !== 'Land'`)) guards.push(`form.modality !== 'Land'`)
    if (!opening.includes('!isMultimodalViaPanama(selectedDestination)')) {
      guards.push('!isMultimodalViaPanama(selectedDestination)')
    }
    if (!guards.length) return opening

    const guard = guards.join(' && ')
    const vif = opening.match(/v-if="([^"]*)"/)
    if (vif) {
      return opening.replace(vif[0], `v-if="${guard} && (${vif[1]})"`)
    }
    return opening.replace('<button ', `<button v-if="${guard}" `)
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
    const guards: string[] = []
    if (!opening.includes(`form.modality !== 'Land'`)) guards.push(`form.modality !== 'Land'`)
    if (!opening.includes('!isMultimodalViaPanama(selectedDestination)')) {
      guards.push('!isMultimodalViaPanama(selectedDestination)')
    }

    if (guards.length) {
      const vif = opening.match(/v-if="([^"]*)"/)
      if (vif) {
        const replacement = opening.replace(
          vif[0],
          `v-if="${guards.join(' && ')} && (${vif[1]})"`,
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

  // Terrestre y Multimodal Via Panamá no usan Merchant/Naviera en pantalla 4.
  code = guardButtonsForScreen4(code, 'toggleMerchantHaulage')
  code = guardButtonsForScreen4(code, 'toggleCarrierHaulage')

  // Anticipado/Redestino es muellaje marítimo y no aplica a Terrestre ni al POE sintético
  // Multimodal Via Panamá.
  code = guardCardBeforeText(code, 'Muellaje en destino')

  // Al entrar a Terrestre o seleccionar Multimodal Via Panamá, limpiar estados antiguos
  // para evitar que cargos ocultos permanezcan seleccionados en el borrador.
  const watchAnchor = `watch(\n  () => [form.dangerousCargo, form.overweight, form.merchantHaulage, form.carrierHaulage, form.portHandlingMode] as const,`
  if (code.includes(watchAnchor) && !code.includes('dholeLandMaritimeStateCleanup')) {
    code = code.replace(
      watchAnchor,
      `const dholeLandMaritimeStateCleanup = watch(\n  () => [form.modality, form.destinationId] as const,\n  ([modality]) => {\n    const hideMaritimeControls = modality === 'Land' || isMultimodalViaPanama(selectedDestination.value)\n    if (!hideMaritimeControls) return\n    form.merchantHaulage = false\n    form.carrierHaulage = false\n    form.portHandlingMode = ''\n    sellerPortHandlingMode.value = ''\n    syncHaulageOptionalLines()\n  },\n  { immediate: true },\n)\n\n${watchAnchor}`,
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
