import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const LCL_SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardLclSourceSummary] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchSelector(source: string) {
  let code = source

  code = replaceOne(
    code,
    `  matrixVersion: string | null\n}`,
    `  matrixVersion: string | null\n  sourceReference: string\n  sourceTitle: string\n  sourceProvider: string | null\n}`,
    'LCL source metadata interface',
  )

  code = replaceOne(
    code,
    `      notes: sourceBasis.includes('cbm')\n        ? \`LCL PROPIO · Base del Excel: \${line.chargeBasis}.\`\n        : \`LCL PROPIO · Base del Excel: \${line.chargeBasis}; cantidad aplicada: 1.\`,`,
    `      notes: sourceBasis.includes('cbm')\n        ? \`LCL PROPIO · Fuente LCL: Propio · Consolidado: #\${calculation.consolidationNumber} · Base del Excel: \${line.chargeBasis}.\`\n        : \`LCL PROPIO · Fuente LCL: Propio · Consolidado: #\${calculation.consolidationNumber} · Base del Excel: \${line.chargeBasis}; cantidad aplicada: 1.\`,`,
    'own LCL persisted consolidation marker',
  )

  code = replaceOne(
    code,
    `      label: \`\${row.name} · \${row.polName || row.polCode}\`,\n      requestedCbm: cbm,`,
    `      label: \`\${row.name} · \${row.polName || row.polCode}\`,\n      sourceReference: String(calculation.consolidationNumber),\n      sourceTitle: \`Consolidado propio #\${calculation.consolidationNumber}\`,\n      sourceProvider: 'Grupo Castro Fallas',\n      requestedCbm: cbm,`,
    'own LCL selection metadata',
  )

  code = replaceOne(
    code,
    `    notes: line.notes,`,
    `    notes: [\`Fuente LCL: Coloader · Tarifario: \${rate.rateCode}\`, line.notes].filter(Boolean).join(' · '),`,
    'coloader persisted source marker',
  )

  code = replaceOne(
    code,
    `    label: \`\${rate.providerName || rate.providerCode || 'Coloader'} · \${rate.rateCode}\`,\n    requestedCbm: cbm,`,
    `    label: \`\${rate.providerName || rate.providerCode || 'Coloader'} · \${rate.rateCode}\`,\n    sourceReference: rate.rateCode || rate.id,\n    sourceTitle: \`Coloader · \${rate.rateCode || rate.rateName}\`,\n    sourceProvider: rate.providerName || rate.providerCode || 'Coloader',\n    requestedCbm: cbm,`,
    'coloader selection metadata',
  )

  return code
}

function sourceCard() {
  return `<div v-if="lclSourceSummary" class="mt-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3">
              <p class="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">Fuente LCL utilizada</p>
              <div class="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <span><span class="text-[var(--dh-text-muted)]">Tipo:</span> <strong>{{ lclSourceSummary.typeLabel }}</strong></span>
                <span><span class="text-[var(--dh-text-muted)]">{{ lclSourceSummary.referenceCaption }}:</span> <strong>{{ lclSourceSummary.referenceLabel }}</strong></span>
                <span v-if="lclSourceSummary.provider"><span class="text-[var(--dh-text-muted)]">Proveedor:</span> <strong>{{ lclSourceSummary.provider }}</strong></span>
              </div>
              <p v-if="lclSourceSummary.title" class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ lclSourceSummary.title }}</p>
            </div>`
}

function patchWizard(source: string) {
  let code = source

  const commercialLinesAnchor = `const commercialOutputLines = computed(() => includedLines.value.filter((line) =>\n  !isOwnLclExcelRate.value || !line.costId,\n))`
  const summaryCode = `${commercialLinesAnchor}\n\ntype LclSourceSummary = {\n  typeLabel: 'Propio' | 'Coloader'\n  referenceCaption: string\n  referenceLabel: string\n  provider: string | null\n  title: string | null\n}\n\nfunction persistedLclSourceSummary(): LclSourceSummary | null {\n  const notes = rateLines.value\n    .map((line) => String(line.notes ?? '').trim())\n    .filter(Boolean)\n\n  const ownNote = notes.find((note) => /Fuente LCL:\\s*Propio/i.test(note) || /LCL\\s*PROPIO/i.test(note))\n  if (ownNote) {\n    const consolidation = ownNote.match(/Consolidado:\\s*#?([0-9]+)/i)?.[1] ?? ''\n    return {\n      typeLabel: 'Propio',\n      referenceCaption: 'Consolidado',\n      referenceLabel: consolidation ? \`#\${consolidation}\` : 'No registrado',\n      provider: editingRate.value?.agentName || 'Grupo Castro Fallas',\n      title: consolidation ? \`Consolidado propio #\${consolidation}\` : 'Consolidado propio',\n    }\n  }\n\n  const coloaderNote = notes.find((note) => /Fuente LCL:\\s*Coloader/i.test(note))\n  if (coloaderNote) {\n    const rateCode = coloaderNote.match(/Tarifario:\\s*([^·]+)/i)?.[1]?.trim() ?? ''\n    return {\n      typeLabel: 'Coloader',\n      referenceCaption: 'Tarifa / referencia',\n      referenceLabel: rateCode || 'No registrada',\n      provider: editingRate.value?.agentName || editingRate.value?.agentCode || 'Coloader',\n      title: rateCode ? \`Coloader · \${rateCode}\` : 'Tarifa de coloader',\n    }\n  }\n\n  return null\n}\n\nconst lclSourceSummary = computed<LclSourceSummary | null>(() => {\n  if (shipmentModeForApi.value !== 'Lcl') return null\n\n  const selected = lclSelectedSource.value\n  if (selected) {\n    const own = selected.kind === 'Own'\n    return {\n      typeLabel: own ? 'Propio' : 'Coloader',\n      referenceCaption: own ? 'Consolidado' : 'Tarifa / referencia',\n      referenceLabel: own ? \`#\${selected.sourceReference}\` : selected.sourceReference,\n      provider: selected.sourceProvider || selected.providerName || selected.providerCode || (own ? 'Grupo Castro Fallas' : 'Coloader'),\n      title: selected.sourceTitle || selected.label || null,\n    }\n  }\n\n  return persistedLclSourceSummary()\n})`
  code = replaceOne(code, commercialLinesAnchor, summaryCode, 'LCL source summary state')

  const draftDescription = `<p class="crystal-description">Revise los datos antes de crear la tarifa. Atrás permite corregir cualquier pantalla.</p>`
  code = replaceOne(
    code,
    draftDescription,
    `${draftDescription}\n            ${sourceCard()}`,
    'draft LCL source card',
  )

  const screen09Description = `<p class="crystal-description">Resumen integral de la revisión actual, decisión comercial, líneas, condiciones y totales.</p>`
  code = replaceOne(
    code,
    screen09Description,
    `${screen09Description}\n              ${sourceCard()}`,
    'screen 09 LCL source card',
  )

  return code
}

export function pricingWizardLclSourceSummary(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-source-summary',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(LCL_SELECTOR_PATH)) return { code: patchSelector(source), map: null }
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      return null
    },
  }
}
