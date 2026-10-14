import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

/**
 * Sales requests only describe the shipment. Pricing decides how to quote it.
 * Keep the commercial-type selector available in the normal Pricing wizard.
 *
 * Apply after the existing Pricing UI transformations, which intentionally
 * rewrite the Step 3 description and build the seller priority card.
 */
function patchWizard(source: string): string {
  const start = source.indexOf('<div v-else-if="step === 3"')
  const end = source.indexOf('<div v-else-if="step === 4"', start)
  if (start < 0 || end <= start) {
    throw new Error('[pricingSellerRequestHideRateType] Cannot locate Step 3 boundaries.')
  }

  let step3 = source.slice(start, end)

  // Preserve the existing descriptions for regular Pricing, but use neutral
  // language in the seller-request flow.
  const description = /<p class="crystal-description">([\s\S]*?)<\/p>/
  const match = description.exec(step3)
  if (!match || !match[1]?.includes('SPOT') || !match[1]?.includes('TARIFARIO')) {
    throw new Error('[pricingSellerRequestHideRateType] Cannot locate commercial-type description.')
  }
  // Other transforms may leave plain text or an interpolation here.
  // Preserve either variant verbatim instead of parsing its expression.
  const original = match[1].trim()
  step3 = step3.replace(
    description,
    `<p v-if="sellerRequestMode" class="crystal-description">Complete la ruta y los datos del embarque para solicitar la tarifa a Pricing.</p>
            <p v-else class="crystal-description">${original}</p>`,
  )

  const spotLabel = '<p class="text-base font-black">SPOT</p>'
  const spotIndex = step3.indexOf(spotLabel)
  const selector = '<div class="grid gap-3 md:grid-cols-2">'
  const selectorIndex = spotIndex >= 0 ? step3.lastIndexOf(selector, spotIndex) : -1
  if (selectorIndex < 0) {
    throw new Error('[pricingSellerRequestHideRateType] Cannot locate SPOT / TARIFARIO cards.')
  }
  step3 = step3.slice(0, selectorIndex)
    + step3.slice(selectorIndex).replace(selector, '<div v-if="!sellerRequestMode" class="grid gap-3 md:grid-cols-2">')

  const tariffHint = 'v-if="form.rateType === \'Tariff\'"'
  if (!step3.includes(tariffHint)) {
    throw new Error('[pricingSellerRequestHideRateType] Cannot locate master tariff notice.')
  }
  step3 = step3.replace(tariffHint, 'v-if="!sellerRequestMode && form.rateType === \'Tariff\'"')

  // La descripción de prioridad puede cambiar sin afectar al flujo de solicitud.
  // Solo se reemplaza el texto legado cuando todavía exista.
  const legacySellerPriorityText = 'Esta prioridad es independiente de si la solicitud será SPOT o TARIFARIO.'
  if (step3.includes(legacySellerPriorityText)) {
    step3 = step3.replace(
      legacySellerPriorityText,
      'El plazo máximo de atención depende de la prioridad seleccionada.',
    )
  }

  return source.slice(0, start) + step3 + source.slice(end)
}

export function pricingSellerRequestHideRateType(): Plugin {
  return {
    name: 'dhole-pricing-seller-request-hide-rate-type',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
