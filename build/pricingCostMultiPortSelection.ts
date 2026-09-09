import type { Plugin } from 'vite'

const FORM_PATH = '/src/modules/pricing/components/PricingCostFormDrawer.vue'
const SERVICE_PATH = '/src/core/services/pricingService.ts'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingCostMultiPortSelection] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function replaceRegexOne(source: string, pattern: RegExp, replacement: string, label: string) {
  const matches = source.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))
  if ((matches?.length ?? 0) !== 1) {
    throw new Error(`[pricingCostMultiPortSelection] Expected one ${label}, found ${matches?.length ?? 0}.`)
  }
  return source.replace(pattern, replacement)
}

function patchPricingService(source: string) {
  const anchor = `  async createCost(payload: CreateCostRequest): Promise<string> {`
  const methods = `  async getCostRoutePorts(costId: string): Promise<{ polIds: string[]; poeIds: string[]; podIds: string[] }> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: \`/api/pricing/costs/\${costId}/route-ports\`,
    })
    const value = unwrapApiResponse<{ polIds?: string[]; poeIds?: string[]; podIds?: string[] }>(response as never)
    return {
      polIds: Array.isArray(value.polIds) ? value.polIds : [],
      poeIds: Array.isArray(value.poeIds) ? value.poeIds : [],
      podIds: Array.isArray(value.podIds) ? value.podIds : [],
    }
  },

  async replaceCostRoutePorts(
    costId: string,
    payload: { polIds: string[]; poeIds: string[]; podIds: string[] },
  ): Promise<void> {
    await callEndpoint<unknown, typeof payload>(
      { method: 'PUT', path: \`/api/pricing/costs/\${costId}/route-ports\` },
      { body: payload },
    )
  },

${anchor}`
  return replaceOne(source, anchor, methods, 'pricing service createCost anchor')
}

