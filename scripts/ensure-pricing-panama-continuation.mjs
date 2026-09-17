import { readFile, writeFile } from 'node:fs/promises'

const wizardPath = new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url)

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source
  if (!source.includes(before)) {
    throw new Error(`[pricing-panama-continuation] No se encontró el ancla: ${label}`)
  }
  return source.replace(before, after)
}

let source = await readFile(wizardPath, 'utf8')

source = replaceOnce(
  source,
  "type Modality = 'Maritime' | 'Air' | 'Land' | 'Multimodal'\ntype RateSection =",
  "type Modality = 'Maritime' | 'Air' | 'Land' | 'Multimodal'\ntype PanamaContinuationMode = '' | 'DoubleMaritime' | 'MaritimeLand'\ntype RateSection =",
  'tipo de continuación Panamá',
)

source = replaceOnce(
  source,
  `const availableRates = ref<ImportRateSelectDto[]>([])\nconst importSourceByBatch`,
  `const availableRates = ref<ImportRateSelectDto[]>([])\nconst continuationRates = ref<ImportRateSelectDto[]>([])\nconst loadingContinuationRates = ref(false)\nconst panamaLandFreightAmount = ref(0)\nconst importSourceByBatch`,
  'estado de tarifas de continuación',
)

source = replaceOnce(
  source,
  `  destinationId: '',\n  podId: '',\n  equipmentSize: '',`,
  `  destinationId: '',\n  podId: '',\n  panamaContinuationMode: '' as PanamaContinuationMode,\n  selectedContinuationImportRateId: '',\n  equipmentSize: '',`,
  'campos del formulario Panamá',
)

source = replaceOnce(
  source,
  `const selectedDestination = computed(() => findById(catalogs.poe, form.destinationId))\nconst selectedPod = computed(() => findById(catalogs.pod, form.podId))\nconst selectedEquipment`,
  `const selectedDestination = computed(() => findById(catalogs.poe, form.destinationId))\nconst selectedPod = computed(() => findById(catalogs.pod, form.podId))\n\nfunction isMultimodalViaPanama(item?: CatalogItemSelectDto | null) {\n  if (!item) return false\n  const text = normalizeCatalogValue(\n    [displayValue(item), item.label, item.code, item.slug].filter(Boolean).join(' '),\n  )\n  return text.includes('multimodal') && text.includes('panama')\n}\n\nfunction isPanamaLocation(item?: CatalogItemSelectDto | null) {\n  if (!item) return false\n  const configuredCountry = String(metadata(item)?.countryCode ?? '').trim().toUpperCase()\n  if (configuredCountry === 'PA') return true\n  const code = String(item.code ?? '').trim().toUpperCase()\n  const text = normalizeCatalogValue(\n    [displayValue(item), item.label, item.code, item.slug].filter(Boolean).join(' '),\n  )\n  return code === 'PA' || code.startsWith('PA') || text.includes('panama')\n}\n\nconst isPanamaMultimodal = computed(() => isMultimodalViaPanama(selectedDestination.value))\nconst selectedEquipment`,
  'detección Multimodal Via Panamá',
)

source = replaceOnce(
  source,
  `const destinationCountryCode = computed(() => {\n  const configured = String(metadata(selectedDestination.value)?.countryCode ?? '').trim().toUpperCase()\n  if (configured) return configured\n  if (isCostaRica(selectedDestination.value)) return 'CR'\n  const destination = normalizeCatalogValue([\n    displayValue(selectedDestination.value),\n    selectedDestination.value?.label,\n    selectedDestination.value?.code,\n    selectedDestination.value?.slug,\n  ].filter(Boolean).join(' '))\n  if (destination.includes('panama')) return 'PA'\n  if (destination.includes('guatemala')) return 'GT'\n  return ''\n})`,
  `const destinationTaxLocation = computed(() =>\n  isPanamaMultimodal.value && selectedPod.value ? selectedPod.value : selectedDestination.value,\n)\nconst destinationCountryCode = computed(() => {\n  const target = destinationTaxLocation.value\n  const configured = String(metadata(target)?.countryCode ?? '').trim().toUpperCase()\n  if (configured) return configured\n  if (isCostaRica(target)) return 'CR'\n  const destination = normalizeCatalogValue([\n    displayValue(target),\n    target?.label,\n    target?.code,\n    target?.slug,\n  ].filter(Boolean).join(' '))\n  if (destination.includes('panama')) return 'PA'\n  if (destination.includes('guatemala')) return 'GT'\n  if (destination.includes('honduras')) return 'HN'\n  if (destination.includes('salvador')) return 'SV'\n  if (destination.includes('nicaragua')) return 'NI'\n  return ''\n})`,
  'país final para IVA',
)

