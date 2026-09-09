import type { Plugin } from 'vite'

const ROUTER_PATH = '/src/core/router/index.ts'
const SIDEBAR_PATH = '/src/core/composables/useSidebarItems.ts'
const SELLER_ASSIGNMENT_SCOPE = 'pricing.seller.assignment.manage'

function patchRouter(source: string) {
  if (source.includes(`path: 'pricing/seller-visibility'`)) return source

  const pathIndex = source.indexOf(`path: 'pricing/costs'`)
  if (pathIndex < 0) throw new Error('[pricingSellerVisibilityProduction] pricing costs route not found.')
  const blockStart = source.lastIndexOf('{', pathIndex)
  if (blockStart < 0) throw new Error('[pricingSellerVisibilityProduction] pricing costs route block not found.')

  const route = `        {\n          path: 'pricing/seller-visibility',\n          name: 'pricing-seller-visibility',\n          component: () => import('@/modules/pricing/views/PricingSellerVisibilityView.vue'),\n          meta: {\n            tabTitle: 'Visibilidad comercial',\n            closable: true,\n            requiredScope: '${SELLER_ASSIGNMENT_SCOPE}',\n          },\n        },\n`

  return source.slice(0, blockStart) + route + source.slice(blockStart)
}

function patchSidebar(source: string) {
  if (source.includes(`to: '/pricing/seller-visibility'`)) return source

  const pathIndex = source.indexOf(`to: '/pricing/costs'`)
  if (pathIndex < 0) throw new Error('[pricingSellerVisibilityProduction] pricing costs sidebar item not found.')
  const blockStart = source.lastIndexOf('{', pathIndex)
  if (blockStart < 0) throw new Error('[pricingSellerVisibilityProduction] pricing costs sidebar block not found.')

  const item = `          {\n            labelKey: 'Visibilidad comercial',\n            icon: Users,\n            to: '/pricing/seller-visibility',\n            name: 'pricing-seller-visibility',\n            requiredScope: '${SELLER_ASSIGNMENT_SCOPE}',\n          },\n`

  return source.slice(0, blockStart) + item + source.slice(blockStart)
}

export function pricingSellerVisibilityProduction(): Plugin {
  return {
    name: 'dhole-pricing-seller-visibility-production',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(ROUTER_PATH)) return { code: patchRouter(source), map: null }
      if (normalizedId.endsWith(SIDEBAR_PATH)) return { code: patchSidebar(source), map: null }
      return null
    },
  }
}