function patchCostForm(source: string) {
  let code = source

  const stateAnchor = `  portId: props.cost?.portId ?? '',
  polId: props.cost?.polId ?? (props.cost?.portRole === 'Pol' ? (props.cost?.portId ?? '') : ''),
  poeId: props.cost?.poeId ?? (props.cost?.portRole === 'Poe' ? (props.cost?.portId ?? '') : ''),
  podId: props.cost?.podId ?? (props.cost?.portRole === 'Pod' ? (props.cost?.portId ?? '') : ''),`
  const stateReplacement = `${stateAnchor}
  polIds: (props.cost?.polId ?? (props.cost?.portRole === 'Pol' ? props.cost?.portId : null))
    ? [String(props.cost?.polId ?? props.cost?.portId)]
    : [] as string[],
  poeIds: (props.cost?.poeId ?? (props.cost?.portRole === 'Poe' ? props.cost?.portId : null))
    ? [String(props.cost?.poeId ?? props.cost?.portId)]
    : [] as string[],
  podIds: (props.cost?.podId ?? (props.cost?.portRole === 'Pod' ? props.cost?.portId : null))
    ? [String(props.cost?.podId ?? props.cost?.portId)]
    : [] as string[],`
  code = replaceOne(code, stateAnchor, stateReplacement, 'route selection state')

  const validationAnchor = `  if (scopeIncludes('Pol') && !form.polId) return false
  if (scopeIncludes('Poe') && !form.poeId) return false
  if (scopeIncludes('Pod') && !form.podId) return false`
  const validationReplacement = `  if (scopeIncludes('Pol') && form.polIds.length === 0) return false
  if (scopeIncludes('Poe') && form.poeIds.length === 0) return false
  if (scopeIncludes('Pod') && form.podIds.length === 0) return false`
  code = replaceOne(code, validationAnchor, validationReplacement, 'route validation')

  const watchAnchor = `    if (scope !== 'Any') form.portId = ''
    if (!scope.includes('Pol')) form.polId = ''
    if (!scope.includes('Poe')) form.poeId = ''
    if (!scope.includes('Pod')) form.podId = ''`
  const watchReplacement = `    if (scope !== 'Any') form.portId = ''
    if (!scope.includes('Pol')) {
      form.polId = ''
      form.polIds = []
    }
    if (!scope.includes('Poe')) {
      form.poeId = ''
      form.poeIds = []
    }
    if (!scope.includes('Pod')) {
      form.podId = ''
      form.podIds = []
    }`
  code = replaceOne(code, watchAnchor, watchReplacement, 'route scope watcher')

  const selectedAnchor = `  const pol = selected(catalogs.polPorts.value, form.polId)
  const poe = selected(catalogs.poePorts.value, form.poeId)
  const pod = selected(catalogs.podPorts.value, form.podId)`
  const selectedReplacement = `  const pol = selected(catalogs.polPorts.value, form.polIds[0] ?? '')
  const poe = selected(catalogs.poePorts.value, form.poeIds[0] ?? '')
  const pod = selected(catalogs.podPorts.value, form.podIds[0] ?? '')`
  code = replaceOne(code, selectedAnchor, selectedReplacement, 'first route ports for legacy contract')

  const submitAnchor = `    if (props.cost) await PricingService.updateCost(props.cost.id, payload)
    else await PricingService.createCost(payload)`
  const submitReplacement = `    let savedCostId = props.cost?.id ?? ''
    if (props.cost) await PricingService.updateCost(props.cost.id, payload)
    else savedCostId = await PricingService.createCost(payload)

    await PricingService.replaceCostRoutePorts(savedCostId, {
      polIds: scopeIncludes('Pol') ? [...form.polIds] : [],
      poeIds: scopeIncludes('Poe') ? [...form.poeIds] : [],
      podIds: scopeIncludes('Pod') ? [...form.podIds] : [],
    })`
  code = replaceOne(code, submitAnchor, submitReplacement, 'cost submit')

  const mountedAnchor = `onMounted(catalogs.loadAll)`
  const mountedReplacement = `onMounted(async () => {
  await catalogs.loadAll()
  if (!props.cost?.id) return

  try {
    const routePorts = await PricingService.getCostRoutePorts(props.cost.id)
    form.polIds = routePorts.polIds.length ? [...routePorts.polIds] : (form.polId ? [form.polId] : [])
    form.poeIds = routePorts.poeIds.length ? [...routePorts.poeIds] : (form.poeId ? [form.poeId] : [])
    form.podIds = routePorts.podIds.length ? [...routePorts.podIds] : (form.podId ? [form.podId] : [])
  } catch {
    form.polIds = form.polId ? [form.polId] : []
    form.poeIds = form.poeId ? [form.poeId] : []
    form.podIds = form.podId ? [form.podId] : []
  }
})`
  code = replaceOne(code, mountedAnchor, mountedReplacement, 'cost form mounted hydration')

  code = replaceRegexOne(code, /<DhSelect\s+v-if="scopeIncludes\('Pol'\)"\s+v-model="form\.polId"[\s\S]*?\/>/, `<PricingMultiSelect
          v-if="scopeIncludes('Pol')"
          v-model="form.polIds"
          :options="catalogs.polOptions.value"
          label="POL · Puertos de origen"
          placeholder="Seleccione uno o varios POL"
          empty-text="No hay puertos POL disponibles."
        />`, 'POL selector')

  code = replaceRegexOne(code, /<DhSelect\s+v-if="scopeIncludes\('Poe'\)"\s+v-model="form\.poeId"[\s\S]*?\/>/, `<PricingMultiSelect
          v-if="scopeIncludes('Poe')"
          v-model="form.poeIds"
          :options="catalogs.poeOptions.value"
          label="POE · Puertos de entrada"
          placeholder="Seleccione uno o varios POE"
          empty-text="No hay puertos POE disponibles."
        />`, 'POE selector')

  code = replaceRegexOne(code, /<DhSelect\s+v-if="scopeIncludes\('Pod'\)"\s+v-model="form\.podId"[\s\S]*?\/>/, `<PricingMultiSelect
          v-if="scopeIncludes('Pod')"
          v-model="form.podIds"
          :options="catalogs.podOptions.value"
          label="POD · Puertos de destino"
          placeholder="Seleccione uno o varios POD"
          empty-text="No hay puertos POD disponibles."
        />`, 'POD selector')

  return code
}

export function pricingCostMultiPortSelection(): Plugin {
  return {
    name: 'dhole-pricing-cost-multi-port-selection',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (normalizedId.endsWith(FORM_PATH)) return { code: patchCostForm(source), map: null }
      if (normalizedId.endsWith(SERVICE_PATH)) return { code: patchPricingService(source), map: null }
      return null
    },
  }
}
