from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected exactly one match, got {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)

replace_once(
"""const hydratingExistingRate = ref(false)\nconst isEditing = computed(() => Boolean(props.rateId))""",
"""const hydratingExistingRate = ref(false)\nconst commercialAction = ref<'accept' | 'reject' | null>(null)\nconst commercialIdtra = ref('')\nconst commercialRejectionReason = ref('')\nconst commercialStatusSaving = ref(false)\nconst commercialActionError = ref('')\nconst downloadingQuote = ref(false)\nconst isEditing = computed(() => Boolean(props.rateId))""",
)

replace_once(
"""const stepTitles = [\n  'Modalidad',\n  'Embarque',\n  'Ruta y equipo',\n  'Carga',\n  'Tarifa',\n  'Proveedor',\n  'Líneas',\n  'Borrador',\n]\n""",
"""const stepTitles = [\n  'Modalidad',\n  'Embarque',\n  'Ruta y equipo',\n  'Carga',\n  'Tarifa',\n  'Proveedor',\n  'Líneas',\n  'Borrador',\n]\nconst visibleStepTitles = computed(() => props.viewOnly ? [...stepTitles, 'Vista completa'] : stepTitles)\nconst maxStep = computed(() => visibleStepTitles.value.length)\nconst currentCommercialStatus = computed(() => editingRate.value?.status ?? '')\nconst canMarkSent = computed(() => currentCommercialStatus.value === 'Open')\nconst canAcceptOrReject = computed(() => ['Sent', 'RequestedByClient'].includes(currentCommercialStatus.value))\n""",
)

replace_once(
"""    form.idtraNumber = rate.idtraNumber ?? ''\n    form.pickupAddress = rate.pickupAddress ?? ''""",
"""    form.idtraNumber = rate.idtraNumber ?? ''\n    commercialIdtra.value = rate.idtraNumber ?? ''\n    commercialRejectionReason.value = rate.status === 'RejectedByClient' ? rate.closedReason ?? '' : ''\n    commercialAction.value = null\n    commercialActionError.value = ''\n    form.pickupAddress = rate.pickupAddress ?? ''""",
)

replace_once(
"""    step.value = 8\n  } catch (error) {""",
"""    step.value = props.viewOnly ? 9 : 8\n  } catch (error) {""",
)

