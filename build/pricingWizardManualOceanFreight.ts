import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardManualOceanFreight] Expected one ${label} anchor, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  const stateAnchor = 'const downloadingQuote = ref(false)'
  code = replaceRequired(
    code,
    stateAnchor,
    `${stateAnchor}\nconst savingManualOceanFreight = ref(false)\nconst manualOceanFreightComment = ref('')\nconst manualOceanFreightSavedId = ref('')\nconst savedManualOceanFreightFingerprint = ref('')`,
    'manual ocean freight state',
  )

  const saveRateAnchor = 'async function saveRate() {'
  const helperCode = `function manualOceanFreightSnapshot(item: CatalogItemSelectDto | null | undefined) {\n  if (!item?.id) return null\n  const name = String(displayValue(item) || item.label || item.code || item.id).trim()\n  const code = String(item.code || name || item.id).trim()\n  const slug = String(item.slug || code || item.id).trim()\n  return { id: item.id, name, code, slug }\n}\n\nasync function saveManualOceanFreight() {\n  if (savingManualOceanFreight.value) return\n\n  if (shipmentModeForApi.value !== 'Fcl' || !['Maritime', 'Multimodal'].includes(String(form.modality))) {\n    toastStore.error('Guardado no disponible', 'El guardado de flete marítimo manual aplica a embarques FCL marítimos o multimodales.')\n    return\n  }\n\n  const origin = selectedOrigin.value\n  const destination = selectedDestination.value\n  const pod = resolvePodForDestination() ?? destination\n  const agent = findById(catalogs.agents, form.agentId)\n  const carrier = findById(catalogs.carriers, form.carrierId)\n  const equipment = selectedEquipment.value\n  const currency = findById(catalogs.currencies, form.currencyId)\n  const cost = number(form.freightCost)\n  const saleInput = number(form.freightSale)\n  const sale = saleInput > 0 ? saleInput : cost\n  const comment = manualOceanFreightComment.value.trim()\n\n  if (!origin || !destination || !pod || !agent || !carrier || !equipment || !currency) {\n    toastStore.error('Faltan datos', 'Seleccione POL, POE/POD, equipo, agente, naviera y moneda antes de guardar el flete marítimo.')\n    return\n  }\n  if (cost <= 0) {\n    toastStore.error('Flete inválido', 'Ingrese un costo de flete marítimo mayor que cero.')\n    return\n  }\n  if (!form.loadDate || !form.validTo || new Date(form.validTo).getTime() < new Date(form.loadDate).getTime()) {\n    toastStore.error('Vigencia inválida', 'La vigencia final de la tarifa debe ser igual o posterior a la fecha inicial.')\n    return\n  }\n\n  const originSnapshot = manualOceanFreightSnapshot(origin)\n  const destinationSnapshot = manualOceanFreightSnapshot(destination)\n  const podSnapshot = manualOceanFreightSnapshot(pod)\n  const agentSnapshot = manualOceanFreightSnapshot(agent)\n  const carrierSnapshot = manualOceanFreightSnapshot(carrier)\n  const equipmentSnapshot = manualOceanFreightSnapshot(equipment)\n  const currencySnapshot = manualOceanFreightSnapshot(currency)\n  if (!originSnapshot || !destinationSnapshot || !podSnapshot || !agentSnapshot || !carrierSnapshot || !equipmentSnapshot || !currencySnapshot) return\n\n  const fingerprint = [\n    originSnapshot.id, destinationSnapshot.id, podSnapshot.id, agentSnapshot.id, carrierSnapshot.id,\n    equipmentSnapshot.id, currencySnapshot.id, String(cost), String(sale), form.loadDate, form.validTo, comment,\n  ].join('|')\n  if (savedManualOceanFreightFingerprint.value === fingerprint && manualOceanFreightSavedId.value) {\n    toastStore.success('Flete marítimo ya guardado', 'No se creó un duplicado porque los datos no han cambiado.')\n    return\n  }\n\n  const profit = sale - cost\n  const margin = sale > 0 ? (profit / sale) * 100 : 0\n\n  savingManualOceanFreight.value = true\n  try {\n    const importRateId = await PricingService.createImportRate({\n      importBatchId: crypto.randomUUID(),\n      extractionRecordId: crypto.randomUUID(),\n      sourceType: 'Manual',\n      profile: {\n        id: '00000000-0000-0000-0000-00000000f006',\n        name: 'Flete marítimo manual',\n        code: 'MANUAL_OCEAN',\n        slug: 'manual-ocean-freight',\n      },\n      pol: originSnapshot,\n      poe: destinationSnapshot,\n      pod: podSnapshot,\n      carrier: carrierSnapshot,\n      agent: agentSnapshot,\n      containerType: equipmentSnapshot,\n      currency: currencySnapshot,\n      commodity: form.cargoDescription?.trim() || null,\n      spaceComment: comment || null,\n      oceanFreight: cost,\n      originCharges: 0,\n      destinationCharges: 0,\n      surcharges: 0,\n      totalCost: cost,\n      totalSale: sale,\n      profit,\n      margin,\n      freeDays: Math.max(0, number(form.freeDays)),\n      transitDays: Math.max(0, number(form.transitDays)),\n      validFrom: form.loadDate,\n      validTo: form.validTo,\n      rawDataJson: JSON.stringify({\n        source: 'manual',\n        screen: 6,\n        comments: comment || null,\n        oceanFreightCost: cost,\n        oceanFreightSale: sale,\n      }),\n    } as any)\n\n    manualOceanFreightSavedId.value = importRateId\n    savedManualOceanFreightFingerprint.value = fingerprint\n    toastStore.success('Flete marítimo guardado', 'Quedó disponible como tarifa pre-aprobada para reutilizarla en Pantalla 5.')\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudo guardar el flete marítimo manual.')\n  } finally {\n    savingManualOceanFreight.value = false\n  }\n}\n\n`
  code = replaceRequired(code, saveRateAnchor, helperCode + saveRateAnchor, 'save rate function')

  if (code.includes('<span>Vigencia</span>')) {
    code = code.replace('<span>Vigencia</span>', '<span>Vigencia de la tarifa</span>')
  }

  const oldComment = `                <p v-if="rate.spaceComment" class="mt-3 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-left text-xs font-semibold text-[var(--dh-text-muted)]">\n                  Comentario: {{ rate.spaceComment }}\n                </p>`
  if (code.includes(oldComment)) {
    code = code.replace(
      oldComment,
      `                <div class="mt-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-3 text-left">\n                  <span class="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Comentarios de la tarifa</span>\n                  <p class="mt-1 whitespace-pre-line text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">{{ rate.spaceComment || 'Sin comentarios registrados.' }}</p>\n                </div>`,
    )
  }

  const freightSaleAnchor = '            <DhInput v-model.number="form.freightSale" type="number" min="0" step="0.01" label="Flete internacional · venta" />'
  const saveCard = `${freightSaleAnchor}\n            <div v-if="shipmentModeForApi === 'Fcl' && (form.modality === 'Maritime' || form.modality === 'Multimodal') && (form.manualRate || !form.selectedImportRateId)" class="crystal-soft space-y-4 p-4 md:col-span-3">\n              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">\n                <div>\n                  <p class="font-black">Guardar flete marítimo manual</p>\n                  <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Guarda este costo/venta como una tarifa marítima pre-aprobada para reutilizarla después en Pantalla 5.</p>\n                </div>\n                <DhButton type="button" variant="secondary" :loading="savingManualOceanFreight" :disabled="savingManualOceanFreight || form.freightCost <= 0" @click="saveManualOceanFreight">\n                  Guardar flete marítimo\n                </DhButton>\n              </div>\n              <div class="grid gap-3 md:grid-cols-2">\n                <DhInput v-model="form.loadDate" type="date" label="Vigencia desde" />\n                <DhInput v-model="form.validTo" type="date" label="Vigencia hasta" />\n              </div>\n              <DhTextarea v-model="manualOceanFreightComment" label="Comentarios de la tarifa" :rows="3" placeholder="Ej. sujeto a espacio, salida semanal, condiciones especiales…" />\n              <p v-if="manualOceanFreightSavedId" class="text-xs font-black text-emerald-600">Flete guardado correctamente como tarifa pre-aprobada.</p>\n            </div>`
  code = replaceRequired(code, freightSaleAnchor, saveCard, 'screen 6 freight sale field')

  return code
}

export function pricingWizardManualOceanFreight(): Plugin {
  return {
    name: 'dhole-pricing-wizard-manual-ocean-freight',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