source = replaceOnce(
  source,
  `const selectedImportRate = computed(() => availableRates.value.find((rate) => rate.id === form.selectedImportRateId) ?? null)\n\nfunction resolvedImportSource`,
  `const selectedImportRate = computed(() => availableRates.value.find((rate) => rate.id === form.selectedImportRateId) ?? null)\nconst selectedContinuationRate = computed(() =>\n  continuationRates.value.find((rate) => rate.id === form.selectedContinuationImportRateId) ?? null,\n)\nconst selectedPanamaGatewayPoe = computed(() => {\n  const sourceRate = selectedImportRate.value\n  if (sourceRate) {\n    const byId = sourceRate.poeId ? findById(catalogs.poe, sourceRate.poeId) : null\n    return byId ?? findEquivalentValue(catalogs.poe, sourceRate.poe)\n  }\n  if (editingRate.value && isPanamaMultimodal.value) {\n    return findById(catalogs.poe, editingRate.value.poeId)\n      ?? findEquivalentValue(catalogs.poe, editingRate.value.poeName)\n  }\n  return null\n})\nconst selectedPanamaGatewayPol = computed(() => {\n  const sourceRate = selectedImportRate.value\n  if (sourceRate) {\n    const byId = sourceRate.poeId ? findById(catalogs.pol, sourceRate.poeId) : null\n    return byId ?? findEquivalentValue(catalogs.pol, sourceRate.poe)\n  }\n  const gateway = selectedPanamaGatewayPoe.value\n  return gateway ? findEquivalent(catalogs.pol, gateway) : null\n})\nconst effectivePricingPoeId = computed(() =>\n  isPanamaMultimodal.value ? (selectedPanamaGatewayPoe.value?.id ?? form.destinationId) : form.destinationId,\n)\n\nfunction resolvedImportSource`,
  'tarifa y gateway de continuación',
)

source = replaceOnce(
  source,
  `const sortedAvailableRates = computed(() =>\n  [...availableRates.value].sort((left, right) => {\n    const price = number(left.freight) - number(right.freight)\n    if (price !== 0) return price\n    const comment = rateCommentRank(right.spaceComment) - rateCommentRank(left.spaceComment)\n    if (comment !== 0) return comment\n    return new Date(right.validTo).getTime() - new Date(left.validTo).getTime()\n  }),\n)`,
  `const sortImportRates = (rates: ImportRateSelectDto[]) =>\n  [...rates].sort((left, right) => {\n    const price = number(left.freight) - number(right.freight)\n    if (price !== 0) return price\n    const comment = rateCommentRank(right.spaceComment) - rateCommentRank(left.spaceComment)\n    if (comment !== 0) return comment\n    return new Date(right.validTo).getTime() - new Date(left.validTo).getTime()\n  })\nconst sortedAvailableRates = computed(() => sortImportRates(availableRates.value))\nconst sortedContinuationRates = computed(() => sortImportRates(continuationRates.value))`,
  'ordenamiento de tramos marítimos',
)

source = replaceOnce(
  source,
  `      form.originId &&\n      form.destinationId &&\n      selectedEquipment.value &&`,
  `      form.originId &&\n      form.destinationId &&\n      (!isPanamaMultimodal.value || Boolean(form.podId && form.panamaContinuationMode)) &&\n      selectedEquipment.value &&`,
  'validación de ruta Panamá',
)

source = replaceOnce(
  source,
  `  if (cost.poeId && cost.poeId !== form.destinationId) return false`,
  `  if (cost.poeId && cost.poeId !== effectivePricingPoeId.value) return false`,
  'POE efectivo en costos',
)

source = replaceOnce(
  source,
  `      : cost.portRole === 'Poe'\n        ? cost.portId === form.destinationId\n        : cost.portRole === 'Pod'\n          ? cost.portId === form.podId\n          : [form.originId, form.destinationId, form.podId].includes(cost.portId)`,
  `      : cost.portRole === 'Poe'\n        ? cost.portId === effectivePricingPoeId.value\n        : cost.portRole === 'Pod'\n          ? cost.portId === form.podId\n          : [form.originId, effectivePricingPoeId.value, form.podId].includes(cost.portId)`,
  'puerto efectivo en costos legacy',
)

source = replaceOnce(
  source,
  `      poeId: form.destinationId || undefined,`,
  `      poeId: effectivePricingPoeId.value || undefined,`,
  'consulta de costos por POE efectivo',
)