replace_once(
"""function editCurrentRate() {\n  if (!editingRate.value) return\n  router.replace({ name: 'pricing-rate-wizard', params: { rateId: editingRate.value.id }, query: { mode: 'edit' } })\n}\n\nasync function next() {\n  if (!canNext.value) return\n  if (step.value === 4) await searchApprovedRates()\n  if (step.value === 6) {\n    await loadApplicableCosts()\n    rebuildRateLines()\n  }\n  if (step.value < 8) step.value += 1\n}\n""",
"""function editCurrentRate() {\n  if (!editingRate.value) return\n  router.replace({ name: 'pricing-rate-wizard', params: { rateId: editingRate.value.id }, query: { mode: 'edit' } })\n}\n\nfunction goToStep(target: number) {\n  if (target < 1 || target > maxStep.value) return\n  // Crear mantiene el flujo guiado; Ver y Editar pueden recorrer libremente toda la tarifa.\n  if (props.rateId || target <= step.value) step.value = target\n}\n\nfunction commercialStatusLabel(status: string) {\n  return ({\n    PendingApproval: 'Pendiente de aprobación',\n    ApprovedByManagement: 'Aprobada por gerencia',\n    RejectedByManagement: 'Rechazada por gerencia',\n    Open: 'Abierta',\n    Sent: 'Enviada',\n    AcceptedByClient: 'Aceptada',\n    RejectedByClient: 'Rechazada',\n    RequestedByClient: 'Solicitada por cliente',\n    Closed: 'Cerrada',\n    Expired: 'Vencida',\n  } as Record<string, string>)[status] ?? status\n}\n\nasync function markCurrentRateSent() {\n  if (!editingRate.value || !canMarkSent.value) return\n  try {\n    commercialStatusSaving.value = true\n    commercialActionError.value = ''\n    await PricingService.setRateStatus(editingRate.value.id, { status: 'Sent' })\n    toastStore.success('Tarifa marcada como enviada.')\n    await hydrateExistingRate()\n  } catch (error) {\n    commercialActionError.value = 'No se pudo marcar la tarifa como enviada.'\n    toastStore.backendError(error, commercialActionError.value)\n  } finally {\n    commercialStatusSaving.value = false\n  }\n}\n\nfunction startCommercialDecision(action: 'accept' | 'reject') {\n  if (!canAcceptOrReject.value) return\n  commercialAction.value = action\n  commercialActionError.value = ''\n  if (action === 'accept') commercialIdtra.value = editingRate.value?.idtraNumber ?? form.idtraNumber ?? ''\n  if (action === 'reject') commercialRejectionReason.value = ''\n}\n\nasync function submitCommercialDecision() {\n  if (!editingRate.value || !commercialAction.value || !canAcceptOrReject.value) return\n  if (commercialAction.value === 'accept' && !commercialIdtra.value.trim()) {\n    commercialActionError.value = 'El IDTRA es obligatorio para aceptar la tarifa.'\n    return\n  }\n  if (commercialAction.value === 'reject' && !commercialRejectionReason.value.trim()) {\n    commercialActionError.value = 'El motivo de rechazo es obligatorio.'\n    return\n  }\n\n  try {\n    commercialStatusSaving.value = true\n    commercialActionError.value = ''\n    if (commercialAction.value === 'accept') {\n      await PricingService.setRateStatus(editingRate.value.id, {\n        status: 'AcceptedByClient',\n        idtraNumber: commercialIdtra.value.trim(),\n      })\n      toastStore.success('Tarifa aceptada', `IDTRA ${commercialIdtra.value.trim()} registrado.`)\n    } else {\n      await PricingService.setRateStatus(editingRate.value.id, {\n        status: 'RejectedByClient',\n        reason: commercialRejectionReason.value.trim(),\n      })\n      toastStore.success('Tarifa marcada como rechazada.')\n    }\n    await hydrateExistingRate()\n  } catch (error) {\n    commercialActionError.value = commercialAction.value === 'accept'\n      ? 'No se pudo aceptar la tarifa.'\n      : 'No se pudo rechazar la tarifa.'\n    toastStore.backendError(error, commercialActionError.value)\n  } finally {\n    commercialStatusSaving.value = false\n  }\n}\n\nasync function downloadCurrentQuote() {\n  if (!editingRate.value || downloadingQuote.value) return\n  try {\n    downloadingQuote.value = true\n    await PricingService.downloadRateDocument(\n      editingRate.value.id,\n      editingRate.value.rateName || editingRate.value.rateCode,\n      { format: 'pdf' },\n    )\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudo descargar la cotización.')\n  } finally {\n    downloadingQuote.value = false\n  }\n}\n\nasync function next() {\n  if (props.rateId) {\n    if (step.value < maxStep.value) step.value += 1\n    return\n  }\n  if (!canNext.value) return\n  if (step.value === 4) await searchApprovedRates()\n  if (step.value === 6) {\n    await loadApplicableCosts()\n    rebuildRateLines()\n  }\n  if (step.value < 8) step.value += 1\n}\n""",
)

replace_once(
"""    <div class=\"crystal-stepbar grid grid-cols-2 gap-2 p-2 sm:grid-cols-4 xl:grid-cols-8\">\n      <button\n        v-for=\"(title, index) in stepTitles\"""",
"""    <div class=\"crystal-stepbar grid grid-cols-2 gap-2 p-2 sm:grid-cols-4\" :class=\"viewOnly ? 'xl:grid-cols-9' : 'xl:grid-cols-8'\">\n      <button\n        v-for=\"(title, index) in visibleStepTitles\"""",
)

replace_once(
"""        @click=\"index + 1 < step ? (step = index + 1) : undefined\"""",
"""        @click=\"goToStep(index + 1)\"""",
)

replace_once(
"""    <section class=\"crystal-panel min-h-[470px] p-5 md:p-8\">""",
"""    <section class=\"crystal-panel min-h-[470px] p-5 md:p-8\" :class=\"{ 'wizard-view-readonly': viewOnly && step !== 9 }\">""",
)

replace_once(
"""        <div v-else class=\"space-y-6\">\n          <div>\n            <p class=\"crystal-kicker\">Pantalla 8</p>""",
"""        <div v-else-if=\"step === 8\" class=\"space-y-6\">\n          <div>\n            <p class=\"crystal-kicker\">Pantalla 8</p>""",
)

