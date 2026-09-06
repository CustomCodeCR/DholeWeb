import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  const index = source.indexOf(anchor)
  if (index < 0) throw new Error(`[pricingSellerPodIntegrity] Missing ${label}.`)
  return source.slice(0, index) + replacement + source.slice(index + anchor.length)
}

function replaceAllRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) throw new Error(`[pricingSellerPodIntegrity] Missing ${label}.`)
  return source.split(anchor).join(replacement)
}

function replaceAfter(source: string, marker: string, anchor: string, replacement: string, label: string) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) throw new Error(`[pricingSellerPodIntegrity] Missing ${label} marker.`)
  const anchorIndex = source.indexOf(anchor, markerIndex)
  if (anchorIndex < 0) throw new Error(`[pricingSellerPodIntegrity] Missing ${label}.`)
  return source.slice(0, anchorIndex) + replacement + source.slice(anchorIndex + anchor.length)
}

function patchWizard(source: string) {
  let code = source

  // Keep the human-readable route names even if a catalog lookup is temporarily unavailable.
  code = replaceRequired(
    code,
    `const requestedCargoReadyDate = ref('')\nconst requestedPortHandlingMode = ref<SellerPortHandlingMode | ''>('')`,
    `const requestedCargoReadyDate = ref('')\nconst requestedPortHandlingMode = ref<SellerPortHandlingMode | ''>('')\nconst requestedPoeName = ref('')\nconst requestedPodName = ref('')\n\nfunction currentRequestPodName() {\n  const podId = String(form.podId ?? '').trim()\n  if (!podId) return ''\n  if (selectedPod.value) return displayValue(selectedPod.value)\n  const option = podOptions.value.find((item) => String(item.value ?? '') === podId)\n  return String(option?.label ?? '').trim()\n}`,
    'request route display state',
  )

  // For seller LCL requests the final destination is operationally mandatory.
  code = replaceRequired(
    code,
    `  const finalDestination = selectedPod.value\n  const equipment = selectedEquipment.value`,
    `  const finalDestination = selectedPod.value\n  const requestPodId = String(form.podId ?? '').trim()\n  const requestPodName = currentRequestPodName()\n  const equipment = selectedEquipment.value\n\n  if (props.sellerRequestMode && shipmentModeForApi.value === 'Lcl' && !requestPodId) {\n    toastStore.error('El POD es requerido para solicitudes LCL. Seleccione el destino final antes de enviar la solicitud a Pricing.')\n    return\n  }`,
    'seller LCL POD guard',
  )

  // Persist the raw selected id and its label, not only the resolved catalog object.
  code = replaceRequired(
    code,
    `          destinationName: finalDestination ? displayValue(finalDestination) : displayValue(destination),\n          poeId: destination.id,\n          poeName: displayValue(destination),\n          podId: finalDestination?.id ?? (form.podId || null),\n          podName: finalDestination ? displayValue(finalDestination) : null,`,
    `          destinationName: requestPodName || (finalDestination ? displayValue(finalDestination) : displayValue(destination)),\n          poeId: destination.id,\n          poeName: displayValue(destination),\n          podId: requestPodId || null,\n          podName: requestPodName || null,`,
    'typed seller POE/POD payload',
  )

  code = replaceAllRequired(
    code,
    `              podId: finalDestination?.id ?? form.podId ?? null,\n              podName: finalDestination ? displayValue(finalDestination) : null,`,
    `              podId: requestPodId || null,\n              podName: requestPodName || null,`,
    'seller requestContext POD payload',
  )

  // Restore typed route names as well as ids when Pricing resumes the request.
  code = replaceRequired(
    code,
    `      const typedRoute = request as unknown as { poeId?: string | null; podId?: string | null }`,
    `      const typedRoute = request as unknown as {\n        poeId?: string | null\n        poeName?: string | null\n        podId?: string | null\n        podName?: string | null\n      }`,
    'typed route hydration contract',
  )

  code = replaceRequired(
    code,
    `      const poeId = String(typedRoute.poeId ?? routeContext?.poeId ?? savedForm?.destinationId ?? '').trim()\n      const podId = String(typedRoute.podId ?? routeContext?.podId ?? savedForm?.podId ?? '').trim()\n      if (poeId) form.destinationId = poeId\n      if (podId) form.podId = podId`,
    `      const poeId = String(typedRoute.poeId ?? routeContext?.poeId ?? savedForm?.destinationId ?? '').trim()\n      const podId = String(typedRoute.podId ?? routeContext?.podId ?? savedForm?.podId ?? '').trim()\n      requestedPoeName.value = String(typedRoute.poeName ?? routeContext?.poeName ?? '').trim()\n      requestedPodName.value = String(typedRoute.podName ?? routeContext?.podName ?? '').trim()\n      if (poeId) form.destinationId = poeId\n      if (podId) form.podId = podId`,
    'route name hydration',
  )

  // Screen 5 must always surface exactly what Sales selected.
  const handoffMarker = 'Datos definidos por Ventas'
  code = replaceAfter(
    code,
    handoffMarker,
    `{{ displayValue(selectedDestination) || 'No indicado' }}`,
    `{{ requestedPoeName || displayValue(selectedDestination) || 'No indicado' }}`,
    'POE handoff display',
  )
  code = replaceAfter(
    code,
    handoffMarker,
    `:class="shipmentModeForApi === 'Lcl' && !selectedPod ? 'text-red-600 dark:text-red-300' : ''"`,
    `:class="shipmentModeForApi === 'Lcl' && !requestedPodName && !selectedPod ? 'text-red-600 dark:text-red-300' : ''"`,
    'POD missing styling',
  )
  code = replaceAfter(
    code,
    handoffMarker,
    `{{ displayValue(selectedPod) || (shipmentModeForApi === 'Lcl' ? 'POD no indicado por Ventas' : 'No indicado') }}`,
    `{{ requestedPodName || displayValue(selectedPod) || (shipmentModeForApi === 'Lcl' ? 'POD no indicado por Ventas' : 'No indicado') }}`,
    'POD handoff display',
  )

  // The LCL consolidated/coloader query must use the persisted ids even if the catalog object cannot resolve.
  code = replaceAllRequired(
    code,
    `:poe-id="selectedDestination?.id ?? null"`,
    `:poe-id="form.destinationId || null"`,
    'LCL POE id binding',
  )
  code = replaceAllRequired(
    code,
    `:poe-label="displayValue(selectedDestination)"`,
    `:poe-label="requestedPoeName || displayValue(selectedDestination)"`,
    'LCL POE label binding',
  )
  code = replaceAllRequired(
    code,
    `:pod-id="selectedPod?.id ?? null"`,
    `:pod-id="form.podId || null"`,
    'LCL POD id binding',
  )
  code = replaceAllRequired(
    code,
    `:pod-label="selectedPod ? displayValue(selectedPod) : null"`,
    `:pod-label="requestedPodName || currentRequestPodName() || (selectedPod ? displayValue(selectedPod) : null)"`,
    'LCL POD label binding',
  )

  // Preserve the POD again when the official rate is finally created.
  code = replaceRequired(
    code,
    `      podId: selectedPod.value?.id ?? null,\n      podName: selectedPod.value ? displayValue(selectedPod.value) : null,`,
    `      podId: selectedPod.value?.id ?? (form.podId || null),\n      podName: selectedPod.value ? displayValue(selectedPod.value) : (requestedPodName.value || currentRequestPodName() || null),`,
    'official rate POD persistence',
  )

  // Make the seller form explicit: POD is required for LCL and optional elsewhere.
  code = replaceRequired(
    code,
    `label="POD (opcional)"\n                placeholder="Buscar destino final"`,
    `:label="sellerRequestMode && shipmentModeForApi === 'Lcl' ? 'POD requerido' : 'POD'"\n                placeholder="Buscar destino final"`,
    'seller POD label',
  )
  code = replaceAfter(
    code,
    `placeholder="Buscar destino final"`,
    `:optional="true"`,
    `:optional="!(sellerRequestMode && shipmentModeForApi === 'Lcl')"`,
    'seller POD optional flag',
  )

  return code
}

export function pricingSellerPodIntegrity(): Plugin {
  return {
    name: 'dhole-pricing-seller-pod-integrity',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
