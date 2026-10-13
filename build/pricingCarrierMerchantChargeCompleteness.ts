import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-carrier-merchant-charge-completeness-20261013'

// Pricing validates naviera/agente, servicios, modalidad, incoterm and all selected ports.
// A configured cost is identified by CostId, not by its display name.
export function restoreCarrierMerchantCostLines(source: string): string {
  if (source.includes(MARKER)) return source
  const rebuildStart = source.indexOf('function rebuildRateLines() {')
  const mergeStart = source.indexOf('function mergeConfiguredOptionalCostsIntoRateLines(', rebuildStart)
  const addManualStart = source.indexOf('function addManualCharge() {', mergeStart)
  if (rebuildStart < 0 || mergeStart < 0 || addManualStart < 0) {
    throw new Error('[pricingCarrierMerchantChargeCompleteness] Missing wizard charge functions')
  }

  let rebuild = source.slice(rebuildStart, mergeStart)
  const oldDuplicate = [
    '  const hasEquivalent = (name: string, detailType: CostDetailType) =>',
    '    lines.some((line) =>',
    '      line.costDetailType === detailType &&',
    '      normalizeCatalogValue(line.name) === normalizeCatalogValue(name),',
    '    )',
  ].join('\n')
  // Older wizard sources still contain name-based deduplication; the newer
  // Screen4 plugin has already removed it. Both states are supported.
  if (rebuild.includes(oldDuplicate)) {
    if (!rebuild.includes('if (hasEquivalent(cost.name, cost.costDetailType)) return')) {
      throw new Error('[pricingCarrierMerchantChargeCompleteness] Rebuild guard changed')
    }
    rebuild = rebuild.replace(oldDuplicate,
      '  const hasEquivalent = (costId: string) => lines.some((line) => line.costId === costId)')
    rebuild = rebuild.replace('if (hasEquivalent(cost.name, cost.costDetailType)) return',
      'if (hasEquivalent(cost.id)) return')
  } else if (rebuild.includes('if (hasEquivalent(cost.name, cost.costDetailType)) return')) {
    throw new Error('[pricingCarrierMerchantChargeCompleteness] Rebuild mismatch')
  }

  let merge = source.slice(mergeStart, addManualStart)
  if (merge.includes('existingKeys.has(equivalentKey)')) {
    merge = merge.replace(/\n  const existingKeys = new Set\([\s\S]*?\n  \)\n/, '\n')
    merge = merge.replace(/\n\s+const equivalentKey = [^\n]+\n/, '\n')
    merge = merge.replace(
      /if \(!visible\.has\(section\) \|\| existingCostIds\.has\(cost\.id\) \|\| existingKeys\.has\(equivalentKey\)\) return/,
      'if (existingCostIds.has(cost.id)) return',
    )
    if (merge.includes('existingKeys.has(equivalentKey)')) {
      throw new Error('[pricingCarrierMerchantChargeCompleteness] Optional guard not updated')
    }
  } else if (!merge.includes('existingCostIds.has(cost.id)')) {
    throw new Error('[pricingCarrierMerchantChargeCompleteness] Missing CostId dedupe in merge')
  }
  if (!/\bvisible\b/.test(merge.replace('  const visible = new Set(visibleSections.value)', ''))) {
    merge = merge.replace('  const visible = new Set(visibleSections.value)\n', '')
  }

  let code = source.slice(0, rebuildStart) + rebuild + merge + source.slice(addManualStart)

  // Prefer the persisted CostId over a shared description during edit/revision.
  const editStart = code.indexOf('function syncPersistedLinesWithChangedConfiguredCosts()')
  const loaderStart = code.indexOf('async function loadApplicableCosts()', editStart)
  if (editStart >= 0 && loaderStart > editStart) {
    let edit = code.slice(editStart, loaderStart)
    const lookup = '    const sameLogicalCharge = configuredCosts.find('
    if (edit.includes(lookup)) {
      edit = edit.replace(lookup,
        '    const exactCost = line.costId ? configuredCosts.find((cost) => cost.id === line.costId) : null\n'
        + '    if (exactCost) return exactCost\n\n'
        + lookup)
    }
    code = code.slice(0, editStart) + edit + code.slice(loaderStart)
  }

  // Subtotals must not combine two distinct agent charges with the same name.
  const providerStart = code.indexOf('const providerAgentCosts = computed(')
  const providerEnd = code.indexOf('const providerAgentCost = computed(', providerStart)
  if (providerStart >= 0 && providerEnd > providerStart) {
    const provider = code.slice(providerStart, providerEnd)
      .replace('const key = normalizeCatalogValue(cost.name)', 'const key = cost.id')
    code = code.slice(0, providerStart) + provider + code.slice(providerEnd)
  }

  // The legacy PortId holds only the first configured POL/POE/POD.
  // Previous relation matchers already verified the complete selected-port list.
  const legacyStart = code.indexOf('function finalOptionalLegacyPortMatches(')
  const legacyEnd = code.indexOf('\n}\n', legacyStart)
  if (legacyStart >= 0 && legacyEnd > legacyStart) {
    let legacy = code.slice(legacyStart, legacyEnd)
    const roleAnchor = "  const role = String(cost.portRole ?? '').toLowerCase()"
    if (!legacy.includes(roleAnchor)) {
      throw new Error('[pricingCarrierMerchantChargeCompleteness] Optional port anchor changed')
    }
    legacy = legacy.replace(roleAnchor, roleAnchor + '\n'
      + "  const relation = role === 'pol' ? cost.pols : role === 'poe' ? cost.poes : role === 'pod' ? cost.pods : null\n"
      + '  if (Array.isArray(relation) && relation.length > 0) return true')
    code = code.slice(0, legacyStart) + legacy + code.slice(legacyEnd)
  }

  // All configured Optionals (including insurance) stay selectable on Screen 7;
  // automatic inclusion remains governed by actual operational conditions.
  const optionalStart = code.indexOf('const selectableOptionalLines = computed(')
  const optionalEnd = code.indexOf('const optionalChargeOptions = computed(', optionalStart)
  if (optionalStart >= 0 && optionalEnd > optionalStart) {
    const optional = code.slice(optionalStart, optionalEnd)
      .replace(/^\s*&& line\.costDetailType !== 'Insurance'\s*\n/m, '\n')
    code = code.slice(0, optionalStart) + optional + code.slice(optionalEnd)
  }

  return code.replace('function rebuildRateLines() {', MARKER + '\nfunction rebuildRateLines() {')
}

export function pricingCarrierMerchantChargeCompleteness(): Plugin {
  return {
    name: 'dhole-pricing-carrier-merchant-charge-completeness',
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll('\\', '/').endsWith(WIZARD_PATH)) return null
      return { code: restoreCarrierMerchantCostLines(source), map: null }
    },
  }
}
