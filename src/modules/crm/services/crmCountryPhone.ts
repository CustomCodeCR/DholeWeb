import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { dialCodeForCountry, publicDialCodeForCountry } from '../utils/crmPhone'

/**
 * Resolve a Config country ID through the same select catalog used by the CRM
 * country picker. Some deployments return generic internal codes (PAI-...)
 * or incomplete item-detail records: the select label is the reliable name.
 * The bundled ISO table works offline; the public source is a last resort.
 */
export async function resolveCrmCountryPrefix(countryId: string): Promise<string | null> {
  const id = countryId.trim()
  if (!id) return null
  const direct = dialCodeForCountry({
    code: id, slug: id, name: id, value: id, metadataJson: null,
  })
  if (direct) return direct

  const rows = await CatalogItemsService.select({ catalogGroupSlug: 'countries' }).catch(() => [])
  const selected = rows.find(row => row.id.toLowerCase() === id.toLowerCase())
  const selectedCountry = selected ? {
    code: selected.code, slug: selected.slug, name: selected.label,
    value: selected.value, metadataJson: selected.metadataJson,
  } : null
  if (selectedCountry) {
    const prefix = dialCodeForCountry(selectedCountry)
    if (prefix) return prefix
  }

  const detail = await CatalogItemsService.getById(id).catch(() => null)
  if (detail) {
    const prefix = dialCodeForCountry(detail)
    if (prefix) return prefix
  }
  return selectedCountry
    ? publicDialCodeForCountry(selectedCountry)
    : detail ? publicDialCodeForCountry(detail) : null
}
