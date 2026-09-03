import type { Plugin } from 'vite'

const MAIN_LAYOUT_PATH = '/src/shared/components/layouts/MainLayout.vue'
const ROUTER_PATH = '/src/core/router/index.ts'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingSellerScopeAccess] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function replaceBetween(source: string, start: string, end: string, replacement: string, label: string) {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) throw new Error(`[pricingSellerScopeAccess] Missing ${label} start.`)
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (endIndex < 0) throw new Error(`[pricingSellerScopeAccess] Missing ${label} end.`)
  return source.slice(0, startIndex) + replacement + source.slice(endIndex)
}

function patchMainLayout(source: string) {
  return replaceBetween(
    source,
    `const pricingChildren = computed<SidebarItem[]>(() => {`,
    `\n\nconst reportsChildren`,
    `const pricingChildren = computed<SidebarItem[]>(() => {\n  const children: SidebarItem[] = []\n\n  const canCreateSellerRequest = canView('pricing.rate-request.create')\n  const sellerRequestOnly =\n    canCreateSellerRequest &&\n    !canView('pricing.rate.create') &&\n    !canView('pricing.rate.update') &&\n    !isSuperUser() &&\n    !authStore.hasRole('Pricing')\n\n  const canOpenPricing =\n    canView(VIEW_SCOPES.pricing) ||\n    canView(VIEW_SCOPES.pricingRates) ||\n    canView(VIEW_SCOPES.pricingImports) ||\n    canView(VIEW_SCOPES.pricingDecisions) ||\n    canView(VIEW_SCOPES.pricingCosts) ||\n    canView(VIEW_SCOPES.pricingRateTerms)\n\n  if (canCreateSellerRequest) {\n    children.push({\n      label: 'Solicitar tarifa',\n      path: '/pricing/request-rate',\n      icon: FileText,\n    })\n  }\n\n  if (canView(VIEW_SCOPES.pricingImports)) {\n    children.push({\n      label: t('sidebar.emailImports'),\n      path: '/pricing/email-imports',\n      icon: Mail,\n    })\n    children.push({ label: t('sidebar.importedRates'), path: '/pricing/imports', icon: FileText })\n    children.push({ label: 'Noticias logísticas', path: '/pricing/news', icon: Newspaper })\n  }\n\n  // Un vendedor que únicamente puede crear solicitudes no debe entrar al Wizard\n  // operativo de Pricing. pricing.workspace.access le permite entrar al módulo,\n  // pero no crear/completar tarifas.\n  if (canOpenPricing && !sellerRequestOnly) {\n    children.push({ label: t('sidebar.pricingPanel'), path: '/pricing', icon: TrendingUp })\n  }\n\n  // pricing.rate.view mantiene la consulta de tarifas oficiales para Ventas.\n  if (canView(VIEW_SCOPES.pricingRates)) {\n    children.push({ label: t('sidebar.rates'), path: '/pricing/rates', icon: ReceiptText })\n  }\n\n  if (canView(VIEW_SCOPES.pricingCosts)) {\n    children.push({ label: t('sidebar.costs'), path: '/pricing/costs', icon: BadgeDollarSign })\n  }\n\n  if (canView(VIEW_SCOPES.pricingRateTerms)) {\n    children.push({ label: t('sidebar.rateTerms'), path: '/pricing/rate-terms', icon: ListChecks })\n  }\n\n  return children\n})`,
    'pricing sidebar block',
  )
}

function patchRouter(source: string) {
  const anchor = `  const requiredRole = typeof to.meta.requiredRole === 'string' ? to.meta.requiredRole : null\n\n  if (!isPublic && requiredScope && !authStore.hasScope(requiredScope)) {`
  const replacement = `  const requiredRole = typeof to.meta.requiredRole === 'string' ? to.meta.requiredRole : null\n\n  const sellerRequestOnly =\n    authStore.hasScope('pricing.rate-request.create') &&\n    !authStore.hasScope('pricing.rate.create') &&\n    !authStore.hasScope('pricing.rate.update') &&\n    !authStore.hasRole('Pricing') &&\n    !authStore.hasRole('SuperUsuario') &&\n    !authStore.hasRole('SuperUser')\n\n  // pricing.workspace.access por sí solo no debe abrir el Wizard operativo a Ventas.\n  // Si intentan abrir /pricing directamente o desde una pestaña persistida, enviarlos\n  // al flujo exclusivo de solicitud de tarifa.\n  if (!isPublic && sellerRequestOnly && to.path === '/pricing') {\n    return '/pricing/request-rate'\n  }\n\n  if (!isPublic && requiredScope && !authStore.hasScope(requiredScope)) {`

  return replaceOne(source, anchor, replacement, 'seller route guard')
}

export function pricingSellerScopeAccess(): Plugin {
  return {
    name: 'dhole-pricing-seller-scope-access',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(MAIN_LAYOUT_PATH)) return { code: patchMainLayout(source), map: null }
      if (normalizedId.endsWith(ROUTER_PATH)) return { code: patchRouter(source), map: null }
      return null
    },
  }
}
