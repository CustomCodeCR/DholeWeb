import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardToastErrors] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `async function next() {`,
    `function currentStepValidationErrors() {\n  const errors: string[] = []\n\n  if (step.value === 1 && !form.modality) {\n    errors.push('Seleccione la modalidad.')\n  }\n\n  if (step.value === 2 && !form.shipmentMode) {\n    errors.push('Seleccione el tipo de embarque.')\n  }\n\n  if (step.value === 3) {\n    if (!form.originId) errors.push('Seleccione el POL / origen.')\n    if (!form.destinationId) errors.push('Seleccione el POE / destino.')\n    if (!selectedEquipment.value) errors.push('Seleccione el equipo.')\n    if (number(form.equipmentQuantity) <= 0) errors.push('Indique una cantidad de equipo válida.')\n    if (!form.incotermId) errors.push('Seleccione el Incoterm.')\n    if (!form.serviceIds.length) errors.push('Seleccione al menos un servicio.')\n    if (!form.loadDate) errors.push('Indique la fecha de carga lista.')\n\n    if (selectedIncotermCode.value === 'EXW') {\n      if (!form.pickupAddress.trim()) errors.push('Indique la dirección de recolección EXW.')\n      if (!pickupCoordinates.value) errors.push('Ubique la recolección EXW en el mapa.')\n    }\n\n    if (selectedIncotermCode.value === 'FCA') {\n      if (catalogs.warehouses.length && !form.warehouseId) {\n        errors.push('Seleccione el WHS para FCA.')\n      } else if (!catalogs.warehouses.length) {\n        if (!form.pickupAddress.trim()) errors.push('Indique la dirección del WHS para FCA.')\n        if (!pickupCoordinates.value) errors.push('Ubique el WHS FCA en el mapa.')\n      }\n    }\n  }\n\n  if (step.value === 5 && !(form.selectedImportRateId || form.manualRate || availableRates.value.length === 0)) {\n    errors.push('Seleccione una tarifa disponible o active la tarifa manual.')\n  }\n\n  if (step.value === 6) {\n    if (!form.agentId) errors.push('Seleccione el agente.')\n    if (!form.carrierId) errors.push('Seleccione la naviera / proveedor.')\n    if (!form.currencyId) errors.push('Seleccione la moneda.')\n    if (number(form.freightCost) < 0) errors.push('El costo del flete no puede ser negativo.')\n    if (number(form.freightSale) < 0) errors.push('La venta del flete no puede ser negativa.')\n  }\n\n  return errors\n}\n\nfunction showCurrentStepValidationToast() {\n  const errors = currentStepValidationErrors()\n  toastStore.error(\n    'Faltan datos obligatorios',\n    errors.length ? errors.join(' · ') : 'Revise los campos requeridos antes de continuar.',\n  )\n}\n\nasync function next() {`,
    'wizard validation helper',
  )

  code = replaceOne(
    code,
    `  if (!canNext.value) return`,
    `  if (!canNext.value) {\n    showCurrentStepValidationToast()\n    return\n  }`,
    'silent next validation',
  )

  code = replaceOne(
    code,
    `async function saveOpenRequest() {\n  const origin = selectedOrigin.value`,
    `async function saveOpenRequest() {\n  if (!canNext.value) {\n    showCurrentStepValidationToast()\n    return\n  }\n\n  const origin = selectedOrigin.value`,
    'seller request validation toast',
  )

  code = replaceOne(
    code,
    `<DhButton v-if="sellerRequestMode && step === 3" :disabled="saving || !canNext" @click="saveOpenRequest"><Check class="h-4 w-4" /> {{ saving ? 'Enviando…' : 'Enviar solicitud a Pricing' }}</DhButton>`,
    `<DhButton v-if="sellerRequestMode && step === 3" :disabled="saving" @click="saveOpenRequest"><Check class="h-4 w-4" /> {{ saving ? 'Enviando…' : 'Enviar solicitud a Pricing' }}</DhButton>`,
    'seller request clickable validation button',
  )

  code = replaceOne(
    code,
    `<DhButton v-else-if="!isEditing && step < 8 && ![1, 2, 5].includes(step)" :disabled="!canNext || (loadingRates && shipmentModeForApi === 'Fcl')" @click="next">Continuar <ChevronRight class="h-4 w-4" /></DhButton>`,
    `<DhButton v-else-if="!isEditing && step < 8 && ![1, 2, 5].includes(step)" :disabled="loadingRates && shipmentModeForApi === 'Fcl'" @click="next">Continuar <ChevronRight class="h-4 w-4" /></DhButton>`,
    'wizard clickable validation button',
  )

  code = replaceOne(
    code,
    `  if (commercialAction.value === 'accept' && !commercialIdtra.value.trim()) {\n    commercialActionError.value = 'El IDTRA es obligatorio para aceptar la tarifa.'\n    return\n  }`,
    `  if (commercialAction.value === 'accept' && !commercialIdtra.value.trim()) {\n    commercialActionError.value = 'El IDTRA es obligatorio para aceptar la tarifa.'\n    toastStore.error('Falta IDTRA', commercialActionError.value)\n    return\n  }`,
    'commercial accept validation toast',
  )

  code = replaceOne(
    code,
    `  if (commercialAction.value === 'reject' && !commercialRejectionReason.value.trim()) {\n    commercialActionError.value = 'El motivo de rechazo es obligatorio.'\n    return\n  }`,
    `  if (commercialAction.value === 'reject' && !commercialRejectionReason.value.trim()) {\n    commercialActionError.value = 'El motivo de rechazo es obligatorio.'\n    toastStore.error('Falta motivo de rechazo', commercialActionError.value)\n    return\n  }`,
    'commercial reject validation toast',
  )

  code = replaceOne(
    code,
    `  } catch {\n    // No borrar valores escritos por el usuario si una actualización falla.\n    exchangeRateError.value = 'No fue posible consultar Hacienda. Ingrese Compra y Venta manualmente o intente actualizar.'\n  } finally {`,
    `  } catch {\n    // No borrar valores escritos por el usuario si una actualización falla.\n    exchangeRateError.value = 'No fue posible consultar Hacienda. Ingrese Compra y Venta manualmente o intente actualizar.'\n    toastStore.error('Tipo de cambio no disponible', exchangeRateError.value)\n  } finally {`,
    'exchange rate error toast',
  )

  return code
}

export function pricingWizardToastErrors(): Plugin {
  return {
    name: 'dhole-pricing-wizard-toast-errors',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
