from pathlib import Path
import re

wizard = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = wizard.read_text(encoding='utf-8')
original = text

old_interface = '''interface NearestPortRecommendation {
  portId: string
  name: string
  reason: string
  distanceKm: number | null
}'''
new_interface = '''interface NearestPortRecommendation {
  key: string
  name: string
  code: string | null
  reason: string
  distanceKm: number | null
  latitude: number | null
  longitude: number | null
  polId: string | null
}'''
if old_interface not in text:
    raise SystemExit('No se encontró NearestPortRecommendation actual.')
text = text.replace(old_interface, new_interface, 1)

pattern = re.compile(
    r"function parseNearestPortResponse\(content: string\) \{[\s\S]*?\n\}\n\nfunction deterministicNearestPorts\(\) \{[\s\S]*?\n\}\n\nasync function recommendNearestPorts\(\) \{[\s\S]*?\n\}\n\nasync function geocodePickupAddress",
    re.MULTILINE,
)
replacement = r'''function parseNearestPortResponse(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  if (!cleaned) return []
  const parsed = JSON.parse(cleaned) as {
    recommendations?: Array<{
      name?: string
      code?: string | null
      latitude?: number
      longitude?: number
      distanceKm?: number
      reason?: string
    }>
  }
  return Array.isArray(parsed.recommendations) ? parsed.recommendations : []
}

function normalizePortMatch(value: string) {
  return normalizeCatalogValue(value)
    .replace(/\b(port of|port|puerto de|puerto|harbour|harbor|terminal)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchConfiguredPol(name: string, code: string | null) {
  const normalizedCode = normalizeCatalogValue(code ?? '')
  if (normalizedCode) {
    const byCode = catalogs.pol.find((port) => normalizeCatalogValue(port.code) === normalizedCode)
    if (byCode) return byCode.id
  }

  const target = normalizePortMatch(name)
  if (!target) return null
  const exact = catalogs.pol.find((port) => normalizePortMatch(displayValue(port) || port.label || port.code) === target)
  if (exact) return exact.id

  const fuzzy = catalogs.pol.find((port) => {
    const candidate = normalizePortMatch(displayValue(port) || port.label || port.code)
    return candidate.length >= 4 && (candidate.includes(target) || target.includes(candidate))
  })
  return fuzzy?.id ?? null
}

async function recommendNearestPorts() {
  if (selectedIncotermCode.value !== 'EXW' || !form.pickupAddress.trim()) return
  if (!pickupCoordinates.value) {
    await geocodePickupAddress(false)
    if (!pickupCoordinates.value) return
  }

  try {
    recommendingPorts.value = true
    nearestPortRecommendations.value = []

    const response = await callEndpoint<unknown, Record<string, unknown>>(
      { method: 'POST', path: '/api/ai/logistics/nearest-ports', headers: { Accept: 'application/json' } },
      {
        body: {
          pickupAddress: form.pickupAddress.trim(),
          latitude: form.pickupLatitude,
          longitude: form.pickupLongitude,
          maxDistanceKm: 500,
        },
      },
    )

    const result = unwrapApiResponse<{ content?: string }>(response as never)
    const rawContent = String(result?.content ?? (response as { content?: unknown })?.content ?? '')
    const recommendations = parseNearestPortResponse(rawContent)
    const seen = new Set<string>()

    nearestPortRecommendations.value = recommendations
      .flatMap((item) => {
        const name = String(item.name ?? '').trim()
        if (!name) return []
        const distance = Number(item.distanceKm)
        if (!Number.isFinite(distance) || distance < 0 || distance > 500) return []
        const latitude = Number(item.latitude)
        const longitude = Number(item.longitude)
        const code = String(item.code ?? '').trim() || null
        const key = `${normalizeCatalogValue(name)}|${Number.isFinite(latitude) ? latitude.toFixed(4) : ''}|${Number.isFinite(longitude) ? longitude.toFixed(4) : ''}`
        if (seen.has(key)) return []
        seen.add(key)

        return [{
          key,
          name,
          code,
          reason: String(item.reason ?? 'Puerto recomendado por cercanía y viabilidad logística desde la recolección.'),
          distanceKm: Math.round(distance * 10) / 10,
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          polId: matchConfiguredPol(name, code),
        } satisfies NearestPortRecommendation]
      })
      .sort((left, right) => number(left.distanceKm ?? 999999) - number(right.distanceKm ?? 999999))
      .slice(0, 5)

    if (!nearestPortRecommendations.value.length) {
      toastStore.warning(
        'Sin puertos marítimos encontrados',
        'La búsqueda geográfica no encontró un puerto marítimo verificable dentro de 500 km del punto marcado.',
      )
    }
  } catch {
    toastStore.warning(
      'Búsqueda de puertos no disponible',
      'No fue posible consultar los puertos cercanos en este momento. Inténtelo nuevamente.',
    )
  } finally {
    recommendingPorts.value = false
  }
}

async function geocodePickupAddress'''
text, count = pattern.subn(lambda _: replacement, text, count=1)
if count != 1:
    raise SystemExit(f'No se reemplazó el bloque de búsqueda de puertos: {count}')

