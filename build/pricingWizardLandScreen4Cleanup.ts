import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const SCREEN4_MARITIME_GUARD = "form.modality !== 'Land' && !isMultimodalViaPanama(selectedDestination)"

function guardButtonsForScreen4(source: string, handler: 'toggleMerchantHaulage' | 'toggleCarrierHaulage') {
  const pattern = new RegExp(`<button\\s+([^>]*@click="${handler}"[^>]*)>`, 'g')
  return source.replace(pattern, (opening) => {
    if (opening.includes(SCREEN4_MARITIME_GUARD)) return opening

    const vif = opening.match(/v-if="([^"]*)"/)
    if (vif) {
      return opening.replace(vif[0], `v-if="${SCREEN4_MARITIME_GUARD} && (${vif[1]})"`)
    }
    return opening.replace('<button ', `<button v-if="${SCREEN4_MARITIME_GUARD}" `)
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
    if (opening.includes(SCREEN4_MARITIME_GUARD)) {
      searchFrom = textIndex + text.length
      continue
    }

    const vif = opening.match(/v-if="([^"]*)"/)
    if (vif) {
      const replacement = opening.replace(
        vif[0],
        `v-if="${SCREEN4_MARITIME_GUARD} && (${vif[1]})"`,
      )
      code = code.slice(0, cardStart) + replacement + code.slice(cardEnd + 1)
      searchFrom = cardStart + replacement.length + text.length
      continue
    }

    searchFrom = textIndex + text.length
  }

  return code
}

function patchWizard(source: string) {
  let code = source

  // Merchant, Naviera y Muellaje no aplican cuando el POE visible es
  // "Multimodal Via Panamá". El contexto real de cargos se resuelve aparte con
  // el POE real de la tarifa importada seleccionada.
  code = guardButtonsForScreen4(code, 'toggleMerchantHaulage')
  code = guardButtonsForScreen4(code, 'toggleCarrierHaulage')
  code = guardCardBeforeText(code, 'Muellaje en destino')

  // Limpiar también el estado interno; ocultar los botones no es suficiente porque
  // esos flags pueden reactivar opcionales al entrar a Pantalla 7.
  const watchAnchor = `watch(
  () => [form.dangerousCargo, form.overweight, form.merchantHaulage, form.carrierHaulage, form.portHandlingMode] as const,`
  if (code.includes(watchAnchor) && !code.includes('dholeLandMaritimeStateCleanup')) {
    code = code.replace(
      watchAnchor,
      `const dholeLandMaritimeStateCleanup = watch(
  () => [form.modality, form.destinationId] as const,
  ([modality]) => {
    const multimodalViaPanama = isMultimodalViaPanama(selectedDestination.value)
    if (modality !== 'Land' && !multimodalViaPanama) return

    form.merchantHaulage = false
    form.carrierHaulage = false
    form.portHandlingMode = ''
    sellerPortHandlingMode.value = ''
    syncHaulageOptionalLines()
  },
  { immediate: true },
)

${watchAnchor}`,
    )
  }

  return code
}

export function pricingWizardLandScreen4Cleanup(): Plugin {
  return {
    name: 'dhole-pricing-wizard-land-screen4-cleanup',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