source = replaceOnce(
  source,
  `  if (visible.has('international_freight')) {\n    lines.push({\n      key: 'freight',\n      section: 'international_freight',\n      name: 'Flete Internacional',\n      costDetailType: 'Freight',\n      costType: 'Variable',\n      chargeBasis: defaultChargeBasis('Freight'),\n      currencyId: currency.id,\n      currencyName: displayValue(currency),\n      currencyCode: currency.code,\n      costAmount: number(form.freightCost),\n      saleAmount: number(form.freightSale),\n      included: true,\n      optional: false,\n      manual: false,\n    })\n  }\n\n  const configuredCosts`,
  `  if (visible.has('international_freight')) {\n    lines.push({\n      key: 'freight',\n      section: 'international_freight',\n      name: 'Flete Internacional',\n      costDetailType: 'Freight',\n      costType: 'Variable',\n      chargeBasis: defaultChargeBasis('Freight'),\n      currencyId: currency.id,\n      currencyName: displayValue(currency),\n      currencyCode: currency.code,\n      costAmount: number(form.freightCost),\n      saleAmount: number(form.freightSale),\n      included: true,\n      optional: false,\n      manual: false,\n    })\n\n    if (isPanamaMultimodal.value && form.panamaContinuationMode === 'DoubleMaritime' && selectedContinuationRate.value) {\n      const continuation = selectedContinuationRate.value\n      const continuationCurrency = findById(catalogs.currencies, continuation.currencyId)\n      const finalDestination = selectedPod.value ? displayValue(selectedPod.value) : continuation.poe\n      lines.push({\n        key: 'panama-continuation:maritime',\n        section: 'international_freight',\n        name: 'Segundo flete marítimo',\n        costDetailType: 'Freight',\n        costType: 'Variable',\n        chargeBasis: defaultChargeBasis('Freight'),\n        contextLabel: \`Segundo tramo: \${continuation.pol} → \${finalDestination} · Naviera: \${continuation.carrier}\`,\n        notes: \`DHOLE_PANAMA_CONTINUATION:\${continuation.id} · \${continuation.pol} → \${continuation.poe} · \${continuation.carrier}\`,\n        currencyId: continuation.currencyId,\n        currencyName: displayValue(continuationCurrency) || continuation.currency,\n        currencyCode: continuation.currencyCode || continuation.currency,\n        costAmount: number(continuation.oceanFreight ?? continuation.freight),\n        saleAmount: number(continuation.totalSale ?? continuation.oceanFreight ?? continuation.freight),\n        included: true,\n        optional: false,\n        manual: false,\n      })\n    }\n\n    if (isPanamaMultimodal.value && form.panamaContinuationMode === 'MaritimeLand' && panamaLandFreightAmount.value > 0) {\n      const landCurrency = usdCurrency.value ?? currency\n      const gateway = selectedPanamaGatewayPoe.value\n      const finalDestination = selectedPod.value\n      lines.push({\n        key: 'panama-continuation:land',\n        section: 'international_freight',\n        name: 'Flete terrestre internacional',\n        costDetailType: 'InlandTransport',\n        costType: 'Variable',\n        chargeBasis: defaultChargeBasis('Freight'),\n        contextLabel: \`Tramo terrestre: \${gateway ? displayValue(gateway) : 'Panamá'} → \${finalDestination ? displayValue(finalDestination) : 'destino final'}\`,\n        notes: 'Aplicado automáticamente por la alternativa Marítimo-Terrestre vía Panamá.',\n        currencyId: landCurrency.id,\n        currencyName: displayValue(landCurrency),\n        currencyCode: landCurrency.code,\n        costAmount: panamaLandFreightAmount.value,\n        saleAmount: panamaLandFreightAmount.value,\n        included: true,\n        optional: false,\n        manual: false,\n      })\n    }\n  }\n\n  const configuredCosts`,
  'líneas de continuación Panamá',
)

