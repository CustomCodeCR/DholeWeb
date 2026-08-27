from pathlib import Path
import re

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')
original = text

text = text.replace(
"""interface NearestPortRecommendation {
  portId: string
  name: string
  reason: string
}""",
"""interface NearestPortRecommendation {
  portId: string
  name: string
  reason: string
  distanceKm: number | null
}""",
1,
)

parse_pattern = re.compile(
    r"function parseNearestPortResponse\(content: string\) \{[\s\S]*?\n\}\n\nasync function recommendNearestPorts\(\) \{[\s\S]*?\n\}\n\nasync function geocodePickupAddress",
    re.MULTILINE,
)

replacement = r'''function parseNearestPortResponse(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  const parsed = JSON.parse(cleaned) as {
    recommendations?: Array<{ portId?: string; distanceKm?: number; reason?: string }>
  }
  return Array.isArray(parsed.recommendations) ? parsed.recommendations : []
}

function deterministicNearestPorts() {
  const pickup = pickupCoordinates.value
  if (!pickup) return [] as NearestPortRecommendation[]

  return catalogs.pol
    .flatMap((port) => {
      const latitude = metadataNumber(port, 'latitude', 'lat')
      const longitude = metadataNumber(port, 'longitude', 'lng')
      if (latitude == null || longitude == null) return []
      const distance = distanceKm(pickup.latitude, pickup.longitude, latitude, longitude)
      if (distance > 500) return []
      return [{
        portId: port.id,
        name: displayValue(port) || port.label || port.code,
        reason: `A ${distance.toFixed(1)} km del punto de recolección marcado.`,
        distanceKm: Math.round(distance * 10) / 10,
      }]
    })
    .sort((left, right) => number(left.distanceKm) - number(right.distanceKm))
    .slice(0, 3)
}

async function recommendNearestPorts() {
  if (selectedIncotermCode.value !== 'EXW' || !form.pickupAddress.trim()) return
  if (!pickupCoordinates.value) {
    await geocodePickupAddress(false)
    if (!pickupCoordinates.value) return
  }
  if (!catalogs.pol.length) {
    toastStore.warning('Sin puertos configurados', 'No existen POL configurados para sugerir un puerto de origen.')
    return
  }

  try {
    recommendingPorts.value = true
    nearestPortRecommendations.value = []

    // El backend toma SIEMPRE las coordenadas del punto EXW como origen del cálculo.
    // Se envían todos los POL configurados; si alguno no tiene coordenadas en Config,
    // AI Logistics intenta resolverlas por nombre antes de aplicar el radio matemático.
    const response = await callEndpoint<unknown, Record<string, unknown>>(
      { method: 'POST', path: '/api/ai/logistics/nearest-ports', headers: { Accept: 'application/json' } },
      {
        body: {
          pickupAddress: form.pickupAddress.trim(),
          latitude: form.pickupLatitude,
          longitude: form.pickupLongitude,
          maxDistanceKm: 500,
          ports: catalogs.pol.map((port) => ({
            id: port.id,
            name: displayValue(port) || port.label || port.code,
            code: port.code,
            country: metadata(port)?.countryCode ?? null,
            latitude: metadataNumber(port, 'latitude', 'lat'),
            longitude: metadataNumber(port, 'longitude', 'lng'),
          })),
        },
      },
    )
    const result = unwrapApiResponse<{ content?: string }>(response as never)
    const recommendations = parseNearestPortResponse(String(result.content ?? ''))
    const allowed = new Map(catalogs.pol.map((port) => [port.id, port]))
    const seen = new Set<string>()
    nearestPortRecommendations.value = recommendations
      .filter((item) => Boolean(item.portId && allowed.has(item.portId) && !seen.has(item.portId)))
      .map((item) => {
        const portId = item.portId!
        seen.add(portId)
        const port = allowed.get(portId)!
        const configuredLatitude = metadataNumber(port, 'latitude', 'lat')
        const configuredLongitude = metadataNumber(port, 'longitude', 'lng')
        const calculatedDistance = pickupCoordinates.value && configuredLatitude != null && configuredLongitude != null
          ? distanceKm(
              pickupCoordinates.value.latitude,
              pickupCoordinates.value.longitude,
              configuredLatitude,
              configuredLongitude,
            )
          : null
        const responseDistance = Number(item.distanceKm)
        const resolvedDistance = Number.isFinite(responseDistance)
          ? responseDistance
          : calculatedDistance
        return {
          portId,
          name: displayValue(port) || port.label || port.code,
          reason: String(item.reason ?? 'Puerto recomendado por cercanía logística al punto de recolección.'),
          distanceKm: resolvedDistance == null ? null : Math.round(resolvedDistance * 10) / 10,
        }
      })
      .filter((item) => item.distanceKm == null || item.distanceKm <= 500)
      .sort((left, right) => number(left.distanceKm ?? 999999) - number(right.distanceKm ?? 999999))
      .slice(0, 3)

    if (!nearestPortRecommendations.value.length) {
      nearestPortRecommendations.value = deterministicNearestPorts()
    }

    if (!nearestPortRecommendations.value.length) {
      toastStore.warning(
        'Sin puertos dentro de 500 km',
        'No se pudo resolver un POL configurado dentro de 500 km desde la ubicación de recolección marcada.',
      )
    }
  } catch (error) {
    const fallback = deterministicNearestPorts()
    if (fallback.length) {
      nearestPortRecommendations.value = fallback
      toastStore.warning('Sugerencia calculada sin IA', 'Se muestran los POL configurados con coordenadas más cercanos al punto EXW.')
    } else {
      toastStore.backendError(error, 'No se pudieron calcular los puertos cercanos desde la ubicación de recolección.')
    }
  } finally {
    recommendingPorts.value = false
  }
}

async function geocodePickupAddress'''

