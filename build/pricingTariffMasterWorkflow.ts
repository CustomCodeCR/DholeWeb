import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingTariffMasterWorkflow] Expected one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `const form = reactive({
  modality: '' as Modality | '',`,
    `const form = reactive({
  rateType: 'Spot' as 'Spot' | 'Tariff',
  modality: '' as Modality | '',`,
    'rate type form state',
  )

  code = replaceOne(
    code,
    `const canAcceptOrReject = computed(() => ['Sent', 'RequestedByClient'].includes(currentCommercialStatus.value))`,
    `const canAcceptOrReject = computed(() => ['Sent', 'RequestedByClient'].includes(currentCommercialStatus.value))
const isMasterTariff = computed(() =>
  editingRate.value?.rateType === 'Tariff' && !editingRate.value?.sourceTariffRateId,
)`,
    'master tariff state',
  )

  code = replaceOne(
    code,
    `function chooseModality(value: Modality) {`,
    `function chooseRateType(value: 'Spot' | 'Tariff') {
  form.rateType = value
  if (value === 'Tariff' && form.validTo === addDaysIso(form.loadDate, 30)) {
    form.validTo = addDaysIso(form.loadDate, 90)
  }
}

function chooseModality(value: Modality) {`,
    'rate type selector action',
  )

  code = replaceOne(
    code,
    `    form.modality = modality
    form.shipmentMode = String(rate.shipmentMode).toUpperCase()`,
    `    form.rateType = rate.rateType
    form.modality = modality
    form.shipmentMode = String(rate.shipmentMode).toUpperCase()`,
    'existing rate type hydration',
  )

  const spotPayload = `      rateType: 'Spot',`
  const spotPayloadCount = code.split(spotPayload).length - 1
  if (spotPayloadCount !== 2) {
    throw new Error(`[pricingTariffMasterWorkflow] Expected two SPOT payload anchors, found ${spotPayloadCount}.`)
  }
  code = code.replaceAll(spotPayload, `      rateType: form.rateType,`)

  code = replaceOne(
    code,
    `      validTo: addDaysIso(form.loadDate, 30),`,
    `      validTo: form.validTo || addDaysIso(form.loadDate, form.rateType === 'Tariff' ? 90 : 30),`,
    'open request validity',
  )

  const decisionStart = code.indexOf(`async function submitCommercialDecision() {`)
  const decisionEnd = code.indexOf(`async function downloadCurrentQuote() {`, decisionStart)
  if (decisionStart < 0 || decisionEnd < 0) {
    throw new Error('[pricingTariffMasterWorkflow] Commercial decision block not found.')
  }

  const decisionBlock = `async function submitCommercialDecision() {
  if (!editingRate.value || !commercialAction.value || !canAcceptOrReject.value) return
  if (commercialAction.value === 'accept' && !commercialIdtra.value.trim()) {
    commercialActionError.value = 'El IDTRA es obligatorio para aceptar la tarifa.'
    return
  }
  if (commercialAction.value === 'accept' && isMasterTariff.value && !form.clientName.trim()) {
    commercialActionError.value = 'Indique el cliente que aprobó el tarifario.'
    return
  }
  if (commercialAction.value === 'reject' && !commercialRejectionReason.value.trim()) {
    commercialActionError.value = 'El motivo de rechazo es obligatorio.'
    return
  }

  try {
    commercialStatusSaving.value = true
    commercialActionError.value = ''
    if (commercialAction.value === 'accept') {
      if (isMasterTariff.value) {
        const sourceQuo = editingRate.value.quoNumber || editingRate.value.rateCode
        const appliedRateId = await PricingService.duplicateRate(editingRate.value.id, {
          validFrom: editingRate.value.validFrom,
          validTo: editingRate.value.validTo,
          applyTariff: true,
          clientName: form.clientName.trim(),
          executiveName: form.executiveName.trim() || null,
          idtraNumber: commercialIdtra.value.trim(),
        })
        const appliedRate = await PricingService.getRate(appliedRateId)
        const appliedQuo = appliedRate.quoNumber || appliedRate.rateCode
        toastStore.success(
          'Tarifario aplicado al cliente',
          \`${sourceQuo} permanece como tarifario maestro y se creó ${appliedQuo} conservando exactamente el flete, cargos, recargos, condiciones y vigencia.\`,
        )
        await router.push({
          name: 'pricing-rate-wizard',
          params: { rateId: appliedRateId },
          query: { mode: 'view' },
        })
        return
      }

      await PricingService.setRateStatus(editingRate.value.id, {
        status: 'AcceptedByClient',
        idtraNumber: commercialIdtra.value.trim(),
      })
      toastStore.success('Tarifa aceptada', \`IDTRA ${commercialIdtra.value.trim()} registrado.\`)
    } else {
      await PricingService.setRateStatus(editingRate.value.id, {
        status: 'RejectedByClient',
        reason: commercialRejectionReason.value.trim(),
      })
      toastStore.success('Tarifa marcada como rechazada.')
    }
    await hydrateExistingRate()
  } catch (error) {
    commercialActionError.value = commercialAction.value === 'accept'
      ? isMasterTariff.value
        ? 'No se pudo aplicar el tarifario al cliente.'
        : 'No se pudo aceptar la tarifa.'
      : 'No se pudo rechazar la tarifa.'
    toastStore.backendError(error, commercialActionError.value)
  } finally {
    commercialStatusSaving.value = false
  }
}

`

  code = code.slice(0, decisionStart) + decisionBlock + code.slice(decisionEnd)

  const screenOneHeader = `        <div v-else-if="step === 1" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 1</p>
            <h2 class="crystal-title">Seleccione la modalidad</h2>
            <p class="crystal-description">El servicio inicial seleccionado en Pantalla 0 se conserva para la tarifa.</p>
            <button
              v-if="!isEditing"
              type="button"
              class="mt-2 text-xs font-black text-[var(--dh-primary)] hover:underline"
              @click="entryLogisticsService = ''; form.serviceIds = []"
            >
              Cambiar servicio logístico
            </button>
          </div>`

  const screenOneReplacement = `        <div v-else-if="step === 1" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 1</p>
            <h2 class="crystal-title">Tipo de tarifa y modalidad</h2>
            <p class="crystal-description">Distinga si la cotización es SPOT o un TARIFARIO maestro de vigencia extendida.</p>
            <button
              v-if="!isEditing"
              type="button"
              class="mt-2 text-xs font-black text-[var(--dh-primary)] hover:underline"
              @click="entryLogisticsService = ''; form.serviceIds = []"
            >
              Cambiar servicio logístico
            </button>
          </div>

          <div class="crystal-soft p-4 md:p-5">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tipo comercial</p>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                class="crystal-choice min-h-[112px] text-left"
                :class="form.rateType === 'Spot' ? 'crystal-choice--active' : ''"
                @click="chooseRateType('Spot')"
              >
                <span class="text-base font-black">SPOT</span>
                <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">
                  Cotización puntual. Al duplicarla se revisan nuevamente el flete y los costos vigentes.
                </span>
                <Check v-if="form.rateType === 'Spot'" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />
              </button>

              <button
                type="button"
                class="crystal-choice min-h-[112px] text-left"
                :class="form.rateType === 'Tariff' ? 'crystal-choice--active' : ''"
                @click="chooseRateType('Tariff')"
              >
                <span class="text-base font-black">TARIFARIO</span>
                <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">
                  Tarifa maestra de larga vigencia. Cuando un cliente la aprueba se crea otro QUO como snapshot exacto.
                </span>
                <Check v-if="form.rateType === 'Tariff'" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />
              </button>
            </div>
          </div>`

  code = replaceOne(code, screenOneHeader, screenOneReplacement, 'screen one rate type selector')

  const acceptPanel = `            <div v-if="commercialAction === 'accept'" class="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
              <p class="text-sm font-black">Aceptar tarifa</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Para aceptar la tarifa debe registrar el número IDTRA.</p>
              <div class="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <DhInput v-model="commercialIdtra" label="Número IDTRA" placeholder="Ej. IDTRA-2026-00125" />
                <DhButton :loading="commercialStatusSaving" :disabled="commercialStatusSaving || !commercialIdtra.trim()" @click="submitCommercialDecision">Confirmar aceptación</DhButton>
                <DhButton variant="secondary" :disabled="commercialStatusSaving" @click="commercialAction = null">Cancelar</DhButton>
              </div>
            </div>`

  const acceptPanelReplacement = `            <div v-if="commercialAction === 'accept'" class="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
              <p class="text-sm font-black">{{ isMasterTariff ? 'Aplicar tarifario al cliente' : 'Aceptar tarifa' }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ isMasterTariff
                  ? 'Se creará un nuevo QUO copiando exactamente esta revisión: flete, cargos, recargos, condiciones y vigencia. El tarifario maestro permanecerá sin cambios.'
                  : 'Para aceptar la tarifa debe registrar el número IDTRA.' }}
              </p>

              <div v-if="isMasterTariff" class="mt-3 grid gap-3 md:grid-cols-2">
                <DhInput v-model="form.clientName" label="Cliente que aprobó el tarifario" placeholder="Nombre del cliente" />
                <DhInput v-model="form.executiveName" label="Ejecutivo comercial" placeholder="Ejecutivo" />
              </div>

              <div class="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <DhInput v-model="commercialIdtra" label="Número IDTRA" placeholder="Ej. IDTRA-2026-00125" />
                <DhButton
                  :loading="commercialStatusSaving"
                  :disabled="commercialStatusSaving || !commercialIdtra.trim() || (isMasterTariff && !form.clientName.trim())"
                  @click="submitCommercialDecision"
                >
                  {{ isMasterTariff ? 'Crear nuevo QUO aceptado' : 'Confirmar aceptación' }}
                </DhButton>
                <DhButton variant="secondary" :disabled="commercialStatusSaving" @click="commercialAction = null">Cancelar</DhButton>
              </div>
            </div>`

  code = replaceOne(code, acceptPanel, acceptPanelReplacement, 'tariff acceptance panel')

  return code
}

export function pricingTariffMasterWorkflow(): Plugin {
  return {
    name: 'dhole-pricing-tariff-master-workflow',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
