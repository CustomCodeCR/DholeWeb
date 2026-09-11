import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingWizardMixedCarrierExpiry] Missing ${label} anchor.`)
  }
  return source.replace(anchor, replacement)
}

function replaceBetween(source: string, start: string, end: string, replacement: string, label: string) {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) throw new Error(`[pricingWizardMixedCarrierExpiry] Missing ${label} start anchor.`)
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (endIndex < 0) throw new Error(`[pricingWizardMixedCarrierExpiry] Missing ${label} end anchor.`)
  return source.slice(0, startIndex) + replacement + source.slice(endIndex)
}

function patchWizard(source: string) {
  let code = source

  code = replaceBetween(
    code,
    `function fclRateBundleGroupKey(rate: ImportRateSelectDto) {`,
    `function compareFclCandidateRates(left: ImportRateSelectDto, right: ImportRateSelectDto) {`,
    `function fclRateBundleGroupKey(rate: ImportRateSelectDto) {
  const agent = String(rate.agentId || normalizeCatalogValue(String(rate.agent ?? ''))).trim()
  const currency = String(rate.currencyId || normalizeCatalogValue(String(rate.currency ?? 'USD'))).trim()
  return [agent, currency].join('|')
}

`,
    'FCL bundle grouping',
  )

  code = replaceBetween(
    code,
    `const fclRateBundles = computed<FclRateBundle[]>(() => {`,
    `const fclCarrierFilterOptions = computed(() => {`,
    `function fclDaysUntilExpiry(validTo: string) {
  if (!validTo) return 0
  const end = new Date(\`${'${String(validTo).slice(0, 10)}'}T12:00:00\`)
  const today = new Date(\`${'${todayIso()}'}T12:00:00\`)
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000))
}

function fclExpiryLabel(validTo: string) {
  const days = fclDaysUntilExpiry(validTo)
  if (days === 0) return 'Vence hoy'
  return \`Vence en ${'${days}'} día${'${days === 1 ? \'\' : \'s\'}'}\`
}

function compareFclCombinations(left: ImportRateSelectDto[], right: ImportRateSelectDto[]) {
  const leftExpiry = Math.min(...left.map((rate) => new Date(rate.validTo).getTime()))
  const rightExpiry = Math.min(...right.map((rate) => new Date(rate.validTo).getTime()))
  if (leftExpiry !== rightExpiry) return rightExpiry - leftExpiry
  return left.reduce((sum, rate) => sum + number(rate.freight), 0)
    - right.reduce((sum, rate) => sum + number(rate.freight), 0)
}

const fclRateBundles = computed<FclRateBundle[]>(() => {
  const requirements = fclRateRequirements.value
  if (!requirements.length || requirements.some((requirement) => !requirement.rates.length)) return []

  const groupSets = requirements.map(
    (requirement) => new Set(requirement.rates.map(fclRateBundleGroupKey)),
  )
  const commonGroups = [...groupSets[0]].filter((group) =>
    groupSets.every((candidateSet) => candidateSet.has(group)),
  )

  const bundles = commonGroups.flatMap((groupKey) => {
    const candidateGroups = requirements.map((requirement) =>
      [...requirement.rates]
        .filter((candidate) => fclRateBundleGroupKey(candidate) === groupKey)
        .sort(compareFclCandidateRates)
        .slice(0, 8),
    )

    let combinations: ImportRateSelectDto[][] = [[]]
    candidateGroups.forEach((candidates) => {
      combinations = combinations
        .flatMap((prefix) => candidates.map((candidate) => [...prefix, candidate]))
        .sort(compareFclCombinations)
        .slice(0, 80)
    })

    return combinations.map((rates, combinationIndex) => {
      const lines = requirements.map((requirement, index) => {
        const rate = rates[index]
        const unitCost = number(rate.freight)
        const unitSale = number(rate.totalSale ?? rate.freight)
        return {
          containerTypeId: requirement.containerTypeId,
          containerTypeName: requirement.containerTypeName,
          containerTypeCode: requirement.containerTypeCode,
          quantity: requirement.quantity,
          rate,
          unitCost,
          unitSale,
          totalCost: unitCost * requirement.quantity,
          totalSale: unitSale * requirement.quantity,
        } satisfies FclRateBundleLine
      })

      const first = lines[0].rate
      const carrierEntries = new Map<string, string>()
      lines.forEach((line) => {
        const key = fclRateCarrierFilterKey(line.rate)
        const label = String(line.rate.carrier ?? 'Naviera').trim() || 'Naviera'
        if (key && !carrierEntries.has(key)) carrierEntries.set(key, label)
      })
      const validFrom = lines
        .map((line) => String(line.rate.validFrom || ''))
        .filter(Boolean)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || ''
      const validTo = lines
        .map((line) => String(line.rate.validTo || ''))
        .filter(Boolean)
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] || ''
      const freeDays = Math.min(...lines.map((line) => Math.max(0, number(line.rate.freeDays))))
      const transitDays = Math.max(...lines.map((line) => Math.max(0, number(line.rate.transitDays))))
      const carriers = [...carrierEntries.values()]

      return {
        key: \`${'${groupKey}'}:${'${combinationIndex}'}:${'${lines.map((line) => line.rate.id).join(\':\')}'}\`,
        carrierFilterKey: [...carrierEntries.keys()].join('|'),
        carrierId: String(first.carrierId ?? ''),
        carrier: carriers.join(' + ') || String(first.carrier ?? 'Naviera'),
        agentId: String(first.agentId ?? ''),
        agent: String(first.agent ?? ''),
        currencyId: String(first.currencyId ?? ''),
        currency: String(first.currency ?? first.currencyCode ?? 'USD'),
        lines,
        totalCost: lines.reduce((sum, line) => sum + line.totalCost, 0),
        totalSale: lines.reduce((sum, line) => sum + line.totalSale, 0),
        validFrom,
        validTo,
        freeDays,
        transitDays,
        sourceCount: new Set(lines.map((line) => line.rate.importBatchId)).size,
        preAuthorized: lines.some((line) => line.rate.status === 'PreAuthorized'),
      } satisfies FclRateBundle
    })
  })

  const unique = new Map<string, FclRateBundle>()
  bundles.forEach((bundle) => {
    const key = bundle.lines.map((line) => line.rate.id).join('|')
    if (!unique.has(key)) unique.set(key, bundle)
  })

  return [...unique.values()]
    .sort((left, right) => {
      const validity = new Date(right.validTo).getTime() - new Date(left.validTo).getTime()
      if (validity !== 0) return validity
      return left.totalCost - right.totalCost
    })
    .slice(0, 80)
})

`,
    'mixed-carrier FCL bundles',
  )

  code = replaceBetween(
    code,
    `const fclCarrierFilterOptions = computed(() => {`,
    `function chooseFclRateBundle(bundle: FclRateBundle) {`,
    `const fclCarrierFilterOptions = computed(() => {
  const carriers = new Map<string, string>()
  fclRateBundles.value.forEach((bundle) => {
    bundle.lines.forEach((line) => {
      const value = fclRateCarrierFilterKey(line.rate)
      const label = String(line.rate.carrier ?? '').trim()
      if (value && label && !carriers.has(value)) carriers.set(value, label)
    })
  })
  return [
    { value: '', label: 'Todas las navieras' },
    ...[...carriers.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], 'es'))
      .map(([value, label]) => ({ value, label })),
  ]
})

const visibleFclRateBundles = computed(() =>
  fclRateBundles.value.filter(
    (bundle) => !rateCarrierFilter.value
      || bundle.lines.some((line) => fclRateCarrierFilterKey(line.rate) === rateCarrierFilter.value),
  ),
)

`,
    'mixed-carrier filter',
  )

  code = replaceRequired(
    code,
    `Si hay varios contenedores del mismo tipo, se usa una tarifa unitaria y se multiplica por la cantidad. Si hay tipos diferentes, Dhole exige una tarifa compatible para cada tipo dentro de la misma naviera, agente y moneda.`,
    `Si hay varios contenedores del mismo tipo, se usa una tarifa unitaria y se multiplica por la cantidad. Si hay tipos diferentes, cada tipo puede usar una naviera distinta; Dhole mantiene agente y moneda compatibles para construir una sola cotización.`,
    'FCL combination explanation',
  )

  code = replaceRequired(
    code,
    `No hay una combinación completa para la naviera seleccionada`,
    `No hay una combinación completa que incluya la naviera seleccionada`,
    'carrier-filter empty state',
  )

  code = replaceRequired(
    code,
    `Dhole consultó cada tipo de contenedor por separado, pero no encontró una misma combinación de naviera, agente y moneda para toda la solicitud.`,
    `Dhole consultó cada tipo de contenedor por separado, pero no encontró tarifas compatibles por agente y moneda para cubrir toda la solicitud. Las navieras sí pueden ser diferentes.`,
    'no-combination explanation',
  )

  code = replaceRequired(
    code,
    `<strong class="block text-sm">{{ line.quantity }} × {{ line.containerTypeName }}</strong>\n                        <span class="mt-0.5 block text-[11px] font-semibold text-[var(--dh-text-muted)]">\n                          Unitario: {{ formatMoney(line.unitCost, bundle.currency) }} / contenedor\n                        </span>`,
    `<strong class="block text-sm">{{ line.quantity }} × {{ line.containerTypeName }}</strong>\n                        <span class="mt-0.5 block text-[11px] font-black text-[var(--dh-text-muted)]">{{ line.rate.carrier || 'Naviera' }}</span>\n                        <span class="mt-0.5 block text-[11px] font-semibold text-[var(--dh-text-muted)]">POE tarifa: {{ line.rate.poe || '—' }}</span>\n                        <div class="mt-2 rounded-lg border border-[var(--dh-border)] bg-black/[0.025] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--dh-text-soft)] dark:bg-white/[0.04]">\n                          <strong class="block font-black">Condiciones / observaciones</strong>\n                          <span class="mt-0.5 block whitespace-pre-line font-semibold">{{ line.rate.spaceComment || 'Sin observaciones registradas' }}</span>\n                        </div>\n                        <span class="mt-1 block text-[11px] font-semibold text-[var(--dh-text-muted)]">\n                          Unitario: {{ formatMoney(line.unitCost, bundle.currency) }} / contenedor\n                        </span>`,
    'carrier, POE and observations per FCL line',
  )

  code = replaceRequired(
    code,
    `<span class="text-[10px] font-bold text-[var(--dh-text-muted)]">{{ formatDate(line.rate.validFrom) }} – {{ formatDate(line.rate.validTo) }}</span>`,
    `<span class="text-[10px] font-bold text-[var(--dh-text-muted)]">{{ formatDate(line.rate.validFrom) }} – {{ formatDate(line.rate.validTo) }} · <strong>{{ fclExpiryLabel(line.rate.validTo) }}</strong></span>`,
    'FCL line expiry counter',
  )

  code = replaceRequired(
    code,
    `<span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Vigencia común</span>\n                    <strong class="mt-1 block text-sm">{{ formatDate(bundle.validFrom) }} – {{ formatDate(bundle.validTo) }}</strong>`,
    `<span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Vencimiento más próximo</span>\n                    <strong class="mt-1 block text-sm">{{ formatDate(bundle.validTo) }} · {{ fclExpiryLabel(bundle.validTo) }}</strong>`,
    'bundle expiry counter',
  )

  return code
}

export function pricingWizardMixedCarrierExpiry(): Plugin {
  return {
    name: 'dhole-pricing-wizard-mixed-carrier-expiry',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