text, count = parse_pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'No se reemplazó el bloque de recomendación de puertos: {count}')

text = text.replace(
"""function selectRecommendedPort(portId: string) {
  if (catalogs.pol.some((port) => port.id === portId)) form.originId = portId
}""",
"""function selectRecommendedPort(portId: string) {
  const port = catalogs.pol.find((candidate) => candidate.id === portId)
  if (!port) return
  form.originId = portId
  toastStore.success(`POL actualizado a ${displayValue(port) || port.label || port.code}.`)
}""",
1,
)

text = text.replace(
"""                  <p class=\"text-sm font-black\">Puertos cercanos sugeridos por IA</p>
                  <p class=\"text-xs font-semibold text-[var(--dh-text-muted)]\">La IA solo puede elegir POL configurados en Dhole dentro de un radio máximo de 500 km.</p>""",
"""                  <p class=\"text-sm font-black\">Puertos más cercanos a la recolección</p>
                  <p class=\"text-xs font-semibold text-[var(--dh-text-muted)]\">Se calculan desde el punto marcado en el mapa, no desde el POL actual. Solo se muestran opciones dentro de 500 km y puede tocar una para cambiar el POL.</p>""",
1,
)

card_old = """                  <span class=\"block text-sm font-black\">{{ recommendation.name }}</span>
                  <span class=\"mt-1 block text-xs font-semibold leading-relaxed text-[var(--dh-text-muted)]\">{{ recommendation.reason }}</span>"""
card_new = """                  <span class=\"flex flex-wrap items-center justify-between gap-2\">
                    <span class=\"block text-sm font-black\">{{ recommendation.name }}</span>
                    <DhBadge :variant=\"form.originId === recommendation.portId ? 'success' : 'primary'\">
                      {{ form.originId === recommendation.portId ? 'POL actual' : 'Cambiar POL' }}
                    </DhBadge>
                  </span>
                  <span v-if=\"recommendation.distanceKm != null\" class=\"mt-2 block text-xs font-black text-[var(--dh-primary)]\">
                    {{ recommendation.distanceKm.toFixed(1) }} km desde la recolección
                  </span>
                  <span class=\"mt-1 block text-xs font-semibold leading-relaxed text-[var(--dh-text-muted)]\">{{ recommendation.reason }}</span>"""
if card_old not in text:
    raise SystemExit('No se encontró el contenido de la tarjeta de puerto recomendado.')
text = text.replace(card_old, card_new, 1)

mobile_old = """  .crystal-vat-header {
    grid-template-columns: 1fr 1fr;
  }

  .crystal-vat-header :deep(label:first-child) {
    grid-column: 1 / -1;
  }
"""
mobile_new = """  .crystal-vat-header {
    width: 100%;
    max-width: 100%;
    grid-template-columns: minmax(0, 1fr);
  }

  .crystal-vat-header > * {
    min-width: 0;
    max-width: 100%;
  }

  .crystal-vat-header :deep(input) {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
"""
if mobile_old not in text:
    raise SystemExit('No se encontró el CSS móvil del IVA.')
text = text.replace(mobile_old, mobile_new, 1)

if text == original:
    raise SystemExit('El archivo no cambió.')

path.write_text(text, encoding='utf-8')
print('EXW nearest ports + mobile VAT patch applied.')
