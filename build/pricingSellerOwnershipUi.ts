import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const RATES_PATH = '/src/modules/pricing/views/PricingRatesView.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) throw new Error(`[pricingSellerOwnershipUi] Expected one ${label}, found ${count}.`)
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `import { useModalStore } from '@/core/stores/modalStore'`,
    `import { useModalStore } from '@/core/stores/modalStore'\nimport { useAuthStore } from '@/core/stores/authStore'`,
    'wizard auth import',
  )

  code = replaceOne(
    code,
    `const modalStore = useModalStore()`,
    `const modalStore = useModalStore()\nconst authStore = useAuthStore()`,
    'wizard auth store',
  )

  code = replaceOne(
    code,
    `})\n\nconst stepTitles = [`,
    `})\n\nconst sellerExecutiveLabel = computed(() => {\n  const name = String(authStore.displayName || authStore.userDisplayName || '').trim()\n  const username = String(authStore.username || authStore.email?.split('@')[0] || '').trim()\n  if (name && username) return name.toLowerCase() === username.toLowerCase() ? name : name + ' - ' + username\n  return name || username\n})\n\nwatch(\n  () => [props.sellerRequestMode, sellerExecutiveLabel.value] as const,\n  ([sellerMode, label]) => {\n    if (!sellerMode || !label) return\n    form.executiveId = ''\n    form.executiveName = label\n  },\n  { immediate: true },\n)\n\nconst stepTitles = [`,
    'seller executive computed state',
  )

  code = replaceOne(
    code,
    `async function saveOpenRequest() {\n  if (props.sellerRequestMode) {`,
    `async function saveOpenRequest() {\n  if (props.sellerRequestMode && sellerExecutiveLabel.value) {\n    form.executiveId = ''\n    form.executiveName = sellerExecutiveLabel.value\n  }\n\n  if (props.sellerRequestMode) {`,
    'seller executive save enforcement',
  )

  code = replaceOne(
    code,
    `            supportDocuments: supportDocuments.value,\n            sellerContext: {`,
    `            supportDocuments: supportDocuments.value,\n            requestContext: {\n              executiveName: form.executiveName || null,\n              equipmentType: shipmentModeForApi.value === 'Lcl' ? 'LCL' : displayValue(equipment) || form.equipmentType || form.equipmentSize || null,\n              equipmentQuantity: Math.max(1, Number(form.equipmentQuantity || 1)),\n              modality: form.modality || shipmentModeForApi.value || null,\n              incotermName: displayValue(incoterm) || null,\n            },\n            sellerContext: {`,
    'seller request context',
  )

  code = replaceOne(
    code,
    `              <DhSelect v-if="salesExecutiveOptions.length" v-model="form.executiveId" label="Ejecutivo comercial" placeholder="Seleccione ejecutivo" :options="salesExecutiveOptions" />\n              <DhInput v-else v-model="form.executiveName" label="Ejecutivo comercial" placeholder="Escriba el nombre del ejecutivo" autocomplete="off" />`,
    `              <DhInput v-if="sellerRequestMode" :model-value="sellerExecutiveLabel" label="Ejecutivo comercial" placeholder="Vendedor autenticado" disabled />\n              <DhSelect v-else-if="salesExecutiveOptions.length" v-model="form.executiveId" label="Ejecutivo comercial" placeholder="Seleccione ejecutivo" :options="salesExecutiveOptions" />\n              <DhInput v-else v-model="form.executiveName" label="Ejecutivo comercial" placeholder="Escriba el nombre del ejecutivo" autocomplete="off" />`,
    'seller executive field',
  )

  return code
}

