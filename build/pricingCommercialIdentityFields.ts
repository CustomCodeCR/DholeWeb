import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingCommercialIdentityFields] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function replacePattern(source: string, pattern: RegExp, replacement: string, label: string) {
  if (!pattern.test(source)) {
    throw new Error(`[pricingCommercialIdentityFields] Missing ${label}.`)
  }
  return source.replace(pattern, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `import { PricingService } from '@/core/services/pricingService'`,
    `import { PricingService } from '@/core/services/pricingService'\nimport { SellerVisibilityService } from '@/core/services/sellerVisibilityService'`,
    'seller directory import',
  )

  code = replaceOne(
    code,
    `async function loadCatalogs() {`,
    `const DEFAULT_SALES_EXECUTIVE_ID = '__castro_fallas__'\nconst DEFAULT_SALES_EXECUTIVE_NAME = 'Castro Fallas'\n\nfunction isDefaultSalesExecutive(executiveId?: string | null, executiveName?: string | null) {\n  return executiveId === DEFAULT_SALES_EXECUTIVE_ID\n    || normalizeCatalogValue(String(executiveName ?? '')) === normalizeCatalogValue(DEFAULT_SALES_EXECUTIVE_NAME)\n}\n\nfunction hasSalesExecutiveSelection(executiveId?: string | null, executiveName?: string | null) {\n  return Boolean(String(executiveName ?? '').trim())\n    && (Boolean(executiveId) || isDefaultSalesExecutive(executiveId, executiveName))\n}\n\nfunction defaultSalesExecutive(): CatalogItemSelectDto {\n  return {\n    id: DEFAULT_SALES_EXECUTIVE_ID,\n    value: DEFAULT_SALES_EXECUTIVE_NAME,\n    label: DEFAULT_SALES_EXECUTIVE_NAME,\n    code: 'CASTRO_FALLAS',\n    slug: 'castro-fallas',\n    metadataJson: JSON.stringify({ source: 'DholeWeb', role: 'Vendedor', isDefault: true }),\n    isActive: true,\n  } satisfies CatalogItemSelectDto\n}\n\nasync function loadSalesExecutivesFromAuth(): Promise<CatalogItemSelectDto[]> {\n  try {\n    const sellers = await SellerVisibilityService.rateOptions()\n    const authSellers = sellers\n      .map((seller) => {\n        const label = String(seller.displayName || seller.userName || seller.email || seller.userId).trim()\n        return {\n          id: seller.userId,\n          value: label,\n          label,\n          code: String(seller.userName || seller.email || seller.userId).trim(),\n          slug: seller.userId,\n          metadataJson: JSON.stringify({ source: 'AuthService', role: 'Vendedor' }),\n          isActive: true,\n        } satisfies CatalogItemSelectDto\n      })\n      .filter((seller) => seller.id && seller.label)\n      .filter((seller) => normalizeCatalogValue(displayValue(seller) || seller.label) !== normalizeCatalogValue(DEFAULT_SALES_EXECUTIVE_NAME))\n\n    return [defaultSalesExecutive(), ...authSellers]\n  } catch (error) {\n    console.error('[Pricing] No se pudieron cargar los usuarios con rol Vendedor desde Auth.', error)\n    return [defaultSalesExecutive()]\n  }\n}\n\nfunction findSalesExecutiveByName(value?: string | null) {\n  const target = normalizeCatalogValue(String(value ?? ''))\n  if (!target) return null\n  return catalogs.salesExecutives.find((executive) => {\n    const label = normalizeCatalogValue(displayValue(executive) || executive.label)\n    const code = normalizeCatalogValue(executive.code || '')\n    return label === target\n      || code === target\n      || (label.length > 2 && target.startsWith(label + ' '))\n      || (code.length > 2 && target.includes(code))\n  }) ?? null\n}\n\nasync function loadCatalogs() {`,
    'Auth Vendedor loader',
  )

  code = replaceOne(
    code,
    `      selectOptional('pricing-sales-executives'),`,
    `      loadSalesExecutivesFromAuth(),`,
    'sales executive source',
  )

  code = replaceOne(
    code,
    `  executiveId: '',\n  executiveName: '',`,
    `  executiveId: '__castro_fallas__',\n  executiveName: 'Castro Fallas',`,
    'default Castro Fallas executive',
  )

  code = replacePattern(
    code,
    /<DhSelect\s+v-if="clientOptions\.length"[\s\S]*?:options="clientOptions"\s*\/>/,
    `<DhSelect v-if="clientOptions.length" v-model="form.clientId" label="Nombre del cliente *" placeholder="Seleccione cliente" :options="clientOptions" hint="Obligatorio" />`,
    'required client select',
  )

  code = replacePattern(
    code,
    /<DhInput\s+v-else\s+v-model="form\.clientName"[\s\S]*?\/>/,
    `<DhInput v-else v-model="form.clientName" label="Nombre del cliente *" placeholder="Escriba el nombre del cliente" autocomplete="off" hint="Obligatorio" />`,
    'required client input',
  )

  code = replacePattern(
    code,
    /<DhInput\s+v-if="sellerRequestMode"[\s\S]*?disabled\s*\/>/,
    `<DhSelect\n                v-if="sellerRequestMode"\n                v-model="sellerRequestOwnerId"\n                label="Ejecutivo comercial *"\n                :placeholder="sellerRequestOwnerOptions.length ? 'Seleccione vendedor' : 'No hay vendedores disponibles'"\n                :options="sellerRequestOwnerOptions"\n                :disabled="sellerRequestOwnersLoading || !sellerRequestOwnerOptions.length"\n                hint="Usuarios disponibles con rol Vendedor"\n              />`,
    'seller request executive field',
  )

  code = replacePattern(
    code,
    /<DhSelect\s+v-else-if="salesExecutiveOptions\.length"[\s\S]*?:options="salesExecutiveOptions"\s*\/>\s*<DhInput\s+v-else\s+v-model="form\.executiveName"[\s\S]*?\/>/,
    `<DhSelect\n                v-else\n                v-model="form.executiveId"\n                label="Ejecutivo comercial *"\n                :placeholder="salesExecutiveOptions.length ? 'Seleccione vendedor' : 'No hay usuarios con rol Vendedor'"\n                :options="salesExecutiveOptions"\n                :disabled="!salesExecutiveOptions.length"\n                hint="Usuarios activos con rol Vendedor"\n              />`,
    'Vendedor select',
  )

  const legacyHelp = `Clientes y ejecutivos usan catálogos temporales de Config para evitar duplicar el futuro módulo Comercial.`
  if (code.includes(legacyHelp)) {
    code = code.replace(
      legacyHelp,
      `El nombre del cliente es obligatorio. El ejecutivo comercial se selecciona de los usuarios activos con rol Vendedor registrados en Seguridad.`,
    )
  }

  code = replaceOne(
    code,
    `const canNext = computed(() => {`,
    `function selectedSellerRequestExecutiveName() {\n  const selected = sellerRequestOwnerOptions.value.find((option) => option.value === sellerRequestOwnerId.value)\n  return String(selected?.label || '').trim()\n}\n\nwatch(\n  () => [props.sellerRequestMode, sellerRequestOwnerId.value, sellerRequestOwnerOptions.value] as const,\n  ([sellerMode, sellerId]) => {\n    if (!sellerMode) return\n    form.executiveId = sellerId || ''\n    form.executiveName = selectedSellerRequestExecutiveName()\n  },\n  { immediate: true },\n)\n\nconst canNext = computed(() => {\n  if (step.value === 3) {\n    if (!form.clientName.trim()) return false\n    if (props.sellerRequestMode) {\n      if (!sellerRequestOwnerId.value || !form.executiveName.trim()) return false\n    } else if (!hasSalesExecutiveSelection(form.executiveId, form.executiveName)) {\n      return false\n    }\n  }`,
    'canNext commercial validation',
  )

  code = replaceOne(
    code,
    `async function saveRate() {`,
    `async function verifyCreatedRatePersistence(rateId: string, payload: CreateRateRequest) {\n  const persisted = await PricingService.getRate(rateId)\n  const persistedDetails = persisted.rateDetails ?? []\n  const persistedCostIds = new Set(\n    persistedDetails\n      .map((detail) => detail.costId)\n      .filter((costId): costId is string => Boolean(costId)),\n  )\n\n  const missingLinkedDetails = payload.details.filter(\n    (detail) => detail.costId && !persistedCostIds.has(detail.costId),\n  )\n  const hasSubmittedFreight = payload.details.some(\n    (detail) => !detail.costId && detail.costDetailType === 'Freight',\n  )\n  const hasPersistedFreight = persistedDetails.some(\n    (detail) => detail.costDetailType === 'Freight',\n  )\n\n  if (missingLinkedDetails.length || (hasSubmittedFreight && !hasPersistedFreight)) {\n    const missingNames = missingLinkedDetails.map((detail) => detail.name).filter(Boolean)\n    if (hasSubmittedFreight && !hasPersistedFreight) missingNames.unshift('Flete internacional')\n    throw new Error(\n      'Pricing devolvió una tarifa incompleta. No se guardaron: ' + missingNames.join(', '),\n    )\n  }\n\n  if (payload.incotermId && persisted.incotermId && payload.incotermId !== persisted.incotermId) {\n    throw new Error(\n      'Pricing guardó un Incoterm distinto al seleccionado. Recargue los catálogos e intente nuevamente.',\n    )\n  }\n}\n\nasync function saveRate() {\n  if (!form.clientName.trim()) {\n    step.value = 3\n    toastStore.error('El nombre del cliente es obligatorio para crear o guardar una tarifa.')\n    return\n  }\n  if (!hasSalesExecutiveSelection(form.executiveId, form.executiveName)) {\n    step.value = 3\n    toastStore.error('Seleccione un ejecutivo comercial de la lista de usuarios con rol Vendedor.')\n    return\n  }`,
    'save commercial validation',
  )

  code = replaceOne(
    code,
    `  if (props.sellerRequestMode && sellerExecutiveLabel.value) {\n    form.executiveId = ''\n    form.executiveName = sellerExecutiveLabel.value\n  }\n\n  if (props.sellerRequestMode) {`,
    `  if (props.sellerRequestMode) {\n    if (!sellerRequestOwnerId.value) {\n      step.value = 3\n      toastStore.error('Seleccione el ejecutivo comercial de la solicitud.')\n      return\n    }\n    form.executiveId = sellerRequestOwnerId.value\n    form.executiveName = selectedSellerRequestExecutiveName()`,
    'seller request executive save enforcement',
  )

  const executiveNamePayload = `executiveName: form.executiveName.trim() || null,`
  const executivePayloadCount = code.split(executiveNamePayload).length - 1
  if (executivePayloadCount < 1) {
    throw new Error('[pricingCommercialIdentityFields] No rate payload contains executiveName.')
  }
  code = code.replaceAll(
    executiveNamePayload,
    `${executiveNamePayload}\n      executiveUserId: isDefaultSalesExecutive(form.executiveId, form.executiveName) ? null : (form.executiveId || null),`,
  )

  code = replaceOne(
    code,
    `      rateId = await PricingService.createRate(createPayload)\n      toastStore.success('Tarifa creada correctamente.')`,
    `      rateId = await PricingService.createRate(createPayload)\n      await verifyCreatedRatePersistence(rateId, createPayload)\n      toastStore.success('Tarifa creada correctamente.')`,
    'created rate persistence verification',
  )

  code = replaceOne(
    code,
    `    form.executiveName = rate.executiveName ?? ''`,
    `    form.executiveName = rate.executiveName ?? ''\n    const existingExecutive = findSalesExecutiveByName(rate.executiveName)\n    form.executiveId = existingExecutive?.id ?? ''\n    if (existingExecutive) form.executiveName = displayValue(existingExecutive) || existingExecutive.label`,
    'existing rate executive hydration',
  )

  const requestExecutiveAnchor = `  form.executiveName = request.executiveName ?? form.executiveName`
  if (code.includes(requestExecutiveAnchor)) {
    code = code.replace(
      requestExecutiveAnchor,
      `${requestExecutiveAnchor}\n  const requestedExecutive = findSalesExecutiveByName(form.executiveName)\n  if (requestedExecutive) {\n    form.executiveId = requestedExecutive.id\n    form.executiveName = displayValue(requestedExecutive) || requestedExecutive.label\n  }`,
    )
  }

  return code
}

export function pricingCommercialIdentityFields(): Plugin {
  return {
    name: 'dhole-pricing-commercial-identity-fields',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
