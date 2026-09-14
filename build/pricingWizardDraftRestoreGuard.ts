import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingWizardDraftRestoreGuard] Missing ${label} anchor.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  // Draft schema v2 deliberately stops trusting derived Pantalla 5 state from
  // localStorage. v1 drafts are still migrated, but only their user-entered fields
  // are restored so an old tariff DTO cannot crash the whole wizard at render time.
  code = replaceRequired(
    code,
    `const PRICING_DRAFT_VERSION = 1`,
    `const PRICING_DRAFT_VERSION = 2`,
    'draft version',
  )

  const restoreAnchor = `async function restorePricingDraft() {`
  const restoreHelpers = `function restorePricingDraftFormSafely(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const draftForm = value as Record<string, unknown>
  const target = form as unknown as Record<string, unknown>

  for (const key of Object.keys(target)) {
    if (!(key in draftForm)) continue
    const current = target[key]
    const incoming = draftForm[key]

    if (Array.isArray(current)) {
      target[key] = Array.isArray(incoming)
        ? incoming.filter((item) => typeof item === 'string')
        : []
      continue
    }
    if (typeof current === 'string') {
      target[key] = typeof incoming === 'string' ? incoming : incoming == null ? '' : String(incoming)
      continue
    }
    if (typeof current === 'number') {
      const parsed = Number(incoming)
      target[key] = Number.isFinite(parsed) ? parsed : current
      continue
    }
    if (typeof current === 'boolean') {
      target[key] = typeof incoming === 'boolean' ? incoming : current
      continue
    }
    if (current === null) {
      if (incoming == null || incoming === '') target[key] = null
      else {
        const parsed = Number(incoming)
        target[key] = Number.isFinite(parsed) ? parsed : null
      }
    }
  }

  // Selection state belongs to Pantalla 5 and must always be rebuilt against the
  // current API/catalog data instead of trusting an older browser snapshot.
  form.selectedImportRateId = ''
}

function sanitizeDraftFclExtraContainers(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
    .map((row) => ({
      key: typeof row.key === 'string' && row.key ? row.key : crypto.randomUUID(),
      containerTypeId: typeof row.containerTypeId === 'string' ? row.containerTypeId : '',
      quantity: Math.max(1, Math.trunc(Number(row.quantity) || 1)),
    }))
    .filter((row) => row.containerTypeId)
}

${restoreAnchor}`
  code = replaceRequired(code, restoreAnchor, restoreHelpers, 'draft restore function')

  code = replaceRequired(
    code,
    `      Number(draft.version) !== PRICING_DRAFT_VERSION ||`,
    `      ![1, PRICING_DRAFT_VERSION].includes(Number(draft.version)) ||`,
    'draft version validation',
  )

  code = replaceRequired(
    code,
    `    if (draft.form && typeof draft.form === 'object') Object.assign(form, draft.form)`,
    `    restorePricingDraftFormSafely(draft.form)`,
    'unsafe form assignment',
  )

  code = replaceRequired(
    code,
    `    if (Array.isArray(draft.availableRates)) availableRates.value = draft.availableRates
    if (typeof draft.rateCarrierFilter === 'string') rateCarrierFilter.value = draft.rateCarrierFilter
    if (Array.isArray(draft.fclExtraContainers)) fclExtraContainers.value = draft.fclExtraContainers
    if (draft.fclRatesByContainer && typeof draft.fclRatesByContainer === 'object') fclRatesByContainer.value = draft.fclRatesByContainer
    if (typeof draft.selectedFclBundleKey === 'string') selectedFclBundleKey.value = draft.selectedFclBundleKey
    if (draft.fclSelectedImportRateIds && typeof draft.fclSelectedImportRateIds === 'object') {
      fclSelectedImportRateIds.value = draft.fclSelectedImportRateIds
    }
    if (typeof draft.lclSelectedSourceKey === 'string') lclSelectedSourceKey.value = draft.lclSelectedSourceKey
    if (Number.isFinite(Number(draft.lclRequestedCbm))) lclRequestedCbm.value = Number(draft.lclRequestedCbm)
    if (draft.lclSelectedSource && typeof draft.lclSelectedSource === 'object') lclSelectedSource.value = draft.lclSelectedSource`,
    `    // Never restore cached/derived tariff results. They can have a different DTO
    // shape after a deployment and were the source of the blank wizard on draft load.
    availableRates.value = []
    rateCarrierFilter.value = ''
    fclExtraContainers.value = sanitizeDraftFclExtraContainers(draft.fclExtraContainers)
    fclRatesByContainer.value = {}
    selectedFclBundleKey.value = ''
    fclSelectedImportRateIds.value = {}
    lclSelectedSourceKey.value = ''
    if (Number.isFinite(Number(draft.lclRequestedCbm))) lclRequestedCbm.value = Number(draft.lclRequestedCbm)
    lclSelectedSource.value = null`,
    'derived draft state restore',
  )

  const stepAndSourceAnchor = `    const minimumStep = props.rateRequestId ? 5 : 1
    const maximumStep = props.sellerRequestMode ? 4 : maxStep.value
    const restoredStep = Math.trunc(Number(draft.step || minimumStep))
    step.value = Math.min(maximumStep, Math.max(minimumStep, restoredStep))

    if (availableRates.value.length) {
      await loadImportSources(availableRates.value)
    }

    // The split container selector persists the resolved equipment ID directly.
    // Legacy wizard watchers still observe equipmentSize/equipmentType and may clear
    // equipmentId while a draft is being restored. Let those queued watchers finish
    // and then re-apply the persisted equipment selection.
    await Promise.resolve()
    if (draft.form && typeof draft.form === 'object' && typeof draft.form.equipmentId === 'string') {
      form.equipmentId = draft.form.equipmentId
    }`

  const stepAndSourceReplacement = `    const minimumStep = props.rateRequestId ? 5 : 1
    const maximumStep = props.sellerRequestMode ? 4 : maxStep.value
    const restoredStep = Math.trunc(Number(draft.step || minimumStep))
    const safeRestoredStep = Math.min(maximumStep, Math.max(minimumStep, restoredStep))

    // For a normal new quote, resume at most on Pantalla 4. Pantalla 5+ depends on
    // live tariff/catalog responses and is recalculated when the user continues.
    // Existing seller/rate-request flows keep their own minimum step behavior.
    step.value = props.rateRequestId
      ? safeRestoredStep
      : Math.min(safeRestoredStep, props.sellerRequestMode ? 4 : 4)

    await Promise.resolve()
    const draftForm = draft.form && typeof draft.form === 'object'
      ? draft.form as Record<string, unknown>
      : null
    if (draftForm && typeof draftForm.equipmentId === 'string') {
      form.equipmentId = draftForm.equipmentId
    }`

  code = replaceRequired(code, stepAndSourceAnchor, stepAndSourceReplacement, 'draft step/source restore')

  code = replaceRequired(
    code,
    `    toastStore.success('Borrador recuperado', 'Se restauró automáticamente la tarifa que estaba en proceso.')`,
    `    toastStore.success(
      'Borrador recuperado',
      safeRestoredStep >= 5 && !props.rateRequestId
        ? 'Se recuperaron los datos capturados. Las tarifas se consultarán nuevamente al continuar a Pantalla 5.'
        : 'Se restauró automáticamente la tarifa que estaba en proceso.',
    )`,
    'draft restored toast',
  )

  // If anything in a legacy/corrupt draft still fails, invalidate only that browser
  // snapshot and keep the wizard mounted instead of letting the error surface as a
  // blank page on the next render.
  code = replaceRequired(
    code,
    `  } catch {
    clearPricingDraft(false)
  } finally {`,
    `  } catch (error) {
    console.warn('[pricing-draft] Se descartó un borrador incompatible.', error)
    clearPricingDraft(false)
    availableRates.value = []
    fclRatesByContainer.value = {}
    selectedFclBundleKey.value = ''
    fclSelectedImportRateIds.value = {}
    lclSelectedSource.value = null
    step.value = props.rateRequestId ? 5 : 1
    toastStore.warning(
      'Borrador incompatible descartado',
      'El borrador anterior no era compatible con la versión actual. Puede continuar creando la tarifa normalmente.',
    )
  } finally {`,
    'draft restore catch',
  )

  return code
}

export function pricingWizardDraftRestoreGuard(): Plugin {
  return {
    name: 'dhole-pricing-wizard-draft-restore-guard',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