source = replaceOnce(
  source,
  `async function searchApprovedRates() {\n  availableRates.value = []\n  form.selectedImportRateId = ''\n  form.manualRate = false\n\n  if (shipmentModeForApi.value !== 'Fcl' || !selectedOrigin.value || !selectedDestination.value || !selectedEquipment.value) {\n    form.manualRate = true\n    return\n  }\n\n  try {\n    loadingRates.value = true\n    const query: BrowseImportRatesQuery = {\n      pol: catalogSearchText(selectedOrigin.value),\n      poe: catalogSearchText(selectedDestination.value),\n      pod: selectedPod.value ? catalogSearchText(selectedPod.value) : undefined,\n      containerType: catalogSearchText(selectedEquipment.value),\n      quoteDate: form.loadDate,\n    }\n    availableRates.value = await PricingService.selectImportRates(query)\n    await loadImportSources(availableRates.value)\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudieron consultar las tarifas aprobadas.')\n  } finally {\n    loadingRates.value = false\n  }\n\n  if (!availableRates.value.length) form.manualRate = true\n}\n\nfunction chooseRate(rate: ImportRateSelectDto) {\n  form.selectedImportRateId = rate.id\n  form.manualRate = false\n  form.freightCost = number(rate.freight)\n  form.freightSale = number(rate.totalSale ?? rate.freight)\n  form.freeDays = number(rate.freeDays)\n  form.transitDays = number(rate.transitDays)\n\n  const ratePod = rate.podId\n    ? findById(catalogs.pod, rate.podId)\n    : findEquivalentValue(catalogs.pod, rate.pod)\n  if (ratePod) form.podId = ratePod.id\n\n  const rateCarrier = normalizeCatalogValue(String(rate.carrier ?? ''))\n  const carrier = catalogs.carriers.find((item) =>\n    normalizeCatalogValue(displayValue(item)).includes(rateCarrier),\n  )\n  if (carrier) form.carrierId = carrier.id\n\n  const rateCurrency = normalizeCatalogValue(String(rate.currency ?? ''))\n  const currency = catalogs.currencies.find((item) =>\n    normalizeCatalogValue(displayValue(item)).includes(rateCurrency),\n  )\n  if (currency) form.currencyId = currency.id\n\n  step.value = 6\n}\n\nfunction continueManual() {`,
  `async function searchApprovedRates() {\n  availableRates.value = []\n  continuationRates.value = []\n  form.selectedImportRateId = ''\n  form.selectedContinuationImportRateId = ''\n  panamaLandFreightAmount.value = 0\n  form.manualRate = false\n\n  if (shipmentModeForApi.value !== 'Fcl' || !selectedOrigin.value || !selectedDestination.value || !selectedEquipment.value) {\n    form.manualRate = true\n    return\n  }\n\n  if (isPanamaMultimodal.value && (!selectedPod.value || !form.panamaContinuationMode)) {\n    form.manualRate = true\n    toastStore.warning('Complete la continuación vía Panamá', 'Seleccione el POD final y si continuará por doble marítimo o marítimo-terrestre.')\n    return\n  }\n\n  try {\n    loadingRates.value = true\n    const query: BrowseImportRatesQuery = {\n      pol: catalogSearchText(selectedOrigin.value),\n      containerType: catalogSearchText(selectedEquipment.value),\n      quoteDate: form.loadDate,\n    }\n\n    if (isPanamaMultimodal.value) {\n      const candidates = await PricingService.selectImportRates(query)\n      availableRates.value = candidates.filter((rate) => {\n        const poeItem = rate.poeId ? findById(catalogs.poe, rate.poeId) : null\n        return isPanamaLocation(poeItem)\n          || normalizeCatalogValue(\`\${rate.poe} \${rate.poeCode}\`).includes('panama')\n      })\n    } else {\n      availableRates.value = await PricingService.selectImportRates({\n        ...query,\n        poe: catalogSearchText(selectedDestination.value),\n        pod: selectedPod.value ? catalogSearchText(selectedPod.value) : undefined,\n      })\n    }\n    await loadImportSources(availableRates.value)\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudieron consultar las tarifas aprobadas.')\n  } finally {\n    loadingRates.value = false\n  }\n\n  if (!availableRates.value.length) form.manualRate = true\n}\n\nasync function searchPanamaContinuationRates(firstLeg: ImportRateSelectDto) {\n  continuationRates.value = []\n  form.selectedContinuationImportRateId = ''\n  if (!selectedPod.value || !selectedEquipment.value) return\n\n  try {\n    loadingContinuationRates.value = true\n    const gatewayPol = (firstLeg.poeId ? findById(catalogs.pol, firstLeg.poeId) : null)\n      ?? findEquivalentValue(catalogs.pol, firstLeg.poe)\n    const gatewayName = gatewayPol ? catalogSearchText(gatewayPol) : firstLeg.poe\n    const finalDestination = catalogSearchText(selectedPod.value)\n    const candidates = await PricingService.selectImportRates({\n      pol: gatewayName,\n      containerType: catalogSearchText(selectedEquipment.value),\n      quoteDate: form.loadDate,\n    })\n\n    continuationRates.value = candidates.filter((rate) => {\n      if (rate.id === firstLeg.id) return false\n      const poeScore = valueMatchScore(rate.poe, finalDestination)\n      const podScore = valueMatchScore(rate.pod, finalDestination)\n      return Math.max(poeScore, podScore) >= 0.75\n    })\n    await loadImportSources(continuationRates.value)\n\n    if (!continuationRates.value.length) {\n      toastStore.warning(\n        'Sin segundo flete marítimo',\n        \`No hay una tarifa marítima aprobada desde \${gatewayName} hacia \${finalDestination} para el equipo y fecha seleccionados.\`,\n      )\n    }\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudo buscar el segundo flete marítimo desde Panamá.')\n  } finally {\n    loadingContinuationRates.value = false\n  }\n}\n\nasync function loadPanamaLandFreight() {\n  panamaLandFreightAmount.value = 0\n  try {\n    const dashboard = await PricingService.getDecisionDashboard({\n      containerType: selectedEquipment.value ? catalogSearchText(selectedEquipment.value) : undefined,\n    })\n    panamaLandFreightAmount.value = number(dashboard.multimodalInternationalLandFreight)\n    if (panamaLandFreightAmount.value <= 0) {\n      toastStore.warning(\n        'Flete terrestre no configurado',\n        'Pricing no devolvió un flete terrestre internacional para la alternativa vía Panamá.',\n      )\n    }\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudo obtener el flete terrestre internacional vía Panamá.')\n  }\n}\n\nasync function chooseRate(rate: ImportRateSelectDto) {\n  form.selectedImportRateId = rate.id\n  form.selectedContinuationImportRateId = ''\n  continuationRates.value = []\n  panamaLandFreightAmount.value = 0\n  form.manualRate = false\n  form.freightCost = number(rate.oceanFreight ?? rate.freight)\n  form.freightSale = number(rate.totalSale ?? rate.oceanFreight ?? rate.freight)\n  form.freeDays = number(rate.freeDays)\n  form.transitDays = number(rate.transitDays)\n\n  if (!isPanamaMultimodal.value) {\n    const ratePod = rate.podId\n      ? findById(catalogs.pod, rate.podId)\n      : findEquivalentValue(catalogs.pod, rate.pod)\n    if (ratePod) form.podId = ratePod.id\n  }\n\n  const rateCarrier = normalizeCatalogValue(String(rate.carrier ?? ''))\n  const carrier = catalogs.carriers.find((item) =>\n    normalizeCatalogValue(displayValue(item)).includes(rateCarrier),\n  )\n  if (carrier) form.carrierId = carrier.id\n\n  const rateCurrency = normalizeCatalogValue(String(rate.currency ?? ''))\n  const currency = catalogs.currencies.find((item) =>\n    normalizeCatalogValue(displayValue(item)).includes(rateCurrency),\n  )\n  if (currency) form.currencyId = currency.id\n\n  if (isPanamaMultimodal.value && form.panamaContinuationMode === 'DoubleMaritime') {\n    await searchPanamaContinuationRates(rate)\n    return\n  }\n\n  if (isPanamaMultimodal.value && form.panamaContinuationMode === 'MaritimeLand') {\n    await loadPanamaLandFreight()\n    if (panamaLandFreightAmount.value <= 0) return\n  }\n\n  step.value = 6\n}\n\nfunction chooseContinuationRate(rate: ImportRateSelectDto) {\n  form.selectedContinuationImportRateId = rate.id\n  form.transitDays = number(selectedImportRate.value?.transitDays) + number(rate.transitDays)\n  step.value = 6\n}\n\nfunction continueManual() {`,
  'búsqueda de tramos vía Panamá',
)

