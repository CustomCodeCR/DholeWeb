import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceExactlyOnce(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardDraftEquipmentRestoreFix] Expected one ${label} anchor, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function restoreRateRequestEquipmentAfterHydration(source: string) {
  const functionAnchor = 'async function hydrateRateRequest() {'
  const functionStart = source.indexOf(functionAnchor)
  if (functionStart < 0) {
    throw new Error('[pricingWizardDraftEquipmentRestoreFix] Missing rate request hydration function.')
  }

  const functionEnd = source.indexOf('\n}\n\nfunction modalityForRate', functionStart)
  if (functionEnd < 0) {
    throw new Error('[pricingWizardDraftEquipmentRestoreFix] Could not locate the end of rate request hydration.')
  }

  const assignmentAnchor = 'Object.assign(form, request.payload.form)'
  const assignmentIndex = source.indexOf(assignmentAnchor, functionStart)
  if (assignmentIndex < 0 || assignmentIndex >= functionEnd) {
    throw new Error('[pricingWizardDraftEquipmentRestoreFix] Missing rate request form hydration assignment.')
  }

  const stepAnchor = '    step.value = 5'
  const stepIndex = source.indexOf(stepAnchor, assignmentIndex)
  if (stepIndex < 0 || stepIndex >= functionEnd) {
    throw new Error('[pricingWizardDraftEquipmentRestoreFix] Missing rate request step restore anchor.')
  }

  const restoreBlock = `    // The seller request persists the resolved container ID in payload.form.\n    // Several legacy size/type watchers are queued by Object.assign and can clear\n    // equipmentId after hydration. Wait for those watchers and restore the ID before\n    // Pricing searches the approved rates for Pantalla 5.\n    await Promise.resolve()\n    const persistedRequestEquipmentId =\n      request.payload?.form &&\n      typeof request.payload.form === 'object' &&\n      typeof request.payload.form.equipmentId === 'string'\n        ? request.payload.form.equipmentId\n        : ''\n    if (persistedRequestEquipmentId) {\n      form.equipmentId = persistedRequestEquipmentId\n    }\n\n`

  return source.slice(0, stepIndex) + restoreBlock + source.slice(stepIndex)
}

function patchWizard(source: string) {
  const draftAnchor = `    if (availableRates.value.length) {\n      await loadImportSources(availableRates.value)\n    }\n\n    pricingDraftLastSnapshot = raw`

  const draftReplacement = `    if (availableRates.value.length) {\n      await loadImportSources(availableRates.value)\n    }\n\n    // The split container selector persists the resolved equipment ID directly.\n    // Legacy wizard watchers still observe equipmentSize/equipmentType and may clear\n    // equipmentId while a draft is being restored. Let those queued watchers finish\n    // and then re-apply the persisted equipment selection.\n    await Promise.resolve()\n    if (draft.form && typeof draft.form === 'object' && typeof draft.form.equipmentId === 'string') {\n      form.equipmentId = draft.form.equipmentId\n    }\n\n    pricingDraftLastSnapshot = raw`

  let code = replaceExactlyOnce(source, draftAnchor, draftReplacement, 'draft restore')
  code = restoreRateRequestEquipmentAfterHydration(code)
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
