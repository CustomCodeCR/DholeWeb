import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

const legacyEquipmentAnchor = `            <!-- Fila 3: tamaño, tipo y cantidad del equipo. -->`
const lclAdjustedEquipmentAnchor = `            <!-- Fila 3: equipo aplica solamente a FCL/FTL/LTL. LCL se cotiza por carga/CBM. -->`

export function pricingWizardPanamaContinuationCompat(): Plugin {
  return {
    name: 'dhole-pricing-wizard-panama-continuation-compat',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null

      if (source.includes(legacyEquipmentAnchor)) return null
      if (!source.includes(lclAdjustedEquipmentAnchor)) return null

      return {
        code: source.replace(lclAdjustedEquipmentAnchor, legacyEquipmentAnchor),
        map: null,
      }
    },
  }
}
