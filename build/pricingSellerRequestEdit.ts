import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const ROUTER_PATH = '/src/core/router/index.ts'

function replaceOnce(source: string, anchor: string, replacement: string, label: string) {
  if (source.split(anchor).length !== 2)
    throw new Error('[pricingSellerRequestEdit] Expected one ' + label)
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source



  code = replaceOnce(code,
    "? 'Solicitud de tarifa para Pricing'",
    "? (props.sellerEditRequestId ? 'Editar mi solicitud de tarifa' : 'Solicitud de tarifa para Pricing')",
    'seller edit page title')
  code = replaceOnce(code,
    "? 'Ventas completa únicamente las pantallas 0 a 4. Pricing recibe la solicitud y continúa desde la pantalla 5.'",
    "? (props.sellerEditRequestId ? 'Modifique las pantallas 1 a 4 de la solicitud enviada. Los cambios serán visibles para Pricing al guardar.' : 'Ventas completa únicamente las pantallas 0 a 4. Pricing recibe la solicitud y continúa desde la pantalla 5.')",
    'seller edit page description')

  const hydrateSellerEdit = [
    'async function hydrateSellerRequestEdit() {',
    '  if (!props.sellerEditRequestId) return',
    '  try {',
    '    loadingExistingRate.value = true',
    '    const response = await callEndpoint<unknown>({',
    "      method: 'GET',",
    "      path: '/api/pricing/rate-requests/mine/' + props.sellerEditRequestId,",
    "      headers: { Accept: 'application/json' },",
    '    })',
    '    const request = unwrapApiResponse<SellerRateRequestDto>(response as never)',
    '    const claim = request as SellerRateRequestDto & { lockedByUserId?: string | null; lockedByName?: string | null; lockExpiresAtUtc?: string | null }',
    '    if (claim.lockedByUserId && claim.lockExpiresAtUtc && new Date(claim.lockExpiresAtUtc).getTime() > Date.now()) {',
    "      toastStore.warning('Solicitud bloqueada', (claim.lockedByName || 'Pricing') + ' ya está atendiendo esta solicitud. No se permite editarla.')",
    "      await router.replace('/home')",
    '      return',
    '    }',
    "    if (request.status !== 'Open' || request.rateId) {",
    "      toastStore.error('Esta solicitud ya no está disponible para edición.')",
    "      await router.replace('/home')",
    '      return',
    '    }',
    '    if (!request.payload?.form) {',
    "      toastStore.error('La solicitud no contiene el formulario original.')",
    "      await router.replace('/home')",
    '      return',
    '    }',
    '    Object.assign(form, request.payload.form)',
    '    pickupLocations.value = Array.isArray(request.payload.pickupLocations)',
    '      ? request.payload.pickupLocations.map((pickup) => ({ ...pickup })) : []',
    '    if (request.payload.supportEntityId) supportEntityId.value = request.payload.supportEntityId',
    '    supportDocuments.value = Array.isArray(request.payload.supportDocuments)',
    '      ? request.payload.supportDocuments.map((item) => ({ ...item })) : []',
    '    const details = request.payload as typeof request.payload & {',
    "      sellerContext?: { portHandlingMode?: SellerPortHandlingMode | null; cargoReadyDate?: string | null; cargoWeightInputUnit?: string | null; cargoDimensionInputUnit?: string | null }",
    '    }',
    "    sellerPortHandlingMode.value = details.sellerContext?.portHandlingMode || ''",
    "    const dimensionInput = String(details.sellerContext?.cargoDimensionInputUnit ?? request.payload.form.miamiDimensionInputUnit ?? '')",
    "    if (['mm', 'cm', 'm', 'in'].includes(dimensionInput)) selectConsolidatedDimensionUnit(dimensionInput)",
    "    form.miamiWeightInputUnit = details.sellerContext?.cargoWeightInputUnit === 'lb' || (!details.sellerContext?.cargoWeightInputUnit && request.payload.form.miamiWeightInputUnit === 'lb') ? 'lb' : 'kg'",
    "    await nextTick()",
    "    restoreSellerConsolidatedCargo(",
    "      request.payload.form as Record<string, unknown>,",
    "      details.sellerContext as Record<string, unknown> | undefined,",
    "    )",
    '    if (details.sellerContext?.cargoReadyDate) form.loadDate = details.sellerContext.cargoReadyDate',
    '    const requestWithOwner = request as SellerRateRequestDto & { sellerUserId?: string | null; poeId?: string | null; podId?: string | null }',
    "    if (requestWithOwner.sellerUserId) sellerRequestOwnerId.value = requestWithOwner.sellerUserId",
    '    if (requestWithOwner.poeId) form.destinationId = requestWithOwner.poeId',
    '    if (requestWithOwner.podId) form.podId = requestWithOwner.podId',
    '    rateRequestPriority.value = request.priority',
    '    // Open the last seller screen; previous screens remain available for corrections.',
    '    step.value = 4',
    '  } catch (error) {',
    "    toastStore.backendError(error, 'No se pudo cargar la solicitud para edición.')",
    "    await router.replace('/home')",
    '  } finally {',
    '    loadingExistingRate.value = false',
    '  }',
    '}',
    '',
  ].join('\n')

  code = replaceOnce(code,
    'async function hydrateRateRequest() {',
    hydrateSellerEdit + '\nasync function hydrateRateRequest() {',
    'seller request edit hydration')

  code = replaceOnce(code,
    '  await loadCatalogs()\n  if (props.rateId) await hydrateExistingRate()',
    '  await loadCatalogs()\n  if (props.sellerEditRequestId) await hydrateSellerRequestEdit()\n  if (props.rateId) await hydrateExistingRate()',
    'edit mount after catalogs')

  code = replaceOnce(code,
    "const scope = props.rateId\n    ? 'rate:' + props.rateId",
    "const scope = props.sellerEditRequestId\n    ? 'seller:edit:' + props.sellerEditRequestId\n    : props.rateId\n      ? 'rate:' + props.rateId",
    'isolated edit draft')

  code = replaceOnce(code,
    "method: 'POST', path: '/api/pricing/rate-requests', headers: { Accept: 'application/json' }",
    "method: props.sellerEditRequestId ? 'PUT' : 'POST', path: props.sellerEditRequestId ? '/api/pricing/rate-requests/mine/' + props.sellerEditRequestId : '/api/pricing/rate-requests', headers: { Accept: 'application/json' }",
    'POST or PUT')

  code = replaceOnce(code,
    "    toastStore.success('Solicitud enviada a Pricing', 'Solicitud ' + requestId + ' · prioridad ' + description + '.')",
    "    if (props.sellerEditRequestId) {\n      toastStore.success('Solicitud actualizada', 'Pricing recibirá los datos corregidos de la solicitud ' + requestId + '.')\n      clearPricingDraft(true)\n      await router.push('/home')\n      return\n    }\n    toastStore.success('Solicitud enviada a Pricing', 'Solicitud ' + requestId + ' · prioridad ' + description + '.')",
    'seller edit success')

  code = replaceOnce(code,
    "{{ saving ? 'Enviando…' : 'Enviar solicitud a Pricing' }}",
    "{{ saving ? 'Guardando…' : sellerEditRequestId ? 'Guardar cambios' : 'Enviar solicitud a Pricing' }}",
    'seller edit button label')

  // Some later pricing plugins rewrite the executive selector. Keep the
  // server-side owner check authoritative and lock the UI when the selector is present.
  const ownerSelect = /<DhSelect[^>]*v-model="sellerRequestOwnerId"[^>]*\/>/s
  const ownerMatch = code.match(ownerSelect)
  if (ownerMatch && ownerMatch[0].includes(':disabled="')) {
    code = code.replace(ownerMatch[0], ownerMatch[0].replace(
      /:disabled="([^"]*)"/,
      ':disabled="$1 || !!sellerEditRequestId"',
    ))
  }

  code = replaceOnce(code,
    'Cargando tarifa completa…',
    "{{ sellerEditRequestId ? 'Cargando solicitud para edición…' : 'Cargando tarifa completa…' }}",
    'loading message')

  return code
}

function patchRouter(source: string) {
  const anchor = "        {\n          path: 'pricing/request-rate',\n          name: 'pricing-seller-rate-request',"
  const editingRoute = [
    '        {',
    "          path: 'pricing/request-rate/:requestId/edit',",
    "          name: 'pricing-seller-rate-request-edit',",
    "          component: () => import('@/modules/pricing/views/PricingSellerRateRequestView.vue'),",
    '          meta: {',
    "            tabTitle: 'Editar solicitud',",
    '            closable: true,',
    "            requiredScope: 'pricing.rate-request.create',",
    '          },',
    '        },',
    '',
  ].join('\n')
  return replaceOnce(source, anchor, editingRoute + anchor, 'edit route')
}

export function pricingSellerRequestEdit(): Plugin {
  return {
    name: 'dhole-pricing-seller-request-edit',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/')
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(ROUTER_PATH)) return { code: patchRouter(source), map: null }
      return null
    },
  }
}