screen9 = r'''

        <div v-else-if="step === 9 && viewOnly && editingRate" class="space-y-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="crystal-kicker">Pantalla 9</p>
              <h2 class="crystal-title">Vista completa de la tarifa</h2>
              <p class="crystal-description">Resumen integral de la revisión actual, decisión comercial, líneas, condiciones y totales.</p>
            </div>
            <DhButton variant="secondary" :loading="downloadingQuote" :disabled="downloadingQuote" @click="downloadCurrentQuote">
              Descargar cotización PDF
            </DhButton>
          </div>

          <div class="crystal-soft p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Estado comercial</p>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <DhBadge :label="commercialStatusLabel(editingRate.status)" :variant="editingRate.status === 'AcceptedByClient' ? 'success' : editingRate.status === 'RejectedByClient' ? 'danger' : 'neutral'" />
                  <DhBadge :label="`REV ${editingRate.revisionNumber || 1}`" variant="neutral" />
                  <DhBadge v-if="editingRate.idtraNumber" :label="`IDTRA ${editingRate.idtraNumber}`" variant="primary" />
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <DhButton variant="secondary" :disabled="!canMarkSent || commercialStatusSaving" @click="markCurrentRateSent">Enviada</DhButton>
                <DhButton :disabled="!canAcceptOrReject || commercialStatusSaving" @click="startCommercialDecision('accept')">Aceptada</DhButton>
                <DhButton variant="danger" :disabled="!canAcceptOrReject || commercialStatusSaving" @click="startCommercialDecision('reject')">Rechazada</DhButton>
              </div>
            </div>
            <p class="mt-3 text-xs font-semibold text-[var(--dh-text-muted)]">
              Una tarifa Abierta puede marcarse Enviada. Después de Enviada puede registrarse como Aceptada o Rechazada.
            </p>

            <div v-if="commercialAction === 'accept'" class="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
              <p class="text-sm font-black">Aceptar tarifa</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Para aceptar la tarifa debe registrar el número IDTRA.</p>
              <div class="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <DhInput v-model="commercialIdtra" label="Número IDTRA" placeholder="Ej. IDTRA-2026-00125" />
                <DhButton :loading="commercialStatusSaving" :disabled="commercialStatusSaving || !commercialIdtra.trim()" @click="submitCommercialDecision">Confirmar aceptación</DhButton>
                <DhButton variant="secondary" :disabled="commercialStatusSaving" @click="commercialAction = null">Cancelar</DhButton>
              </div>
            </div>

            <div v-if="commercialAction === 'reject'" class="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4">
              <p class="text-sm font-black">Rechazar tarifa</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">El motivo es obligatorio y quedará guardado en la tarifa y visible en la cotización.</p>
              <DhTextarea v-model="commercialRejectionReason" class="mt-3" label="Motivo de rechazo" placeholder="Indique por qué el cliente rechazó la tarifa" :rows="4" />
              <div class="mt-3 flex flex-wrap justify-end gap-2">
                <DhButton variant="secondary" :disabled="commercialStatusSaving" @click="commercialAction = null">Cancelar</DhButton>
                <DhButton variant="danger" :loading="commercialStatusSaving" :disabled="commercialStatusSaving || !commercialRejectionReason.trim()" @click="submitCommercialDecision">Confirmar rechazo</DhButton>
              </div>
            </div>

            <p v-if="commercialActionError" class="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-black text-red-600 dark:text-red-300">{{ commercialActionError }}</p>
            <div v-if="editingRate.status === 'RejectedByClient' && editingRate.closedReason" class="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4">
              <p class="text-[10px] font-black uppercase tracking-[0.14em] text-red-600 dark:text-red-300">Motivo de rechazo</p>
              <p class="mt-2 whitespace-pre-wrap text-sm font-bold">{{ editingRate.closedReason }}</p>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-3">
            <div class="crystal-soft p-5">
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Identificación</p>
              <p class="mt-3 text-lg font-black">{{ editingRate.rateCode }}</p>
              <p class="mt-1 text-sm font-bold">QUO: {{ editingRate.quoNumber || '—' }}</p>
              <p class="mt-1 text-sm font-bold">IDTRA: {{ editingRate.idtraNumber || 'Pendiente' }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ editingRate.rateName }}</p>
            </div>
            <div class="crystal-soft p-5">
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Cliente y operación</p>
              <p class="mt-3 text-lg font-black">{{ editingRate.clientName || 'Cliente sin definir' }}</p>
              <p class="mt-1 text-sm font-bold">Ejecutivo: {{ editingRate.executiveName || 'Sin asignar' }}</p>
              <p class="mt-1 text-sm font-bold">{{ direction }} · {{ form.modality }} · {{ form.shipmentMode }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Incoterm {{ editingRate.incotermCode || editingRate.incotermName || '—' }}</p>
            </div>
            <div class="crystal-soft p-5">
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Vigencia y cambio</p>
              <p class="mt-3 text-sm font-bold">{{ formatDate(editingRate.validFrom) }} → {{ formatDate(editingRate.validTo) }}</p>
              <p class="mt-1 text-sm font-bold">Días libres: {{ editingRate.freeDays }}</p>
              <p class="mt-1 text-sm font-bold">Tránsito: {{ editingRate.transitTime || 'Por confirmar' }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">TC venta: {{ Number(editingRate.exchangeRateSale || editingRate.exchangeRateApplied || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 }) }}</p>
            </div>
          </div>

          <div class="crystal-soft p-5">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Ruta, proveedor y servicios</p>
            <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Ruta</span><p class="mt-1 font-bold">{{ editingRate.polName }} → {{ editingRate.poeName }}<span v-if="editingRate.podName"> → {{ editingRate.podName }}</span></p></div>
              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Naviera / proveedor</span><p class="mt-1 font-bold">{{ editingRate.carrierName || 'Sin asignar' }}</p></div>
              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Agente</span><p class="mt-1 font-bold">{{ editingRate.agentName || 'Sin asignar' }}</p></div>
              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Equipo</span><p class="mt-1 font-bold">{{ editingRate.containerQuantity }} × {{ editingRate.containerTypeName }}</p></div>
            </div>
            <div class="mt-4">
              <span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Servicios</span>
              <div class="mt-2 flex flex-wrap gap-2">
                <DhBadge v-for="service in editingRate.services || []" :key="service.id" :label="service.name" variant="neutral" />
                <span v-if="!(editingRate.services || []).length" class="text-xs font-semibold text-[var(--dh-text-muted)]">Sin servicios asociados</span>
              </div>
            </div>
            <div v-if="editingRate.pickupAddress" class="mt-4 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 text-sm font-semibold">
              Recolección: {{ editingRate.pickupAddress }}
            </div>
          </div>

          <div class="crystal-soft overflow-hidden p-0">
            <div class="border-b border-[var(--dh-border)] px-5 py-4">
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Líneas completas de la tarifa</p>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-[980px] w-full text-left text-xs">
                <thead class="bg-[var(--dh-card-hover)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
                  <tr><th class="px-4 py-3">Rubro</th><th class="px-4 py-3">Base</th><th class="px-4 py-3">Cant.</th><th class="px-4 py-3">Divisa</th><th class="px-4 py-3 text-right">Costo unit.</th><th class="px-4 py-3 text-right">Venta unit.</th><th class="px-4 py-3 text-right">Venta total</th></tr>
                </thead>
                <tbody>
                  <tr v-for="detail in editingRate.rateDetails" :key="detail.id" class="border-t border-[var(--dh-border)]">
                    <td class="px-4 py-3"><strong>{{ detail.name }}</strong><p v-if="detail.notes" class="mt-1 max-w-[360px] whitespace-pre-wrap text-[10px] font-semibold text-[var(--dh-text-muted)]">{{ detail.notes }}</p></td>
                    <td class="px-4 py-3">{{ chargeBasisLabel(detail.chargeBasis) }}</td>
                    <td class="px-4 py-3">{{ Number(detail.quantity || 0).toLocaleString('es-CR') }}</td>
                    <td class="px-4 py-3 font-black">{{ detail.currencyCode }}</td>
                    <td class="px-4 py-3 text-right">{{ formatMoney(Number(detail.costAmount || 0), detail.currencyCode) }}</td>
                    <td class="px-4 py-3 text-right">{{ formatMoney(Number(detail.saleAmount || 0), detail.currencyCode) }}</td>
                    <td class="px-4 py-3 text-right font-black">{{ formatMoney(Number(detail.saleAmount || 0) * Number(detail.quantity || 0), detail.currencyCode) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="crystal-soft p-5">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Totales de la oferta</p>
            <div class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
              <div class="min-w-[520px]">
                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-[10px] font-black uppercase text-[var(--dh-text-muted)]"><span>Concepto</span><span>USD</span><span>CRC</span></div>
                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-sm"><strong>Subtotal</strong><strong>{{ formatMoney(totalSaleBeforeTaxUsd, 'USD') }}</strong><strong>{{ formatMoney(totalSaleBeforeTaxCrc, 'CRC') }}</strong></div>
                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-sm"><strong>IVA</strong><strong>{{ formatMoney(totalTaxUsd, 'USD') }}</strong><strong>{{ formatMoney(totalTaxCrc, 'CRC') }}</strong></div>
                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 bg-[rgb(var(--dh-primary-rgb)/0.07)] px-4 py-4 text-base"><strong>Total</strong><strong class="text-[var(--dh-primary)]">{{ formatMoney(totalSaleUsd, 'USD') }}</strong><strong class="text-[var(--dh-primary)]">{{ formatMoney(totalSaleCrc, 'CRC') }}</strong></div>
              </div>
            </div>
            <div class="mt-4 grid gap-3 md:grid-cols-3 text-sm">
              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Costo</span><p class="mt-1 font-black">{{ formatMoney(totalCostUsd, 'USD') }} / {{ formatMoney(totalCostCrc, 'CRC') }}</p></div>
              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Utilidad</span><p class="mt-1 font-black">{{ formatMoney(totalUtilityUsd, 'USD') }} / {{ formatMoney(totalUtilityCrc, 'CRC') }}</p></div>
              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Margen</span><p class="mt-1 font-black">{{ totalMarginPercentage.toFixed(2) }}%</p></div>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-3">
            <div class="crystal-soft p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tarifa incluye</p><p class="mt-3 whitespace-pre-wrap text-sm font-semibold">{{ editingRate.includes || '—' }}</p></div>
            <div class="crystal-soft p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Sujeta a</p><p class="mt-3 whitespace-pre-wrap text-sm font-semibold">{{ editingRate.subjectTo || '—' }}</p></div>
            <div class="crystal-soft p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tarifa no incluye</p><p class="mt-3 whitespace-pre-wrap text-sm font-semibold">{{ editingRate.excludes || '—' }}</p></div>
          </div>
        </div>
'''