old_select = '''function selectRecommendedPort(portId: string) {
  const port = catalogs.pol.find((candidate) => candidate.id === portId)
  if (!port) return
  form.originId = portId
  toastStore.success(`POL actualizado a ${displayValue(port) || port.label || port.code}.`)
}'''
new_select = '''function selectRecommendedPort(polId: string) {
  const port = catalogs.pol.find((candidate) => candidate.id === polId)
  if (!port) return
  form.originId = polId
  toastStore.success(`POL actualizado a ${displayValue(port) || port.label || port.code}.`)
}'''
if old_select not in text:
    raise SystemExit('No se encontró selectRecommendedPort actual.')
text = text.replace(old_select, new_select, 1)

old_intro = """                {{ selectedIncotermCode === 'EXW'
                  ? 'Ubique la recolección en el mapa y consulte con IA los POL configurados más cercanos.'
                  : 'Seleccione uno de los WHS globales configurados. Su ubicación se refleja en el mapa.' }}"""
new_intro = """                {{ selectedIncotermCode === 'EXW'
                  ? 'Ubique la recolección en el mapa. La IA buscará puertos marítimos reales dentro de 500 km desde ese punto.'
                  : 'Seleccione uno de los WHS globales configurados. Su ubicación se refleja en el mapa.' }}"""
if old_intro not in text:
    raise SystemExit('No se encontró el texto introductorio EXW.')
text = text.replace(old_intro, new_intro, 1)

old_subtitle = '''                  <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Se calculan desde el punto marcado en el mapa, no desde el POL actual. Solo se muestran opciones dentro de 500 km y puede tocar una para cambiar el POL.</p>'''
new_subtitle = '''                  <p class="text-xs font-semibold text-[var(--dh-text-muted)]">La IA busca puertos marítimos por ubicación en un radio de 500 km desde el pin EXW. El catálogo POL solo se usa para ofrecer cambio rápido cuando existe una coincidencia.</p>'''
if old_subtitle not in text:
    raise SystemExit('No se encontró subtítulo de puertos.')
text = text.replace(old_subtitle, new_subtitle, 1)

old_cards = '''                <button
                  v-for="recommendation in nearestPortRecommendations"
                  :key="recommendation.portId"
                  type="button"
                  class="min-h-24 rounded-2xl border p-3 text-left transition"
                  :class="form.originId === recommendation.portId
                    ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.10)]'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[rgb(var(--dh-primary-rgb)/0.35)]'"
                  @click="selectRecommendedPort(recommendation.portId)"
                >
                  <span class="flex flex-wrap items-center justify-between gap-2">
                    <span class="block text-sm font-black">{{ recommendation.name }}</span>
                    <DhBadge :variant="form.originId === recommendation.portId ? 'success' : 'primary'">
                      {{ form.originId === recommendation.portId ? 'POL actual' : 'Cambiar POL' }}
                    </DhBadge>
                  </span>
                  <span v-if="recommendation.distanceKm != null" class="mt-2 block text-xs font-black text-[var(--dh-primary)]">
                    {{ recommendation.distanceKm.toFixed(1) }} km desde la recolección
                  </span>
                  <span class="mt-1 block text-xs font-semibold leading-relaxed text-[var(--dh-text-muted)]">{{ recommendation.reason }}</span>
                </button>'''