source = replaceOnce(
  source,
  `function modalityForRate(rate: RateDto): Modality {\n  if (rate.shipmentMode === 'Ftl' || rate.shipmentMode === 'Ltl') return 'Land'\n  if (rate.shipmentMode === 'Fcl' || rate.shipmentMode === 'Lcl') return 'Maritime'\n  return 'Multimodal'\n}`,
  `function continuationModeFromRate(rate: RateDto): PanamaContinuationMode {\n  const details = rate.rateDetails ?? []\n  if (details.some((detail) =>\n    normalizeCatalogValue(\`\${detail.name} \${detail.notes ?? ''}\`).includes('segundo flete maritimo')\n    || String(detail.notes ?? '').includes('DHOLE_PANAMA_CONTINUATION:'),\n  )) return 'DoubleMaritime'\n  if (details.some((detail) =>\n    normalizeCatalogValue(detail.name).includes('flete terrestre internacional'),\n  )) return 'MaritimeLand'\n  return ''\n}\n\nfunction modalityForRate(rate: RateDto): Modality {\n  if (continuationModeFromRate(rate)) return 'Multimodal'\n  if (rate.shipmentMode === 'Ftl' || rate.shipmentMode === 'Ltl') return 'Land'\n  if (rate.shipmentMode === 'Fcl' || rate.shipmentMode === 'Lcl') return 'Maritime'\n  return 'Multimodal'\n}`,
  'detección de multimodal al editar',
)

