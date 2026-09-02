import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

export function pricingWizardLclRouteContextFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-route-context-fix',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null

      let code = source

      // Own-LCL pricing needs the actual port identity (Ningbo, Qingdao, etc.).
      // Config catalog codes such as POL-2026-074 are opaque and cannot be used by
      // the China->Shanghai differential matrix. Pass the visible port label instead;
      // coloader matching continues to use the stable pol-id independently.
      const polAnchor = ':pol-code="selectedOrigin?.code ?? null"'
      const polOccurrences = code.split(polAnchor).length - 1
      if (polOccurrences !== 1) {
        throw new Error(`[pricingWizardLclRouteContextFix] Expected one LCL POL context anchor, found ${polOccurrences}.`)
      }
      code = code.replace(polAnchor, ':pol-code="displayValue(selectedOrigin)"')

      // Incoterm catalogs can expose opaque ids/codes and labels such as
      // "Free On Board (FOB)". Normalize punctuation before checking the token so
      // FOB/FCA/EXW are always sent to the own-LCL calculator as their canonical code.
      const incotermBlock = `const selectedIncotermCode = computed(() => {\n  const raw = normalizeCatalogValue(\`${'${selectedIncoterm.value?.code ?? \'\'} ${displayValue(selectedIncoterm.value)}'}\`)\n  if (/(^|\\s)exw(\\s|$)/.test(raw)) return 'EXW'\n  if (/(^|\\s)fca(\\s|$)/.test(raw)) return 'FCA'\n  return String(selectedIncoterm.value?.code ?? displayValue(selectedIncoterm.value)).trim().toUpperCase()\n})`
      const incotermOccurrences = code.split(incotermBlock).length - 1
      if (incotermOccurrences !== 1) {
        throw new Error(`[pricingWizardLclRouteContextFix] Expected one Incoterm normalization block, found ${incotermOccurrences}.`)
      }

      const incotermReplacement = `const selectedIncotermCode = computed(() => {\n  const raw = normalizeCatalogValue(\`${'${selectedIncoterm.value?.code ?? \'\'} ${displayValue(selectedIncoterm.value)}'}\`)\n  const tokens = \` ${'${raw.replace(/[^a-z0-9]+/g, \' \').replace(/\\s+/g, \' \').trim()}'} \`\n  if (tokens.includes(' exw ')) return 'EXW'\n  if (tokens.includes(' fca ')) return 'FCA'\n  if (tokens.includes(' fob ')) return 'FOB'\n  return String(selectedIncoterm.value?.code ?? displayValue(selectedIncoterm.value)).trim().toUpperCase()\n})`

      code = code.replace(incotermBlock, incotermReplacement)

      return { code, map: null }
    },
  }
}
