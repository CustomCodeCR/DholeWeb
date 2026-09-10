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
    `async function loadSalesExecutivesFromAuth(): Promise<CatalogItemSelectDto[]> {\n  try {\n    const sellers = await SellerVisibilityService.rateOptions()\n    return sellers\n      .map((seller) => {\n        const label = String(seller.displayName || seller.userName || seller.email || seller.userId).trim()\n        return {\n          id: seller.userId,\n          value: label,\n          label,\n          code: String(seller.userName || seller.email || seller.userId).trim(),\n          slug: seller.userId,\n          metadataJson: JSON.stringify({ source: 'AuthService', role: 'Vendedor' }),\n          isActive: true,\n        } satisfies CatalogItemSelectDto\n      })\n      .filter((seller) => seller.id && seller.label)\n  } catch (error) {\n    console.error('[Pricing] No se pudieron cargar los usuarios con rol Vendedor desde Auth.', error)\n    return []\n  }\n}\n\nfunction findSalesExecutiveByName(value?: string | null) {\n  const target = normalizeCatalogValue(String(value ?? ''))\n  if (!target) return null\n  return catalogs.salesExecutives.find((executive) => {\n    const label = normalizeCatalogValue(displayValue(executive) || executive.label)\n    const code = normalizeCatalogValue(executive.code || '')\n    return label === target\n      || code === target\n      || (label.length > 2 && target.startsWith(label + ' '))\n      || (code.length > 2 && target.includes(code))\n  }) ?? null\n}\n\nasync function loadCatalogs() {`,
    'Auth Vendedor loader',
  )

  code = replaceOne(
    code,
    `      selectOptional('pricing-sales-executives'),`,
    `      loadSalesExecutivesFromAuth(),`,
    'sales executive source',
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
    `<DhInput v-if="sellerRequestMode" :model-value="sellerExecutiveLabel" label="Ejecutivo comercial *" placeholder="Vendedor autenticado" disabled hint="Usuario Vendedor autenticado" />`,
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
    `const canNext = computed(() => {\n  if (step.value === 3) {\n    if (!form.clientName.trim()) return false\n    if (props.sellerRequestMode) {\n      if (!form.executiveName.trim()) return false\n    } else if (!form.executiveId || !form.executiveName.trim()) {\n      return false\n    }\n  }`,
    'canNext commercial validation',
  )

  code = replaceOne(
    code,
    `async function saveRate() {`,
    `async function saveRate() {\n  if (!form.clientName.trim()) {\n    step.value = 3\n    toastStore.error('El nombre del cliente es obligatorio para crear o guardar una tarifa.')\n    return\n  }\n  if (!form.executiveId || !form.executiveName.trim()) {\n    step.value = 3\n    toastStore.error('Seleccione un ejecutivo comercial de la lista de usuarios con rol Vendedor.')\n    return\n  }`,
    'save commercial validation',
  )

  const executiveNamePayload = `executiveName: form.executiveName.trim() || null,`
  const executivePayloadCount = code.split(executiveNamePayload).length - 1
  if (executivePayloadCount < 1) {
    throw new Error('[pricingCommercialIdentityFields] No rate payload contains executiveName.')
  }
  code = code.replaceAll(
    executiveNamePayload,
    `${executiveNamePayload}\n      executiveUserId: form.executiveId || null,`,
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
