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
  return source
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
