import type { Plugin } from 'vite'

const SCOPES_PATH = '/src/core/auth/scopes.ts'
const ROUTER_PATH = '/src/core/router/index.ts'
const SIDEBAR_PATH = '/src/core/composables/useSidebarItems.ts'
const REPORT_VIEW_ALL_SCOPE = 'pricing.rate-request.report.view-all'

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
      `  ownLclConsolidations: {\n    create: 'pricing.own-lcl-consolidation.create',\n  },\n\n  rateRequests: {\n    create: 'pricing.rate-request.create',\n    viewSelected: 'pricing.rate-request.view-selected',\n    viewAll: 'pricing.rate-request.view-all',\n    reportViewAll: '${REPORT_VIEW_ALL_SCOPE}',\n    manageVisibility: 'pricing.rate-request.visibility.manage',\n  },\n\n  rates: {`,
      'rate request scope constants',
    )
  } else if (!code.includes(`reportViewAll: '${REPORT_VIEW_ALL_SCOPE}'`)) {
    code = replaceRequired(
      code,
      `    viewAll: 'pricing.rate-request.view-all',`,
      `    viewAll: 'pricing.rate-request.view-all',\n    reportViewAll: '${REPORT_VIEW_ALL_SCOPE}',`,
      'requested-rate report scope constant',
    )
  }

  if (!code.includes(`pricingRateRequests: PRICING_SCOPES.rateRequests.viewAll`)) {
    code = replaceRequired(
      code,
      `  pricingRateTerms: PRICING_SCOPES.rateTerms.view,`,
      `  pricingRateTerms: PRICING_SCOPES.rateTerms.view,\n  pricingRateRequests: PRICING_SCOPES.rateRequests.viewAll,\n  pricingRateRequestsSelected: PRICING_SCOPES.rateRequests.viewSelected,\n  pricingRateRequestReportAll: PRICING_SCOPES.rateRequests.reportViewAll,\n  pricingRateRequestVisibility: PRICING_SCOPES.rateRequests.manageVisibility,`,
      'requested-rate view scope aliases',
    )
  } else if (!code.includes(`pricingRateRequestReportAll:`)) {
    code = replaceRequired(
      code,
      `  pricingRateRequestsSelected: PRICING_SCOPES.rateRequests.viewSelected,`,
      `  pricingRateRequestsSelected: PRICING_SCOPES.rateRequests.viewSelected,\n  pricingRateRequestReportAll: PRICING_SCOPES.rateRequests.reportViewAll,`,
      'requested-rate report scope alias',
    )
  }
  return code
}

function patchRouter(source: string) {
  if (source.includes(`path: 'pricing/requested-rates'`)) return source

  const pathIndex = source.indexOf(`path: 'pricing/costs'`)
  if (pathIndex < 0) {
    throw new Error('[pricingRateRequestReporting] pricing costs route not found.')
  }

  const blockStart = source.lastIndexOf('        {', pathIndex)
  if (blockStart < 0) {
    throw new Error('[pricingRateRequestReporting] pricing costs route block not found.')
  }

  const route = `        {\n          path: 'pricing/requested-rates',\n          name: 'pricing-requested-rates',\n          component: () => import('@/modules/pricing/views/PricingRequestedRatesReportView.vue'),\n          meta: {\n            tabTitle: 'Tarifas solicitadas',\n            closable: true,\n            requiredAnyScopes: [\n              'pricing.rate-request.view-selected',\n              'pricing.rate-request.view-all',\n              '${REPORT_VIEW_ALL_SCOPE}',\n            ],\n          },\n        },\n`

  return source.slice(0, blockStart) + route + source.slice(blockStart)
}

function patchSidebar(source: string) {
  if (source.includes(`to: '/pricing/requested-rates'`)) return source

  const pathIndex = source.indexOf(`to: '/pricing/costs'`)
  if (pathIndex < 0) {
    throw new Error('[pricingRateRequestReporting] pricing costs sidebar item not found.')
  }

  const blockStart = source.lastIndexOf('          {', pathIndex)
  if (blockStart < 0) {
    throw new Error('[pricingRateRequestReporting] pricing costs sidebar block not found.')
  }

  const item = `          {\n            labelKey: 'Tarifas solicitadas',\n            icon: ClipboardList,\n            to: '/pricing/requested-rates',\n            name: 'pricing-requested-rates',\n            requiredAnyScopes: [\n              'pricing.rate-request.view-selected',\n              'pricing.rate-request.view-all',\n              '${REPORT_VIEW_ALL_SCOPE}',\n            ],\n          },\n`

  return source.slice(0, blockStart) + item + source.slice(blockStart)
}

export function pricingRateRequestReporting(): Plugin {
  return {
    name: 'dhole-pricing-rate-request-reporting',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (normalizedId.endsWith(SCOPES_PATH)) return { code: patchScopes(source), map: null }
      if (normalizedId.endsWith(ROUTER_PATH)) return { code: patchRouter(source), map: null }
      if (normalizedId.endsWith(SIDEBAR_PATH)) return { code: patchSidebar(source), map: null }
      return null
    },
  }
}
