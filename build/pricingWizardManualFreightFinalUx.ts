import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  let code = source

  // La tarifa manual solo se puede crear cuando Pantalla 6 está completamente llena.
  const readinessAnchor = "const savedManualOceanFreightFingerprint = ref('')"
  if (code.includes(readinessAnchor) && !code.includes('const manualOceanFreightReady = computed')) {
    code = code.replace(
      readinessAnchor,
      `${readinessAnchor}\nconst manualOceanFreightReady = computed(() => {\n  if (shipmentModeForApi.value !== 'Fcl') return false\n  if (!['Maritime', 'Multimodal'].includes(String(form.modality))) return false\n  if (!(form.manualRate || !form.selectedImportRateId)) return false\n\n  return Boolean(\n    form.agentId\n    && form.carrierId\n    && manualOceanFreightPoeId.value\n    && form.currencyId\n    && number(form.freightCost) > 0\n    && number(form.freightSale) > 0\n    && form.loadDate\n    && form.validTo\n    && form.validTo >= form.loadDate\n    && manualOceanFreightComment.value.trim()\n    && number(form.freeDays) >= 0\n    && number(form.transitDays) >= 0\n  )\n})`,
    )
  }

  // Evita que se pueda disparar el guardado por una llamada directa con datos incompletos.
  const saveDataAnchor = `  const origin = selectedOrigin.value\n  const destination = selectedDestination.value\n  const poe = selectedManualOceanFreightPoe.value\n  const pod = resolvePodForDestination() ?? destination`
  if (code.includes(saveDataAnchor) && !code.includes("Complete todos los datos de Pantalla 6 antes de crear el flete.")) {
    code = code.replace(
      saveDataAnchor,
      `  if (!manualOceanFreightReady.value) {\n    toastStore.warning('Complete Pantalla 6', 'Complete agente, naviera, POE, moneda, costo, venta, vigencia, comentarios, días libres y días de tránsito antes de crear el flete.')\n    return\n  }\n\n${saveDataAnchor}`,
    )
  }

  // Quita el botón antiguo que aparecía arriba junto al título del bloque manual.
  const topButton = `                <DhButton type="button" variant="secondary" :loading="savingManualOceanFreight" :disabled="savingManualOceanFreight || form.freightCost <= 0" @click="saveManualOceanFreight">
                  Guardar flete marítimo
                </DhButton>`
  code = code.replace(topButton, '')
  code = code.replace(
    /\s*<DhButton\s+type="button"\s+variant="secondary"\s+:loading="savingManualOceanFreight"\s+:disabled="savingManualOceanFreight \|\| form\.freightCost <= 0"\s+@click="saveManualOceanFreight">\s*Guardar flete marítimo\s*<\/DhButton>/,
    '',
  )

  code = code.replace('Guardar flete marítimo manual', 'Crear flete marítimo manual')
  code = code.replace(
    'Guarda este costo/venta como una tarifa marítima pre-aprobada para reutilizarla después en Pantalla 5.',
    'Complete todos los datos del flete, incluido el POE real. La tarifa creada manualmente quedará Preaprobada y disponible en Pantalla 5.',
  )
  code = code.replace(
    'Flete guardado correctamente como tarifa pre-aprobada.',
    'Flete creado correctamente como tarifa Preaprobada y creada manualmente.',
  )
  code = code.replace(
    "toastStore.success('Flete marítimo guardado', 'Quedó disponible como tarifa pre-aprobada para reutilizarla en Pantalla 5.')",
    "toastStore.success('Flete marítimo creado', 'La tarifa quedó Preaprobada y marcada como Creada manualmente en Pantalla 5.')",
  )

  // El botón de creación debe ser la última acción de Pantalla 6, debajo de todos
  // los campos y del resumen financiero.
  const screenSixEnd = `</div>\n        </div>\n\n        <div v-else-if="step === 4" class="space-y-6">`
  if (code.includes(screenSixEnd) && !code.includes('data-manual-ocean-freight-final-action')) {
    code = code.replace(
      screenSixEnd,
      `</div>\n\n          <div\n            v-if="shipmentModeForApi === 'Fcl' && (form.modality === 'Maritime' || form.modality === 'Multimodal') && (form.manualRate || !form.selectedImportRateId)"\n            data-manual-ocean-freight-final-action\n            class="crystal-soft flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5"\n          >\n            <div>\n              <p class="font-black">Crear flete marítimo</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">\n                El botón se habilita únicamente cuando agente, naviera, POE, moneda, costo, venta, vigencia, comentarios, días libres y tránsito estén completos.\n              </p>\n              <p v-if="manualOceanFreightSavedId" class="mt-2 text-xs font-black text-emerald-600">\n                Tarifa creada correctamente · Preaprobada · Creada manualmente.\n              </p>\n            </div>\n            <DhButton\n              type="button"\n              variant="primary"\n              class="w-full md:w-auto"\n              :loading="savingManualOceanFreight"\n              :disabled="savingManualOceanFreight || !manualOceanFreightReady"\n              @click="saveManualOceanFreight"\n            >\n              Crear flete marítimo\n            </DhButton>\n          </div>\n        </div>\n\n        <div v-else-if="step === 4" class="space-y-6">`,
    )
  }

  // Pantalla 5 - FCL agrupado: una tarifa manual siempre se presenta como
  // Preaprobada y se identifica explícitamente como creada manualmente.
  const bundleStatusBadge = `<DhBadge :variant="bundle.preAuthorized ? 'warning' : 'success'">{{ bundle.preAuthorized ? 'Incluye preautorizada' : 'Preaprobada' }}</DhBadge>`
  if (code.includes(bundleStatusBadge)) {
    code = code.replace(
      bundleStatusBadge,
      `<DhBadge\n                      :variant="bundle.lines.some((line) => String(line.rate.sourceType) === 'Manual') || !bundle.preAuthorized ? 'success' : 'warning'"\n                    >\n                      {{ bundle.lines.some((line) => String(line.rate.sourceType) === 'Manual') ? 'Preaprobada' : (bundle.preAuthorized ? 'Incluye preautorizada' : 'Preaprobada') }}\n                    </DhBadge>\n                    <DhBadge\n                      v-if="bundle.lines.some((line) => String(line.rate.sourceType) === 'Manual')"\n                      variant="primary"\n                    >Creada manualmente</DhBadge>`,
    )
  }

  // Pantalla 5 - tarjeta individual: mismo tratamiento para cualquier vista que
  // todavía use availableRates en lugar de bundles.
  const singleStatusBadge = `<DhBadge :variant="rate.status === 'PreAuthorized' ? 'warning' : 'success'">{{ rate.status === 'PreAuthorized' ? 'Preautorizada' : 'Preaprobada' }}</DhBadge>`
  if (code.includes(singleStatusBadge)) {
    code = code.replace(
      singleStatusBadge,
      `<div class="flex flex-wrap justify-end gap-2">\n                    <DhBadge :variant="String(rate.sourceType) === 'Manual' || rate.status !== 'PreAuthorized' ? 'success' : 'warning'">\n                      {{ String(rate.sourceType) === 'Manual' ? 'Preaprobada' : (rate.status === 'PreAuthorized' ? 'Preautorizada' : 'Preaprobada') }}\n                    </DhBadge>\n                    <DhBadge v-if="String(rate.sourceType) === 'Manual'" variant="primary">Creada manualmente</DhBadge>\n                  </div>`,
    )
  }

  code = code.replace(
    `Fuente: {{ importSourceTitle(rate) }}`,
    `Fuente: {{ String(rate.sourceType) === 'Manual' ? 'Creada manualmente' : importSourceTitle(rate) }}`,
  )

  const singleSourceLink = `<span class="mt-1 inline-flex items-center gap-1 text-xs font-black text-[var(--dh-primary)] hover:underline" role="link" tabindex="0" @click.stop="openImportSource(rate)" @keyup.enter.stop="openImportSource(rate)">`
  if (code.includes(singleSourceLink)) {
    code = code.replace(
      singleSourceLink,
      `<span v-if="String(rate.sourceType) !== 'Manual'" class="mt-1 inline-flex items-center gap-1 text-xs font-black text-[var(--dh-primary)] hover:underline" role="link" tabindex="0" @click.stop="openImportSource(rate)" @keyup.enter.stop="openImportSource(rate)">`,
    )
  }

  const bundleSourceLink = `                      <span\n                        class="inline-flex items-center gap-1 text-[11px] font-black text-[var(--dh-primary)] hover:underline"\n                        role="link"\n                        tabindex="0"\n                        @click.stop="openImportSource(line.rate)"\n                        @keyup.enter.stop="openImportSource(line.rate)"\n                      >`
  if (code.includes(bundleSourceLink)) {
    code = code.replace(
      bundleSourceLink,
      `                      <span v-if="String(line.rate.sourceType) === 'Manual'" class="text-[11px] font-black text-[var(--dh-primary)]">Creada manualmente</span>\n                      <span\n                        v-else\n                        class="inline-flex items-center gap-1 text-[11px] font-black text-[var(--dh-primary)] hover:underline"\n                        role="link"\n                        tabindex="0"\n                        @click.stop="openImportSource(line.rate)"\n                        @keyup.enter.stop="openImportSource(line.rate)"\n                      >`,
    )
  }

  // Edición: Pantalla 5 debe conservar como referencia el mismo flete marítimo que
  // originó la tarifa mientras siga vigente. Si venció, no se reutiliza silenciosamente:
  // se informa al usuario y se obliga a escoger otro flete vigente o continuar manual.
  const editSourceStateAnchor = `const fclSelectedImportRateIds = ref<Record<string, string>>({})`
  if (code.includes(editSourceStateAnchor) && !code.includes('editOriginalFreightExpired')) {
    code = code.replace(
      editSourceStateAnchor,
      `${editSourceStateAnchor}\nconst editOriginalFreightExpired = ref(false)\nconst editOriginalFreightValidTo = ref('')\nconst editOriginalFreightExpiryNotified = ref(false)`,
    )
  }

  const comparatorAnchor = `function compareFclCandidateRates(left: ImportRateSelectDto, right: ImportRateSelectDto) {`
  if (code.includes(comparatorAnchor) && !code.includes('sourceImportFclRateId === left.id')) {
    code = code.replace(
      comparatorAnchor,
      `${comparatorAnchor}\n  if (props.rateId && editingRate.value?.sourceImportFclRateId) {\n    const sourceId = editingRate.value.sourceImportFclRateId\n    if (sourceId === left.id && sourceId !== right.id) return -1\n    if (sourceId === right.id && sourceId !== left.id) return 1\n  }`,
    )
  }

  const searchFunctionAnchor = `async function searchApprovedRates() {`
  if (code.includes(searchFunctionAnchor) && !code.includes('async function restoreOriginalFreightForEdit()')) {
    code = code.replace(
      searchFunctionAnchor,
      `async function restoreOriginalFreightForEdit() {\n  editOriginalFreightExpired.value = false\n  editOriginalFreightValidTo.value = ''\n\n  const sourceId = editingRate.value?.sourceImportFclRateId\n  if (!props.rateId || props.viewOnly || shipmentModeForApi.value !== 'Fcl' || !sourceId) return\n\n  try {\n    const sourceRate = await PricingService.getImportRate(sourceId)\n    const validTo = String(sourceRate.validTo ?? '').slice(0, 10)\n    editOriginalFreightValidTo.value = validTo\n\n    if (validTo && validTo < todayIso()) {\n      editOriginalFreightExpired.value = true\n      form.selectedImportRateId = ''\n      selectedFclBundleKey.value = ''\n      fclSelectedImportRateIds.value = {}\n\n      if (!editOriginalFreightExpiryNotified.value) {\n        editOriginalFreightExpiryNotified.value = true\n        toastStore.warning(\n          'El flete marítimo original venció',\n          'Venció el ' + formatDate(sourceRate.validTo) + '. Seleccione otro flete vigente o continúe de manera manual para seguir editando la tarifa.',\n        )\n      }\n      return\n    }\n\n    editOriginalFreightExpiryNotified.value = false\n    const containerTypeId = String(sourceRate.containerTypeId ?? '')\n    const requestedContainer = fclContainerAllocations.value.some((allocation) => allocation.containerTypeId === containerTypeId)\n    if (!containerTypeId || !requestedContainer) return\n\n    const containerRates = fclRatesByContainer.value[containerTypeId] ?? []\n    fclRatesByContainer.value = {\n      ...fclRatesByContainer.value,\n      [containerTypeId]: [sourceRate, ...containerRates.filter((rate) => rate.id !== sourceRate.id)],\n    }\n\n    if (!availableRates.value.some((rate) => rate.id === sourceRate.id)) {\n      availableRates.value = [sourceRate, ...availableRates.value]\n    }\n    void loadImportSources(availableRates.value)\n\n    form.selectedImportRateId = sourceRate.id\n    form.manualRate = false\n    fclSelectedImportRateIds.value = {\n      ...fclSelectedImportRateIds.value,\n      [containerTypeId]: sourceRate.id,\n    }\n\n    const originalBundle = fclRateBundles.value.find((bundle) =>\n      bundle.lines.some((line) => line.rate.id === sourceRate.id),\n    )\n    selectedFclBundleKey.value = originalBundle?.key ?? ''\n  } catch (error) {\n    console.warn('[pricing-edit] No se pudo recuperar el flete marítimo original.', error)\n  }\n}\n\n${searchFunctionAnchor}`,
    )
  }

  const fclSearchReturnAnchor = `    if (!fclRateBundles.value.length) form.manualRate = true\n    return\n  }`
  if (code.includes(fclSearchReturnAnchor) && !code.includes('await restoreOriginalFreightForEdit()\n    if (!fclRateBundles.value.length)')) {
    code = code.replace(
      fclSearchReturnAnchor,
      `    await restoreOriginalFreightForEdit()\n    if (!fclRateBundles.value.length) form.manualRate = true\n    return\n  }`,
    )
  }

  const screenFiveLoadingAnchor = `          <div v-if="loadingRates" class="py-14 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Buscando tarifas vigentes…</div>`
  if (code.includes(screenFiveLoadingAnchor) && !code.includes('data-edit-original-freight-expired')) {
    code = code.replace(
      screenFiveLoadingAnchor,
      `          <div\n            v-if="props.rateId && editOriginalFreightExpired"\n            data-edit-original-freight-expired\n            class="rounded-2xl border border-amber-400/35 bg-amber-400/10 px-4 py-4"\n          >\n            <p class="font-black text-amber-700 dark:text-amber-300">El flete marítimo original venció</p>\n            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-soft)]">\n              El flete utilizado originalmente{{ editOriginalFreightValidTo ? ' venció el ' + formatDate(editOriginalFreightValidTo) : ' ya no está vigente' }}.\n              Para continuar con la edición seleccione una tarifa vigente de esta pantalla o continúe de manera manual.\n            </p>\n          </div>\n\n${screenFiveLoadingAnchor}`,
    )
  }

  return code
}

export function pricingWizardManualFreightFinalUx(): Plugin {
  return {
    name: 'dhole-pricing-wizard-manual-freight-final-ux',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
