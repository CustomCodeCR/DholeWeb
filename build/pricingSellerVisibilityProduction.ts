import type { Plugin } from 'vite'

const ROUTER_PATH = '/src/core/router/index.ts'
const SIDEBAR_PATH = '/src/core/composables/useSidebarItems.ts'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingSellerVisibilityProduction] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchRouter(source: string) {
  if (source.includes(`path: 'pricing/seller-visibility'`)) return source
  return replaceRequired(
    source,
    `        {\n          path: 'pricing/costs',`,
    `        {\n          path: 'pricing/seller-visibility',\n          name: 'pricing-seller-visibility',\n          component: () => import('@/modules/pricing/views/PricingSellerVisibilityView.vue'),\n          meta: {\n            tabTitle: 'Visibilidad comercial',\n            closable: true,\n            requiredScope: 'pricing.rate-request.visibility.manage',\n          },\n        },\n        {\n          path: 'pricing/costs',`,
    'seller visibility route',
  )
}

function patchSidebar(source: string) {
  if (source.includes(`to: '/pricing/seller-visibility'`)) return source
  return replaceRequired(
    source,
    `          {\n            labelKey: 'sidebar.costs',`,
    `          {\n            labelKey: 'Visibilidad comercial',\n            icon: Users,\n            to: '/pricing/seller-visibility',\n            name: 'pricing-seller-visibility',\n            requiredScope: 'pricing.rate-request.visibility.manage',\n          },\n          {\n            labelKey: 'sidebar.costs',`,
    'seller visibility navigation',
  )
}

export function pricingSellerVisibilityProduction(): Plugin {
  return {
    name: 'dhole-pricing-seller-visibility-production',
    transform(source, id) {
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(ROUTER_PATH)) return { code: patchRouter(source), map: null }
      if (normalizedId.endsWith(SIDEBAR_PATH)) return { code: patchSidebar(source), map: null }
      return null
    },
  }
}
