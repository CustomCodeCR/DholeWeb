import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { isGlobalCountryAgent } from './globalAgentCountries'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\b(puerto|port|de|del|of|the)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
function countryTokens(item: CatalogItemSelectDto | null | undefined, includeLabelFallback = true) {
  const tokens = new Set<string>()
  if (!item) return tokens
  let meta: Record<string, unknown> = {}
  try { meta = JSON.parse(item.metadataJson || '{}') || {} } catch { /* legacy label */ }
  const add = (raw: unknown) => {
    if (Array.isArray(raw)) { raw.forEach(add); return }
    if (raw == null || typeof raw === 'object') return
    const value = normalize(String(raw))
    if (value.length >= 2) tokens.add(value)
  }
  for (const key of ['countryCode','country','countryName','countryIso2','countryIso3','originCountryCode','originCountry','iso2','iso3','countries','countryCodes']) add(meta[key])
  if (includeLabelFallback) for (const raw of [item.value,item.label]) {
    const text = String(raw ?? '').trim()
    if (text.includes(',')) add(text.split(',').at(-1))
  }
  return tokens
}
// Same country and alias matching as the Pricing wizard, including global agents.
export function agentMatchesOrigin(agent: CatalogItemSelectDto, origin: CatalogItemSelectDto | null | undefined, ports: CatalogItemSelectDto[], allowUnassigned = true) {
  if (isGlobalCountryAgent(agent)) return true
  if (!origin) return false
  const countries = countryTokens(agent, false)
  if (!countries.size) return allowUnassigned
  const originCountries = countryTokens(origin)
  const text = normalize([origin.value,origin.label,origin.slug,origin.code].filter(Boolean).join(' '))
  return [...countries].some(country => originCountries.has(country) ||
    (' ' + text + ' ').includes(' ' + country + ' ') ||
    ports.some(port => {
      const aliases = countryTokens(port)
      return aliases.has(country) && [...originCountries].some(token => aliases.has(token))
    }))
}
