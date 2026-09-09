import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  let code = source

  // Pantalla 2 debe conservar exactamente la misma composición visual para marítimo
  // y terrestre. Ambos flujos tienen dos alternativas principales, por lo que usar
  // tres columnas en marítimo hacía que FCL/LCL se vieran más pequeños que FTL/LTL.
  code = code.replace(
    `<div class="grid gap-4" :class="form.modality === 'Land' ? 'md:grid-cols-2' : 'md:grid-cols-3'">\n            <button\n              v-for="option in shipmentModeOptions"`,
    `<div class="grid gap-4 md:grid-cols-2">\n            <button\n              v-for="option in shipmentModeOptions"`,
  )

  // Compatibilidad cuando este plugin se ejecuta sin la capa de pulido terrestre.
  code = code.replace(
    `<div class="grid gap-4 md:grid-cols-3">\n            <button\n              v-for="option in shipmentModeOptions"`,
    `<div class="grid gap-4 md:grid-cols-2">\n            <button\n              v-for="option in shipmentModeOptions"`,
  )

  // Igualar altura/ancho de las tarjetas para que icono, título y estado seleccionado
  // tengan la misma jerarquía independientemente de la modalidad elegida.
  code = code.replaceAll(
    `class="crystal-choice min-h-[120px]"`,
    `class="crystal-choice min-h-[128px] w-full"`,
  )

  return code
}

export function pricingWizardShipmentStyleParity(): Plugin {
  return {
    name: 'dhole-pricing-wizard-shipment-style-parity',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
