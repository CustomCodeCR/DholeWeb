import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

// Applied after the older wizard transforms, immediately before Vue compiles the SFC.
// Editing a saved quotation must never implicitly turn historical prices into
// zero-valued catalog defaults. Refreshing from the database is an explicit action.
export function patchPricingPersistedEditAttachments20261030(source: string): string {
  let code = source
  const replaceOne = (before: string, after: string, label: string) => {
    const count = code.split(before).length - 1
    if (count !== 1) {
      throw new Error('[pricingPersistedEditAttachments20261030] ' + label + ': expected 1 anchor, got ' + count)
    }
    code = code.replace(before, after)
  }

  const syncStart = 'function syncPersistedLinesWithChangedConfiguredCosts() {\n'
  replaceOne(
    syncStart,
    syncStart + [
      '  // An existing RateDetail is the authority until the operator explicitly',
      '  // chooses "Actualizar desde la base de datos" on screen 7.',
      '  if (props.rateId && editingRate.value && !props.viewOnly && !screen7RefreshAllowed.value) return 0',
      '',
    ].join('\n'),
    'implicit persisted catalog synchronization',
  )

  const preserveStart = 'function shouldPreservePersistedEditLines() {\n'
  replaceOne(
    preserveStart,
    preserveStart + [
      '  // A seller modification edits the existing financial snapshot, not a new tariff.',
      '  // Even when the proposal changes route/equipment, do not regenerate its',
      '  // RateDetails unless Pricing explicitly requests a database refresh.',
      '  if (props.modificationRequestId && editingRate.value',
      '    && rateLines.value.some((line) => Boolean(line.detailId))) return true',
      '',
    ].join('\n'),
    'seller modification financial snapshot',
  )

  const carrierCheck = [
    "  return String(rate.carrierId ?? '') === String(form.carrierId ?? '')",
    "    && String(rate.agentId ?? '') === String(form.agentId ?? '')",
  ].join('\n')
  const coloaderCheck = [
    '  // In a coloader LCL quote, the saved legacy carrier can be non-null, while',
    '  // the correct editing selector deliberately clears it. This is NOT a',
    '  // provider change and must not discard origin/agency/manual line prices.',
    "  const coloaderLcl = String(rate.shipmentMode ?? '').toLowerCase() === 'lcl'",
    '    && !(rate.rateDetails ?? []).some((detail) =>',
    "      /Fuente LCL:\\s*Propio|LCL\\s*PROPIO|ConsolidadoId:/i.test(String(detail.notes ?? '')))",
    '    )',
    "  const carrierMatches = (coloaderLcl && !form.carrierId)",
    "    || String(rate.carrierId ?? '') === String(form.carrierId ?? '')",
    "  return carrierMatches && String(rate.agentId ?? '') === String(form.agentId ?? '')",
  ].join('\n')
  replaceOne(carrierCheck, coloaderCheck, 'LCL coloader provider identity')

  const supportTitle = '<p class="font-black">Documentos de respaldo de la solicitud</p>'
  const supportStart = code.indexOf(supportTitle)
  const nextBlock = '          <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-5">'
  const supportEnd = code.indexOf(nextBlock, supportStart)
  if (supportStart < 0 || supportEnd < 0) {
    throw new Error('[pricingPersistedEditAttachments20261030] Screen 4 documents section not found.')
  }
  let support = code.slice(supportStart, supportEnd)
  const uploadGrid = '<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">'
  if (!support.includes(uploadGrid)) {
    throw new Error('[pricingPersistedEditAttachments20261030] Support upload grid not found.')
  }
  // Read-only view displays the real documents rather than clickable upload labels.
  support = support.replace(uploadGrid, '<div v-if="!viewOnly" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">')
  const removeButton = '<button type="button" class="font-black text-red-500" @click="removeSupportDocument(document)">Eliminar</button>'
  if (!support.includes(removeButton)) {
    throw new Error('[pricingPersistedEditAttachments20261030] Support remove action not found.')
  }
  support = support.replace(removeButton, [
    '<div class="flex shrink-0 flex-wrap items-center gap-3">',
    '  <button type="button" class="font-black text-[var(--dh-primary)]" @click="previewFinalBackup(document)">Ver</button>',
    '  <button type="button" class="font-black text-[var(--dh-primary)]" @click="downloadFinalBackup(document)">Descargar</button>',
    '  <button v-if="sellerRequestMode && !sellerModificationRateId && !viewOnly" type="button" class="font-black text-red-500" @click="removeSupportDocument(document)">Eliminar</button>',
    '</div>',
  ].join('\n'))
  code = code.slice(0, supportStart) + support + [
    '          <!-- Also show the original seller request and final Pricing files on screen 4. -->',
    '          <PricingRateAttachments v-if="editingRate" :rate-id="editingRate.id" :final-documents="finalBackupDocuments" />',
    '',
    '',
  ].join('\n') + code.slice(supportEnd)
  return code
}

export function pricingPersistedEditAttachments20261030(): Plugin {
  return {
    name: 'dhole-pricing-persisted-edit-attachments-20261030',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replaceAll('\\', '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_PATH)) return null
      return { code: patchPricingPersistedEditAttachments20261030(source), map: null }
    },
  }
}
