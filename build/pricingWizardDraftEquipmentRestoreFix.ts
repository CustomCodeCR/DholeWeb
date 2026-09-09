import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  const anchor = `    if (availableRates.value.length) {\n      await loadImportSources(availableRates.value)\n    }\n\n    pricingDraftLastSnapshot = raw`

  const replacement = `    if (availableRates.value.length) {\n      await loadImportSources(availableRates.value)\n    }\n\n    // The split container selector persists the resolved equipment ID directly.\n    // Legacy wizard watchers still observe equipmentSize/equipmentType and may clear\n    // equipmentId while a draft is being restored. Let those queued watchers finish\n    // and then re-apply the persisted equipment selection.\n    await Promise.resolve()\n    if (draft.form && typeof draft.form === 'object' && typeof draft.form.equipmentId === 'string') {\n      form.equipmentId = draft.form.equipmentId\n    }\n\n    pricingDraftLastSnapshot = raw`

  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardDraftEquipmentRestoreFix] Expected one draft restore anchor, found ${count}.`)
  }

  return source.replace(anchor, replacement)
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
