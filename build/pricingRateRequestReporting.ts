import type { Plugin } from 'vite'

const SCOPES_PATH = '/src/core/auth/scopes.ts'
const ROUTER_PATH = '/src/core/router/index.ts'
const SIDEBAR_PATH = '/src/core/composables/useSidebarItems.ts'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingRateRequestReporting] ${label} anchor not found.`)
  }
  return source.replace(anchor, replacement)
}

function patchScopes(source: string) {
  let code = source
  if (!code.includes(`viewAll: 'pricing.rate-request.view-all'`)) {
    code = replaceRequired(
      code,
      `  ownLclConsolidations: {\n    create: 'pricing.own-lcl-consolidation.create',\n  },\n\n  rates: {`,
      `  ownLclConsolidations: {\n    create: 'pricing.own-lcl-consolidation.create',\n  },\n\n  rateRequests: {\n    create: 'pricing.rate-request.create',\n    viewAll: 'pricing.rate-request.view-all',\n  },\n\n  rates: {`,
      'rate request scope constants',
    )
  }

  if (!code.includes(`pricingRateRequests: PRICING_SCOPES.rateRequests.viewAll`)) {
    code = replaceRequired(
      code,
      `  pricingRateTerms: PRICING_SCOPES.rateTerms.view,`,
      `  pricingRateTerms: PRICING_SCOPES.rateTerms.view,\n  pricingRateRequests: PRICING_SCOPES.rateRequests.viewAll,`,
      'requested-rate view scope alias',
    )
  }
  return code
}

function patchRouter(source: string) {
  if (source.includes(`path: 'pricing/requested-rates'`)) return source
  return replaceRequired(
    source,
    `        {\n          path: 'pricing/costs',`,
    `        {\n          path: 'pricing/requested-rates',\n          name: 'pricing-requested-rates',\n          component: () => import('@/modules/pricing/views/PricingRequestedRatesReportView.vue'),\n          meta: {\n            tabTitle: 'Tarifas solicitadas',\n            closable: true,\n            requiredScope: VIEW_SCOPES.pricingRateRequests,\n          },\n        },\n        {\n          path: 'pricing/costs',`,
    'requested-rate report route',
  )
}

function patchSidebar(source: string) {
  if (source.includes(`to: '/pricing/requested-rates'`)) return source
  return replaceRequired(
    source,
    `          {\n            labelKey: 'sidebar.costs',`,
    `          {\n            labelKey: 'Tarifas solicitadas',\n            icon: ClipboardList,\n            to: '/pricing/requested-rates',\n            name: 'pricing-requested-rates',\n            requiredScope: VIEW_SCOPES.pricingRateRequests,\n          },\n          {\n            labelKey: 'sidebar.costs',`,
    'requested-rate report navigation',
  )
}

export function pricingRateRequestReporting(): Plugin {
  return {
    name: 'dhole-pricing-rate-request-reporting',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (normalizedId.endsWith(SCOPES_PATH)) return { code: patchScopes(source), map: null }
      if (normalizedId.endsWith(ROUTER_PATH)) return { code: patchRouter(source), map: null }
      if (normalizedId.endsWith(SIDEBAR_PATH)) return { code: patchSidebar(source), map: null }
      return null
    },
  }
}
