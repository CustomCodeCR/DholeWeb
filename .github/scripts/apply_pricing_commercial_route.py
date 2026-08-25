from pathlib import Path

helper = Path('src/modules/pricing/services/pricingCommercialRules.ts')
source = helper.read_text(encoding='utf-8')

old_query = """  incotermId: string
  serviceCodes: string[]
}): Promise<CommercialTerms> {
"""
new_query = """  incotermId: string
  serviceCodes: string[]
  routeText?: string
}): Promise<CommercialTerms> {
"""
if old_query in source:
    source = source.replace(old_query, new_query, 1)
elif new_query not in source:
    raise SystemExit('Commercial query shape marker not found')

old_params = """  if (query.serviceCodes.length) params.set('serviceCodes', query.serviceCodes.join(','))

  return callEndpoint<CommercialTerms>({
"""
new_params = """  if (query.serviceCodes.length) params.set('serviceCodes', query.serviceCodes.join(','))
  if (query.routeText?.trim()) params.set('routeText', query.routeText.trim())

  return callEndpoint<CommercialTerms>({
"""
if old_params in source:
    source = source.replace(old_params, new_params, 1)
elif new_params not in source:
    raise SystemExit('Commercial route parameter marker not found')

helper.write_text(source, encoding='utf-8')

wizard = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
source = wizard.read_text(encoding='utf-8')

old_services = """  const serviceCodes = new Set(
    selectedServices.value
      .map((service) => service.code?.trim().toUpperCase())
      .filter((code): code is string => Boolean(code)),
  )
  if (!incotermBuyerPaysMainTransport(incoterm!.code)) serviceCodes.delete('INT_TRANSPORT')
  if (includedLines.value.some((line) => line.costDetailType === 'Insurance')) serviceCodes.add('CARGO_INSURANCE')
  if (form.dangerousCargo) serviceCodes.add('DANGEROUS_CARGO')
"""
new_services = """  const includedNameKeys = new Set(
    includedLines.value.map((line) => normalizeCatalogValue(line.name)),
  )
  const serviceCodes = new Set<string>()
  selectedServices.value.forEach((service) => {
    const code = service.code?.trim().toUpperCase()
    if (!code) return
    const canonical = canonicalServiceLine(code, displayValue(service))
    if (
      Boolean(metadata(service)?.optional) &&
      !includedNameKeys.has(normalizeCatalogValue(canonical.name))
    ) return
    serviceCodes.add(code)
  })
  if (!incotermBuyerPaysMainTransport(incoterm!.code)) serviceCodes.delete('INT_TRANSPORT')
  if (includedLines.value.some((line) => line.costDetailType === 'Insurance'))
    serviceCodes.add('CARGO_INSURANCE')
  else
    serviceCodes.delete('CARGO_INSURANCE')
  if (form.dangerousCargo) serviceCodes.add('DANGEROUS_CARGO')
"""
if old_services in source:
    source = source.replace(old_services, new_services, 1)
elif new_services not in source:
    raise SystemExit('Service activation marker not found')

old_resolve = """      incotermId: incoterm!.id,
      serviceCodes: [...serviceCodes],
    })
"""
new_resolve = """      incotermId: incoterm!.id,
      serviceCodes: [...serviceCodes],
      routeText: [displayValue(origin), displayValue(poe), displayValue(pod)]
        .filter(Boolean)
        .join(' '),
    })
"""
if old_resolve in source:
    source = source.replace(old_resolve, new_resolve, 1)
elif new_resolve not in source:
    raise SystemExit('Route resolver call marker not found')

wizard.write_text(source, encoding='utf-8')
