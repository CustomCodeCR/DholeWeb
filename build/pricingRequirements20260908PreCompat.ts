import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

export function pricingRequirements20260908PreCompat(): Plugin {
  return {
    name: 'dhole-pricing-requirements-20260908-pre-compat',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null

      const shipmentAnchor = `              <span class="block text-lg font-black">{{ option.label }}</span>\n              <Check v-if="form.shipmentMode === option.value"`
      if (!source.includes(shipmentAnchor)) {
        throw new Error('[pricingRequirements20260908PreCompat] Shipment mode label anchor was not found after the September UI transformations.')
      }

      let code = source.replace(
        shipmentAnchor,
        `              <span class="text-lg font-black">{{ option.label }}</span>\n              <Check v-if="form.shipmentMode === option.value"`,
      )

      const sellerRequestPrefix = `async function saveOpenRequest() {\n  if (props.sellerRequestMode && sellerExecutiveLabel.value) {\n    form.executiveId = ''\n    form.executiveName = sellerExecutiveLabel.value\n  }\n\n  if (props.sellerRequestMode) {\n    // Ventas no define el proveedor del inland ni la vigencia comercial.\n    form.merchantHaulage = false\n    form.carrierHaulage = false\n    form.validTo = ''\n  }\n\n  const origin = selectedOrigin.value`
      if (!code.includes(sellerRequestPrefix)) {
        throw new Error('[pricingRequirements20260908PreCompat] Seller request prefix was not found after the ownership/responsibility transformations.')
      }

      code = code.replace(
        sellerRequestPrefix,
        `async function saveOpenRequest() {\n  const origin = selectedOrigin.value\n\n  if (props.sellerRequestMode && sellerExecutiveLabel.value) {\n    form.executiveId = ''\n    form.executiveName = sellerExecutiveLabel.value\n  }\n\n  if (props.sellerRequestMode) {\n    // Ventas no define el proveedor del inland ni la vigencia comercial.\n    form.merchantHaulage = false\n    form.carrierHaulage = false\n    form.validTo = ''\n  }`,
      )

      return { code, map: null }
    },
  }
}