source = replaceOnce(
  source,
  `    const modality = modalityForRate(rate)\n    const equipment =`,
  `    const modality = modalityForRate(rate)\n    const continuationMode = continuationModeFromRate(rate)\n    const equipment =`,
  'modo de continuación al hidratar',
)

source = replaceOnce(
  source,
  `    form.originId = rate.polId\n    form.destinationId = rate.poeId\n    form.podId = rate.podId ?? ''\n    form.equipmentId`,
  `    form.originId = rate.polId\n    const syntheticPanamaPoe = continuationMode\n      ? catalogs.poe.find((item) => isMultimodalViaPanama(item))\n      : null\n    form.destinationId = syntheticPanamaPoe?.id ?? rate.poeId\n    form.podId = rate.podId ?? ''\n    form.panamaContinuationMode = continuationMode\n    form.selectedContinuationImportRateId = ''\n    form.equipmentId`,
  'ruta multimodal al hidratar',
)

source = replaceOnce(
  source,
  `  const origin = selectedOrigin.value\n  const poe = selectedDestination.value\n  const pod = resolvePodForDestination()`,
  `  const origin = selectedOrigin.value\n  const poe = isPanamaMultimodal.value\n    ? (selectedPanamaGatewayPoe.value ?? selectedDestination.value)\n    : selectedDestination.value\n  const pod = resolvePodForDestination()`,
  'POE real de Panamá al guardar',
)

source = replaceOnce(
  source,
  `  if (!currency) missing.push('moneda')\n\n  if (missing.length) {`,
  `  if (!currency) missing.push('moneda')\n  if (isPanamaMultimodal.value && !form.panamaContinuationMode) missing.push('tipo de continuación vía Panamá')\n  if (\n    !editingRate.value\n    && isPanamaMultimodal.value\n    && form.panamaContinuationMode === 'DoubleMaritime'\n    && !selectedContinuationRate.value\n  ) missing.push('segundo flete marítimo Panamá → destino final')\n  if (\n    !editingRate.value\n    && isPanamaMultimodal.value\n    && form.panamaContinuationMode === 'MaritimeLand'\n    && panamaLandFreightAmount.value <= 0\n  ) missing.push('flete terrestre internacional Panamá → destino final')\n\n  if (missing.length) {`,
  'validación de continuación al guardar',
)

source = replaceOnce(
  source,
  `  availableRates.value = []\n  rateLines.value = []\n  supportEntityId.value`,
  `  availableRates.value = []\n  continuationRates.value = []\n  panamaLandFreightAmount.value = 0\n  rateLines.value = []\n  supportEntityId.value`,
  'reset de tarifas de continuación',
)

source = replaceOnce(
  source,
  `    destinationId: '',\n    podId: '',\n    equipmentSize: '',`,
  `    destinationId: '',\n    podId: '',\n    panamaContinuationMode: '',\n    selectedContinuationImportRateId: '',\n    equipmentSize: '',`,
  'reset del formulario Panamá',
)

source = replaceOnce(
  source,
  `watch(\n  () => form.destinationId,\n  () => {\n    const equivalent = findEquivalent(catalogs.pod, selectedDestination.value)\n    form.podId = equivalent?.id ?? ''\n  },\n)`,
  `watch(\n  () => form.destinationId,\n  () => {\n    if (hydratingExistingRate.value) return\n    continuationRates.value = []\n    form.selectedContinuationImportRateId = ''\n    panamaLandFreightAmount.value = 0\n    if (isPanamaMultimodal.value) return\n    form.panamaContinuationMode = ''\n    const equivalent = findEquivalent(catalogs.pod, selectedDestination.value)\n    form.podId = equivalent?.id ?? ''\n  },\n)\n\nwatch(\n  () => form.panamaContinuationMode,\n  () => {\n    if (hydratingExistingRate.value) return\n    continuationRates.value = []\n    form.selectedContinuationImportRateId = ''\n    panamaLandFreightAmount.value = 0\n  },\n)\n\nwatch(\n  () => form.podId,\n  () => {\n    if (hydratingExistingRate.value || !isPanamaMultimodal.value) return\n    continuationRates.value = []\n    form.selectedContinuationImportRateId = ''\n    panamaLandFreightAmount.value = 0\n  },\n)`,
  'watchers de ruta Panamá',
)