function patchRates(source: string) {
  let code = source

  code = replaceOne(
    code,
    `import { PricingService } from '@/core/services/pricingService'`,
    `import { PricingService } from '@/core/services/pricingService'\nimport { callEndpoint } from '@/core/api/callEndpoint'\nimport { unwrapListResponse } from '@/core/api/apiResponse'`,
    'rates seller API imports',
  )

  code = replaceOne(
    code,
    `const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create))`,
    `const isSellerUser = computed(() => {\n  const sellerRole = authStore.roles.some((role) => {\n    const value = role.trim().toLowerCase()\n    return value === 'vendedor' || value === 'seller' || value === 'ventas' || value.includes('vendedor') || value.includes('seller')\n  })\n  return sellerRole || (authStore.hasScope('pricing.rate-request.create') && !authStore.hasScope(PRICING_SCOPES.rates.update))\n})\n\nconst canCreate = computed(() => !isSellerUser.value && authStore.hasScope(PRICING_SCOPES.rates.create))`,
    'seller rates role state',
  )

  const loadAnchor = `    const result = await PricingService.browseRates({\n      pageNumber: page.value,\n      pageSize: pageSize.value,\n      search: filters.search || undefined,\n      status: filters.status || undefined,\n      agentId: filters.agentId || undefined,\n      carrierId: filters.carrierId || undefined,\n      polId: filters.polId || undefined,\n      poeId: filters.poeId || undefined,\n      podId: filters.podId || undefined,\n      containerTypeId: filters.containerTypeId || undefined,\n      currencyId: filters.currencyId || undefined,\n      idtraNumber: filters.idtraNumber || undefined,\n      quoNumber: filters.quoNumber || undefined,\n      quoteDate: filters.quoteDate || undefined,\n      validFrom: filters.validFrom || undefined,\n      validTo: filters.validTo || undefined,\n    })\n    rows.value = result.items\n    total.value = result.totalCount ?? result.items.length\n    selectedIds.value = selectedIds.value.filter((id) => result.items.some((row) => row.id === id))`

  const loadReplacement = `    if (isSellerUser.value) {\n      const response = await callEndpoint<unknown>({\n        method: 'GET',\n        path: '/api/pricing/seller-rates',\n        headers: { Accept: 'application/json' },\n      })\n      let sellerRows = unwrapListResponse<RateDto>(response)\n      const searchValue = filters.search.trim().toLowerCase()\n      sellerRows = sellerRows.filter((rate) => {\n        if (filters.status && normalizeCommercialStatus(rate.status) !== filters.status) return false\n        if (filters.agentId && rate.agentId !== filters.agentId) return false\n        if (filters.carrierId && rate.carrierId !== filters.carrierId) return false\n        if (filters.polId && rate.polId !== filters.polId) return false\n        if (filters.poeId && rate.poeId !== filters.poeId) return false\n        if (filters.podId && rate.podId !== filters.podId) return false\n        if (filters.containerTypeId && rate.containerTypeId !== filters.containerTypeId) return false\n        if (filters.currencyId && rate.currencyId !== filters.currencyId) return false\n        if (filters.idtraNumber && !String(rate.idtraNumber || '').toLowerCase().includes(filters.idtraNumber.toLowerCase())) return false\n        if (filters.quoNumber && !String(rate.quoNumber || '').toLowerCase().includes(filters.quoNumber.toLowerCase())) return false\n        if (filters.validFrom && String(rate.validFrom).slice(0, 10) < filters.validFrom) return false\n        if (filters.validTo && String(rate.validTo).slice(0, 10) > filters.validTo) return false\n        if (!searchValue) return true\n        return [rate.rateCode, rate.quoNumber, rate.clientName, rate.executiveName, rate.carrierName, rate.polName, rate.poeName, rate.podName]\n          .some((value) => String(value || '').toLowerCase().includes(searchValue))\n      })\n      const start = (page.value - 1) * pageSize.value\n      const pageRows = sellerRows.slice(start, start + pageSize.value)\n      rows.value = pageRows\n      total.value = sellerRows.length\n      selectedIds.value = selectedIds.value.filter((id) => pageRows.some((row) => row.id === id))\n      return\n    }\n\n    const result = await PricingService.browseRates({\n      pageNumber: page.value,\n      pageSize: pageSize.value,\n      search: filters.search || undefined,\n      status: filters.status || undefined,\n      agentId: filters.agentId || undefined,\n      carrierId: filters.carrierId || undefined,\n      polId: filters.polId || undefined,\n      poeId: filters.poeId || undefined,\n      podId: filters.podId || undefined,\n      containerTypeId: filters.containerTypeId || undefined,\n      currencyId: filters.currencyId || undefined,\n      idtraNumber: filters.idtraNumber || undefined,\n      quoNumber: filters.quoNumber || undefined,\n      quoteDate: filters.quoteDate || undefined,\n      validFrom: filters.validFrom || undefined,\n      validTo: filters.validTo || undefined,\n    })\n    rows.value = result.items\n    total.value = result.totalCount ?? result.items.length\n    selectedIds.value = selectedIds.value.filter((id) => result.items.some((row) => row.id === id))`

  code = replaceOne(code, loadAnchor, loadReplacement, 'seller rates loading')

  code = replaceOne(
    code,
    `<PricingRateRequestsPanel />`,
    `<PricingRateRequestsPanel v-if="!isSellerUser" />`,
    'seller request panel visibility',
  )

  return code
}

export function pricingSellerOwnershipUi(): Plugin {
  return {
    name: 'dhole-pricing-seller-ownership-ui',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(RATES_PATH)) return { code: patchRates(source), map: null }
      return null
    },
  }
}
