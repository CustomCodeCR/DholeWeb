import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOnce(source: string, anchor: string, replacement: string, label: string): string {
  if (source.split(anchor).length !== 2) {
    throw new Error('[pricingSellerRequestDuplicate] Expected exactly one ' + label)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string): string {
  let code = source

  // Run after pricingSellerRequestEdit / pricingSellerModificationWizard to
  // preserve their route, revision, draft and owner guards.
  code = replaceOnce(code,
    '  sellerEditRequestId?: string | null\n',
    '  sellerEditRequestId?: string | null\n  sellerDuplicateRequestId?: string | null\n',
    'duplicate prop')
  code = replaceOnce(code,
    '  sellerEditRequestId: null,\n',
    '  sellerEditRequestId: null,\n  sellerDuplicateRequestId: null,\n',
    'duplicate prop default')

  code = replaceOnce(code,
    "? (props.sellerModificationRateId ? 'Solicitar modificación de tarifa' : props.sellerEditRequestId ? 'Editar mi solicitud de tarifa' : 'Solicitud de tarifa para Pricing')",
    "? (props.sellerModificationRateId ? 'Solicitar modificación de tarifa' : props.sellerEditRequestId ? 'Editar mi solicitud de tarifa' : props.sellerDuplicateRequestId ? 'Duplicar solicitud de tarifa' : 'Solicitud de tarifa para Pricing')",
    'duplicate page title')
  code = replaceOnce(code,
    "? (props.sellerModificationRateId ? 'Revise la cotización original y modifique las pantallas 1 a 4. Pricing recibirá una propuesta con las diferencias, sin alterar la tarifa vigente.' : props.sellerEditRequestId ? 'Modifique las pantallas 1 a 4 de la solicitud enviada. Los cambios serán visibles para Pricing al guardar.' : 'Ventas completa únicamente las pantallas 0 a 4. Pricing recibe la solicitud y continúa desde la pantalla 5.')",
    "? (props.sellerModificationRateId ? 'Revise la cotización original y modifique las pantallas 1 a 4. Pricing recibirá una propuesta con las diferencias, sin alterar la tarifa vigente.' : props.sellerEditRequestId ? 'Modifique las pantallas 1 a 4 de la solicitud enviada. Los cambios serán visibles para Pricing al guardar.' : props.sellerDuplicateRequestId ? 'Se precargaron los datos de otra solicitud. Revise las pantallas 1 a 4 y envíe una solicitud nueva; la original no cambia.' : 'Ventas completa únicamente las pantallas 0 a 4. Pricing recibe la solicitud y continúa desde la pantalla 5.')",
    'duplicate page description')

  const hydration = [
    'async function hydrateSellerRequestDuplicate() {',
    '  if (!props.sellerDuplicateRequestId) return',
    '  try {',
    '    loadingExistingRate.value = true',
    '    // The mine endpoint enforces owner authorization for ALL original statuses.',
    '    const response = await callEndpoint<unknown>({',
    "      method: 'GET',",
    "      path: '/api/pricing/rate-requests/mine/' + encodeURIComponent(props.sellerDuplicateRequestId),",
    "      headers: { Accept: 'application/json' },",
    '    })',
    '    const original = unwrapApiResponse<SellerRateRequestDto>(response as never)',
    '    if (!original.payload?.form) {',
    "      toastStore.error('La solicitud original no tiene datos reutilizables.')",
    "      await router.replace('/home')",
    '      return',
    '    }',
    '    // Only the commercial form is copied. No IDs, rate relationships,',
    '    // revision metadata, request status, work status or document ownership.',
    '    Object.assign(form, JSON.parse(JSON.stringify(original.payload.form)))',
    '    pickupLocations.value = Array.isArray(original.payload.pickupLocations)',
    '      ? original.payload.pickupLocations.map(pickup => ({ ...pickup })) : []',
    '    supportDocuments.value = []',
    '    const details = original.payload as typeof original.payload & {',
    "      sellerContext?: { portHandlingMode?: SellerPortHandlingMode | null; cargoWeightInputUnit?: string | null; cargoDimensionInputUnit?: string | null }",
    '    }',
    "    sellerPortHandlingMode.value = details.sellerContext?.portHandlingMode || ''",
    "    const dimensionInput = String(details.sellerContext?.cargoDimensionInputUnit ?? original.payload.form.miamiDimensionInputUnit ?? '')",
    "    if (['mm', 'cm', 'm', 'in'].includes(dimensionInput)) selectConsolidatedDimensionUnit(dimensionInput)",
    "    form.miamiWeightInputUnit = details.sellerContext?.cargoWeightInputUnit === 'lb' || (!details.sellerContext?.cargoWeightInputUnit && original.payload.form.miamiWeightInputUnit === 'lb') ? 'lb' : 'kg'",
    '    await nextTick()',
    '    restoreSellerConsolidatedCargo(',
    '      original.payload.form as Record<string, unknown>,',
    '      details.sellerContext as Record<string, unknown> | undefined,',
    '    )',
    '    const originalOwner = original as SellerRateRequestDto & { sellerUserId?: string | null; poeId?: string | null; podId?: string | null }',
    '    if (originalOwner.sellerUserId) sellerRequestOwnerId.value = originalOwner.sellerUserId',
    '    if (originalOwner.poeId) form.destinationId = originalOwner.poeId',
    '    if (originalOwner.podId) form.podId = originalOwner.podId',
    '    rateRequestPriority.value = original.priority',
    "    // New quote: reset old references and stale validity rather than reusing them.",
    "    form.idtraNumber = ''",
    '    const today = new Date()',
    '    form.loadDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10)',
    "    form.validTo = ''",
    '    // Start on the commercial summary; all previous screens remain editable.',
    '    step.value = 4',
    '  } catch (error) {',
    "    toastStore.backendError(error, 'No se pudo recuperar la solicitud para duplicarla.')",
    "    await router.replace('/home')",
    '  } finally {',
    '    loadingExistingRate.value = false',
    '  }',
    '}',
    '',
  ].join('\n')

  code = replaceOnce(code,
    'async function hydrateSellerRequestEdit() {',
    hydration + '\nasync function hydrateSellerRequestEdit() {',
    'duplicate hydration')
  code = replaceOnce(code,
    '  if (props.sellerEditRequestId) await hydrateSellerRequestEdit()',
    '  if (props.sellerDuplicateRequestId) await hydrateSellerRequestDuplicate()\n  if (props.sellerEditRequestId) await hydrateSellerRequestEdit()',
    'duplicate hydration on mount')
  code = replaceOnce(code,
    "    : props.sellerEditRequestId\n    ? 'seller:edit:' + props.sellerEditRequestId",
    "    : props.sellerDuplicateRequestId\n    ? 'seller:duplicate:' + props.sellerDuplicateRequestId\n    : props.sellerEditRequestId\n    ? 'seller:edit:' + props.sellerEditRequestId",
    'separate duplicate draft')
  code = replaceOnce(code,
    "    toastStore.success('Solicitud enviada a Pricing', 'Solicitud ' + requestId + ' · prioridad ' + description + '.')",
    "    if (props.sellerDuplicateRequestId) {\n      toastStore.success('Solicitud duplicada y enviada a Pricing', 'Nueva solicitud ' + requestId + ' · prioridad ' + description + '.')\n      clearPricingDraft(true)\n      await router.push('/home')\n      return\n    }\n    toastStore.success('Solicitud enviada a Pricing', 'Solicitud ' + requestId + ' · prioridad ' + description + '.')",
    'duplicate submit success')
  code = replaceOnce(code,
    "{{ saving ? 'Guardando…' : sellerModificationRateId ? 'Solicitar modificación a Pricing' : sellerEditRequestId ? 'Guardar cambios' : 'Enviar solicitud a Pricing' }}",
    "{{ saving ? 'Guardando…' : sellerModificationRateId ? 'Solicitar modificación a Pricing' : sellerEditRequestId ? 'Guardar cambios' : sellerDuplicateRequestId ? 'Enviar nueva solicitud a Pricing' : 'Enviar solicitud a Pricing' }}",
    'duplicate submit label')

  return code
}

export function pricingSellerRequestDuplicate(): Plugin {
  return {
    name: 'dhole-pricing-seller-request-duplicate',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      if (id.replaceAll('\\', '/').endsWith(WIZARD_PATH)) {
        return { code: patchWizard(source), map: null }
      }
      return null
    },
  }
}