source = replaceOnce(
  source,
  `            </div>\n\n            <!-- Fila 3: tamaño, tipo y cantidad del equipo. -->`,
  `            </div>\n\n            <div v-if="isPanamaMultimodal" class="rounded-[22px] border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[rgb(var(--dh-primary-rgb)/0.06)] p-4 md:p-5">\n              <div>\n                <p class="font-black">Continuación desde Panamá</p>\n                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">\n                  El POE real de la tarifa seleccionada en Panamá se convertirá en el punto de salida del segundo tramo. Seleccione cómo llegará la carga al POD final.\n                </p>\n              </div>\n              <div class="mt-4 grid gap-3 md:grid-cols-2">\n                <button\n                  type="button"\n                  class="crystal-choice min-h-[128px]"\n                  :class="form.panamaContinuationMode === 'DoubleMaritime' ? 'crystal-choice--active' : ''"\n                  @click="form.panamaContinuationMode = 'DoubleMaritime'"\n                >\n                  <Ship class="h-5 w-5 text-[var(--dh-primary)]" />\n                  <span class="mt-3 block text-base font-black">Doble marítimo</span>\n                  <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">Panamá pasa a ser el POL del segundo flete marítimo y el POD seleccionado se usa como destino de ese tramo.</span>\n                  <Check v-if="form.panamaContinuationMode === 'DoubleMaritime'" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />\n                </button>\n                <button\n                  type="button"\n                  class="crystal-choice min-h-[128px]"\n                  :class="form.panamaContinuationMode === 'MaritimeLand' ? 'crystal-choice--active' : ''"\n                  @click="form.panamaContinuationMode = 'MaritimeLand'"\n                >\n                  <Truck class="h-5 w-5 text-[var(--dh-primary)]" />\n                  <span class="mt-3 block text-base font-black">Marítimo-terrestre</span>\n                  <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">Desde Panamá se aplica el flete terrestre internacional configurado en Pricing para mover la carga hacia Centroamérica.</span>\n                  <Check v-if="form.panamaContinuationMode === 'MaritimeLand'" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />\n                </button>\n              </div>\n              <p v-if="!form.podId" class="mt-3 text-xs font-bold text-amber-600">Seleccione el POD final para definir el segundo tramo.</p>\n            </div>\n\n            <!-- Fila 3: tamaño, tipo y cantidad del equipo. -->`,
  'selector visual de continuación',
)

source = replaceOnce(
  source,
  `            <h2 class="crystal-title">Tarifas pre-aprobadas disponibles</h2>\n            <p class="crystal-description">La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.</p>`,
  `            <h2 class="crystal-title">{{ isPanamaMultimodal ? 'Primer tramo marítimo hasta Panamá' : 'Tarifas pre-aprobadas disponibles' }}</h2>\n            <p class="crystal-description">\n              {{ isPanamaMultimodal\n                ? 'Primero seleccione el flete marítimo hasta un POE real en Panamá. Después Dhole resolverá el segundo tramo según la alternativa elegida.'\n                : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.' }}\n            </p>`,
  'encabezado de Pantalla 5',
)

source = replaceOnce(
  source,
  `            <div class="flex justify-end">\n              <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>\n            </div>`,
  `            <div v-if="!isPanamaMultimodal" class="flex justify-end">\n              <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>\n            </div>\n\n            <div\n              v-if="isPanamaMultimodal && form.panamaContinuationMode === 'DoubleMaritime' && form.selectedImportRateId"\n              class="crystal-soft space-y-4 p-4 md:p-5"\n            >\n              <div>\n                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Tramo 2</p>\n                <h3 class="mt-1 text-lg font-black">Segundo flete marítimo desde Panamá</h3>\n                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">\n                  {{ selectedImportRate?.poe || 'POE Panamá' }} se usa como POL y {{ displayValue(selectedPod) || 'el POD seleccionado' }} como destino del segundo tramo.\n                </p>\n              </div>\n              <div v-if="loadingContinuationRates" class="py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Buscando segundo flete marítimo…</div>\n              <div v-else-if="sortedContinuationRates.length" class="grid gap-4 lg:grid-cols-2">\n                <button\n                  v-for="rate in sortedContinuationRates"\n                  :key="\`continuation:\${rate.id}\`"\n                  type="button"\n                  class="crystal-rate-card"\n                  :class="form.selectedContinuationImportRateId === rate.id ? 'crystal-rate-card--active' : ''"\n                  @click="chooseContinuationRate(rate)"\n                >\n                  <div class="flex items-start justify-between gap-3">\n                    <div>\n                      <p class="font-black">{{ rate.carrier }}</p>\n                      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ rate.pol }} → {{ rate.poe || rate.pod }} · {{ rate.containerType }}</p>\n                    </div>\n                    <DhBadge variant="primary">Tramo 2</DhBadge>\n                  </div>\n                  <p class="mt-5 text-2xl font-black">{{ formatMoney(rate.freight, displayValue(findById(catalogs.currencies, rate.currencyId)) || rate.currency || 'USD') }}</p>\n                  <p v-if="rate.spaceComment" class="mt-3 text-left text-xs font-semibold text-[var(--dh-text-muted)]">Comentario: {{ rate.spaceComment }}</p>\n                  <p class="mt-3 text-left text-[11px] font-bold text-[var(--dh-text-muted)]">Fuente: {{ importSourceTitle(rate) }}</p>\n                </button>\n              </div>\n              <div v-else class="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-bold">\n                No existe un segundo flete marítimo aprobado para esta combinación. Revise el POD, equipo o fecha de carga.\n              </div>\n            </div>`,
  'selección del segundo tramo en Pantalla 5',
)

