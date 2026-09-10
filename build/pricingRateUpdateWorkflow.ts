import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MAIN_PATH = '/src/main.ts'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingRateUpdateWorkflow] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  const stateAnchor = `const downloadingQuote = ref(false)`
  const stateReplacement = `${stateAnchor}\n\ninterface RateUpdateEligibility {\n  canUpdate: boolean\n  requiresReason: boolean\n  rateStatus: string\n  updateWindow: string | null\n  message: string\n  requestIds?: string[]\n}\n\nconst rateUpdateEligibility = ref<RateUpdateEligibility | null>(null)\nconst rateUpdateEligibilityLoading = ref(false)\nconst rateUpdateReason = ref('')\nconst rateUpdatePromptOpen = ref(false)`
  code = replaceOne(code, stateAnchor, stateReplacement, 'rate update state')

  const hydrateAnchor = `async function hydrateExistingRate() {`
  const helpers = `function rateUpdateReasonStorageKey(rateId: string) {\n  return \`dhole:pricing:rate-update-reason:\${rateId}\`\n}\n\nasync function loadRateUpdateEligibility(rateId: string) {\n  try {\n    rateUpdateEligibilityLoading.value = true\n    const response = await callEndpoint<unknown>({\n      method: 'GET',\n      path: \`/api/pricing/rates/\${rateId}/update-eligibility\`,\n      headers: { Accept: 'application/json' },\n    })\n    rateUpdateEligibility.value = unwrapApiResponse<RateUpdateEligibility>(response as never)\n  } catch {\n    rateUpdateEligibility.value = {\n      canUpdate: false,\n      requiresReason: true,\n      rateStatus: editingRate.value?.status ?? '',\n      updateWindow: null,\n      message: 'No fue posible validar si esta tarifa todavía puede actualizarse.',\n    }\n  } finally {\n    rateUpdateEligibilityLoading.value = false\n  }\n}\n\nfunction beginRateUpdate() {\n  if (!editingRate.value || !rateUpdateEligibility.value?.canUpdate) return\n  rateUpdatePromptOpen.value = true\n}\n\nfunction cancelRateUpdate() {\n  rateUpdatePromptOpen.value = false\n  rateUpdateReason.value = ''\n}\n\nfunction continueRateUpdate() {\n  if (!editingRate.value || !rateUpdateEligibility.value?.canUpdate) return\n  const reason = rateUpdateReason.value.trim()\n  if (reason.length < 5) {\n    toastStore.warning('Motivo requerido', 'Indique por qué se realizará la actualización de la tarifa (mínimo 5 caracteres).')\n    return\n  }\n  sessionStorage.setItem(rateUpdateReasonStorageKey(editingRate.value.id), reason)\n  editCurrentRate()\n}\n\n${hydrateAnchor}`
  code = replaceOne(code, hydrateAnchor, helpers, 'hydrate helper insertion')

  code = replaceOne(
    code,
    `    editingRate.value = rate\n    rateRevisions.value = revisions`,
    `    editingRate.value = rate\n    rateUpdateReason.value = sessionStorage.getItem(rateUpdateReasonStorageKey(rate.id)) ?? ''\n    await loadRateUpdateEligibility(rate.id)\n    rateRevisions.value = revisions`,
    'existing rate eligibility hydration',
  )

  code = replaceOne(
    code,
    `<DhButton v-if="viewOnly" variant="secondary" @click="editCurrentRate">Editar en este wizard</DhButton>`,
    `<div v-if="viewOnly" class="flex max-w-full flex-col items-end gap-2">\n          <DhButton\n            v-if="rateUpdateEligibility?.canUpdate"\n            variant="secondary"\n            :disabled="rateUpdateEligibilityLoading"\n            @click="beginRateUpdate"\n          >\n            Actualizar tarifa\n          </DhButton>\n          <span v-else-if="rateUpdateEligibilityLoading" class="text-xs font-bold text-[var(--dh-text-muted)]">Validando actualización…</span>\n          <span v-else-if="rateUpdateEligibility?.message" class="max-w-sm text-right text-xs font-semibold text-[var(--dh-text-muted)]">{{ rateUpdateEligibility.message }}</span>\n        </div>`,
    'view-only update button',
  )

  const stepbarAnchor = `    <div class="crystal-stepbar grid grid-cols-2 gap-2 p-2 sm:grid-cols-4" :class="viewOnly ? 'xl:grid-cols-9' : 'xl:grid-cols-8'">`
  const reasonPanel = `    <div\n      v-if="isEditing && (!viewOnly || rateUpdatePromptOpen)"\n      class="crystal-soft border border-amber-400/30 bg-amber-400/10 p-4 md:p-5"\n    >\n      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">\n        <div class="min-w-0 flex-1">\n          <p class="text-xs font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Actualización de tarifa</p>\n          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ rateUpdateEligibility?.message || 'Debe indicar el motivo de la actualización antes de guardar.' }}</p>\n          <DhTextarea\n            v-model="rateUpdateReason"\n            class="mt-3"\n            label="Motivo de la actualización *"\n            placeholder="Ej. La naviera actualizó el flete y la vigencia."\n            :rows="3"\n          />\n          <p class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">El motivo quedará registrado en Auditoría. Mínimo 5 caracteres.</p>\n        </div>\n        <div v-if="viewOnly" class="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">\n          <DhButton variant="secondary" @click="cancelRateUpdate">Cancelar</DhButton>\n          <DhButton :disabled="rateUpdateReason.trim().length < 5" @click="continueRateUpdate">Continuar a edición</DhButton>\n        </div>\n      </div>\n    </div>\n\n${stepbarAnchor}`
  code = replaceOne(code, stepbarAnchor, reasonPanel, 'update reason panel')

  code = replaceOne(
    code,
    `async function saveRate() {\n  if (`,
    `async function saveRate() {\n  if (editingRate.value) {\n    if (!rateUpdateEligibility.value?.canUpdate) {\n      toastStore.error(rateUpdateEligibility.value?.message || 'Esta tarifa ya no está habilitada para actualización.')\n      return\n    }\n    if (rateUpdateReason.value.trim().length < 5) {\n      toastStore.error('Debe indicar el motivo de la actualización antes de guardar.')\n      return\n    }\n  }\n\n  if (`,
    'update save validation',
  )

  code = replaceOne(
    code,
    `        quoNumber: editingRate.value.quoNumber ?? null,\n        // Includes / SubjectTo / Excludes already come from baseUpdate, recalculated by`,
    `        quoNumber: editingRate.value.quoNumber ?? null,\n        updateReason: rateUpdateReason.value.trim(),\n        // Includes / SubjectTo / Excludes already come from baseUpdate, recalculated by`,
    'update reason payload',
  )

  code = replaceOne(
    code,
    `      await PricingService.updateRate(editingRate.value.id, updatePayload)\n      rateId = editingRate.value.id`,
    `      await PricingService.updateRate(editingRate.value.id, updatePayload)\n      sessionStorage.removeItem(rateUpdateReasonStorageKey(editingRate.value.id))\n      rateId = editingRate.value.id`,
    'update reason cleanup',
  )

  return code
}

export function pricingRateUpdateWorkflow(): Plugin {
  return {
    name: 'dhole-pricing-rate-update-workflow',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(MAIN_PATH)) {
        if (source.includes(`import './assets/responsive-polish.css'`)) return null
        return { code: `import './assets/responsive-polish.css'\n${source}`, map: null }
      }
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
