import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceExactlyOnce(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardDraftEquipmentRestoreFix] Expected one ${label} anchor, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  const draftAnchor = `    if (availableRates.value.length) {\n      await loadImportSources(availableRates.value)\n    }\n\n    pricingDraftLastSnapshot = raw`

  const draftReplacement = `    if (availableRates.value.length) {\n      await loadImportSources(availableRates.value)\n    }\n\n    // The split container selector persists the resolved equipment ID directly.\n    // Legacy wizard watchers still observe equipmentSize/equipmentType and may clear\n    // equipmentId while a draft is being restored. Let those queued watchers finish\n    // and then re-apply the persisted equipment selection.\n    await Promise.resolve()\n    if (draft.form && typeof draft.form === 'object' && typeof draft.form.equipmentId === 'string') {\n      form.equipmentId = draft.form.equipmentId\n    }\n\n    pricingDraftLastSnapshot = raw`

  let code = replaceExactlyOnce(source, draftAnchor, draftReplacement, 'draft restore')

  const requestAnchor = `    if (request.payload?.form) Object.assign(form, request.payload.form)\n    if (request.payload?.supportEntityId) supportEntityId.value = request.payload.supportEntityId`

  const requestReplacement = `    const persistedRequestEquipmentId =\n      request.payload?.form &&\n      typeof request.payload.form === 'object' &&\n      typeof request.payload.form.equipmentId === 'string'\n        ? request.payload.form.equipmentId\n        : ''\n\n    if (request.payload?.form) Object.assign(form, request.payload.form)\n\n    // The request payload already contains the container selected by Ventas.\n    // The legacy size/type watchers run after Object.assign and can temporarily clear\n    // equipmentId, which made Pantalla 5 show \"Por definir\" even though the dashboard\n    // still had the container label. Re-apply the persisted ID after queued watchers run.\n    await Promise.resolve()\n    if (persistedRequestEquipmentId) {\n      form.equipmentId = persistedRequestEquipmentId\n    }\n\n    if (request.payload?.supportEntityId) supportEntityId.value = request.payload.supportEntityId`

  code = replaceExactlyOnce(code, requestAnchor, requestReplacement, 'rate request equipment restore')
  return code
}

export function pricingWizardDraftEquipmentRestoreFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-draft-equipment-restore-fix',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