new_cards = '''                <button
                  v-for="recommendation in nearestPortRecommendations"
                  :key="recommendation.key"
                  type="button"
                  class="min-h-24 rounded-2xl border p-3 text-left transition"
                  :class="recommendation.polId && form.originId === recommendation.polId
                    ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.10)]'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[rgb(var(--dh-primary-rgb)/0.35)]'"
                  :disabled="!recommendation.polId"
                  @click="recommendation.polId && selectRecommendedPort(recommendation.polId)"
                >
                  <span class="flex flex-wrap items-center justify-between gap-2">
                    <span class="block text-sm font-black">{{ recommendation.name }}</span>
                    <DhBadge :variant="recommendation.polId && form.originId === recommendation.polId ? 'success' : recommendation.polId ? 'primary' : 'neutral'">
                      {{ recommendation.polId && form.originId === recommendation.polId
                        ? 'POL actual'
                        : recommendation.polId
                          ? 'Cambiar POL'
                          : 'Puerto cercano' }}
                    </DhBadge>
                  </span>
                  <span v-if="recommendation.distanceKm != null" class="mt-2 block text-xs font-black text-[var(--dh-primary)]">
                    {{ recommendation.distanceKm.toFixed(1) }} km desde la recolección
                  </span>
                  <span class="mt-1 block text-xs font-semibold leading-relaxed text-[var(--dh-text-muted)]">{{ recommendation.reason }}</span>
                  <span v-if="!recommendation.polId" class="mt-2 block text-[11px] font-bold text-[var(--dh-text-muted)]">
                    No está en el catálogo POL; se muestra porque sí está dentro del radio geográfico.
                  </span>
                </button>'''
if old_cards not in text:
    raise SystemExit('No se encontró el bloque de tarjetas de puertos.')
text = text.replace(old_cards, new_cards, 1)

payload_anchor = '''      incotermId: incoterm!.id,
      incotermName: displayValue(incoterm),
      incotermCode: incoterm!.code,
      currencyId: currency!.id,'''
payload_new = '''      incotermId: incoterm!.id,
      incotermName: displayValue(incoterm),
      incotermCode: incoterm!.code,
      pickupAddress: ['EXW', 'FCA'].includes(selectedIncotermCode.value) ? form.pickupAddress.trim() || null : null,
      pickupLatitude: ['EXW', 'FCA'].includes(selectedIncotermCode.value) ? form.pickupLatitude : null,
      pickupLongitude: ['EXW', 'FCA'].includes(selectedIncotermCode.value) ? form.pickupLongitude : null,
      currencyId: currency!.id,'''
if payload_anchor not in text:
    raise SystemExit('No se encontró el payload de creación de tarifa.')
text = text.replace(payload_anchor, payload_new, 1)

if text == original:
    raise SystemExit('El wizard no cambió.')
wizard.write_text(text, encoding='utf-8')

interfaces = Path('src/core/interfaces/pricing.ts')
itext = interfaces.read_text(encoding='utf-8')
ioriginal = itext
create_anchor = '''  incotermId?: string | null
  incotermName?: string | null
  incotermCode?: string | null
  containerQuantity: number'''
create_replacement = '''  incotermId?: string | null
  incotermName?: string | null
  incotermCode?: string | null
  pickupAddress?: string | null
  pickupLatitude?: number | null
  pickupLongitude?: number | null
  containerQuantity: number'''
if create_anchor not in itext:
    raise SystemExit('No se encontró bloque incoterm en pricing.ts')
itext = itext.replace(create_anchor, create_replacement, 1)
if itext == ioriginal:
    raise SystemExit('pricing.ts no cambió.')
interfaces.write_text(itext, encoding='utf-8')

print('Global nearest-port search + pickup persistence frontend patch applied.')