replace_once(
"""        </div>\n      </template>\n    </section>\n\n    <div class=\"crystal-footer flex items-center justify-between gap-3 p-3\">""",
"""        </div>""" + screen9 + """      </template>\n    </section>\n\n    <div class=\"crystal-footer flex items-center justify-between gap-3 p-3\">""",
)

replace_once(
"""      <div class=\"text-xs font-black tracking-[0.14em] text-[var(--dh-text-muted)]\">{{ step }} / 8</div>\n      <DhButton v-if=\"step < 8 && ![1, 2, 5].includes(step)\" :disabled=\"!canNext || loadingRates\" @click=\"next\">Continuar <ChevronRight class=\"h-4 w-4\" /></DhButton>\n      <DhButton v-else-if=\"step === 8 && viewOnly && editingRate\" @click=\"editCurrentRate\"><Edit3 class=\"h-4 w-4\" /> Editar tarifa</DhButton>\n      <DhButton v-else-if=\"step === 8\" :disabled=\"saving || !includedLines.length\" @click=\"saveRate\"><Check class=\"h-4 w-4\" /> {{ saving ? 'Guardando…' : isEditing ? 'Guardar tarifa' : 'Crear tarifa' }}</DhButton>\n      <span v-else class=\"text-xs font-bold text-[var(--dh-text-muted)]\">Seleccione una alternativa para continuar</span>""",
"""      <div class=\"text-xs font-black tracking-[0.14em] text-[var(--dh-text-muted)]\">{{ step }} / {{ maxStep }}</div>\n      <DhButton v-if=\"isEditing && step < maxStep\" :disabled=\"saving\" @click=\"next\">Siguiente <ChevronRight class=\"h-4 w-4\" /></DhButton>\n      <DhButton v-else-if=\"!isEditing && step < 8 && ![1, 2, 5].includes(step)\" :disabled=\"!canNext || loadingRates\" @click=\"next\">Continuar <ChevronRight class=\"h-4 w-4\" /></DhButton>\n      <DhButton v-else-if=\"step === 9 && viewOnly && editingRate\" @click=\"editCurrentRate\"><Edit3 class=\"h-4 w-4\" /> Editar tarifa</DhButton>\n      <DhButton v-else-if=\"step === 8 && viewOnly && editingRate\" @click=\"goToStep(9)\">Vista completa <ChevronRight class=\"h-4 w-4\" /></DhButton>\n      <DhButton v-else-if=\"step === 8\" :disabled=\"saving || !includedLines.length\" @click=\"saveRate\"><Check class=\"h-4 w-4\" /> {{ saving ? 'Guardando…' : isEditing ? 'Guardar tarifa' : 'Crear tarifa' }}</DhButton>\n      <span v-else class=\"text-xs font-bold text-[var(--dh-text-muted)]\">Seleccione una alternativa para continuar</span>""",
)

# Make the legacy screens genuinely read-only in View mode while leaving the stepbar/footer and Screen 9 actions interactive.
text += """

<style scoped>
.wizard-view-readonly {
  pointer-events: none;
  user-select: text;
}
</style>
"""

path.write_text(text, encoding='utf-8')