source = replaceOnce(
  source,
  `              <DhButton :disabled="saving" @click="saveOpenRequest">{{ saving ? 'Guardando…' : 'Guardar solicitud abierta' }}</DhButton>\n              <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>`,
  `              <DhButton :disabled="saving" @click="saveOpenRequest">{{ saving ? 'Guardando…' : 'Guardar solicitud abierta' }}</DhButton>\n              <DhButton v-if="!isPanamaMultimodal" variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>`,
  'manual deshabilitado para multimodal sin tarifa',
)

source = replaceOnce(
  source,
  `          <div class="crystal-route-summary grid gap-3 md:grid-cols-4">`,
  `          <div v-if="isPanamaMultimodal" class="crystal-soft p-4 md:p-5">\n            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Continuación vía Panamá</p>\n            <div v-if="form.panamaContinuationMode === 'DoubleMaritime' && selectedContinuationRate" class="mt-2">\n              <p class="font-black">Doble marítimo</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ selectedContinuationRate.pol }} → {{ selectedContinuationRate.poe || displayValue(selectedPod) }} · {{ selectedContinuationRate.carrier }}</p>\n              <p class="mt-2 text-sm font-black">{{ formatMoney(selectedContinuationRate.freight, selectedContinuationRate.currency || 'USD') }}</p>\n            </div>\n            <div v-else-if="form.panamaContinuationMode === 'MaritimeLand'" class="mt-2">\n              <p class="font-black">Marítimo-terrestre</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ selectedImportRate?.poe || displayValue(selectedPanamaGatewayPoe) || 'Panamá' }} → {{ displayValue(selectedPod) }} por flete terrestre internacional.</p>\n              <p class="mt-2 text-sm font-black">{{ formatMoney(panamaLandFreightAmount, 'USD') }}</p>\n            </div>\n          </div>\n\n          <div class="crystal-route-summary grid gap-3 md:grid-cols-4">`,
  'resumen de continuación en Pantalla 6',
)

source = replaceOnce(
  source,
  `              <p class="mt-4 text-sm font-bold">{{ displayValue(selectedOrigin) }} → {{ displayValue(selectedDestination) }}<span v-if="selectedPod"> → {{ displayValue(selectedPod) }}</span></p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ direction }} · {{ form.modality }} · {{ form.shipmentMode }} · {{ displayValue(selectedEquipment) }} · {{ displayValue(selectedIncoterm) }}</p>`,
  `              <p class="mt-4 text-sm font-bold">{{ displayValue(selectedOrigin) }} → {{ isPanamaMultimodal ? (selectedImportRate?.poe || displayValue(selectedPanamaGatewayPoe) || 'Panamá') : displayValue(selectedDestination) }}<span v-if="selectedPod"> → {{ displayValue(selectedPod) }}</span></p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ direction }} · {{ form.modality }} · {{ form.shipmentMode }} · {{ displayValue(selectedEquipment) }} · {{ displayValue(selectedIncoterm) }}</p>\n              <p v-if="isPanamaMultimodal" class="mt-1 text-xs font-black text-[var(--dh-primary)]">{{ form.panamaContinuationMode === 'DoubleMaritime' ? 'Continuación: doble marítimo' : 'Continuación: marítimo-terrestre' }}</p>`,
  'resumen de ruta en borrador',
)

await writeFile(wizardPath, source, 'utf8')
console.log('[pricing-panama-continuation] Wizard actualizado')
