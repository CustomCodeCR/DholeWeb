import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'

type Port = Partial<Pick<CatalogItemSelectDto, 'code' | 'slug' | 'label' | 'value' | 'metadataJson'>> | null | undefined

function normalized(value: string | null | undefined): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

function metadataCountryCode(port: Port): string {
  if (!port?.metadataJson) return ''
  try {
    const parsed: unknown = JSON.parse(port.metadataJson)
    if (typeof parsed !== 'object' || !parsed || !('countryCode' in parsed)) return ''
    const code = (parsed as { countryCode?: unknown }).countryCode
    return typeof code === 'string' ? normalized(code).trim() : ''
  } catch {
    return ''
  }
}

function belongsToCountry(port: Port, expected: 'PA' | 'CR'): boolean {
  if (!port) return false
  const country = metadataCountryCode(port)
  if (country) {
    return expected === 'PA'
      ? ['PA', 'PAN', 'PANAMA'].includes(country)
      : ['CR', 'CRI', 'COSTA RICA'].includes(country)
  }
  const description = normalized([port.value, port.label, port.slug, port.code].filter(Boolean).join(' '))
  const code = normalized(port.code).trim()
  if (expected === 'PA') {
    return /\bPANAMA\b/.test(description)
      || code === 'PA' || code.startsWith('PA-') || /^PA[A-Z0-9]{3,}$/.test(code)
  }
  return /\bCOSTA RICA\b/.test(description)
    || code === 'CR' || code.startsWith('CR-') || /^CR[A-Z0-9]{3,}$/.test(code)
}

/**
 * ALL IN is a PDF/commercial presentation mode, not an additional charge.
 * Determine it for each complete FCL route, never from the currently active
 * POE while persisting other MultiQUO alternatives.
 */
export function shouldUseFclPanamaCostaRicaAllIn(route: {
  modality: string | null | undefined
  shipmentMode: string | null | undefined
  poe: Port
  pod: Port
}): boolean {
  return ['MARITIME', 'MULTIMODAL'].includes(normalized(route.modality))
    && normalized(route.shipmentMode) === 'FCL'
    && belongsToCountry(route.poe, 'PA')
    && belongsToCountry(route.pod, 'CR')
}
