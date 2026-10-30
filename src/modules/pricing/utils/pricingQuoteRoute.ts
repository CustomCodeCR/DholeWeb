export interface PricingQuoteRoute {
  polName?: string | null
  poeName?: string | null
  podName?: string | null
}

function locationName(value?: string | null): string {
  const name = String(value ?? '').trim()
  // Historical DTOs may store the absence of a POD as the literal text "null".
  return /^(null|undefined|n\/a)$/i.test(name) ? '' : name
}

/**
 * Pricing uses POL -> POD via POE when there is a real final POD.
 * For land/air quotes (or any historical quote) without POD, POE is the
 * final destination: POL To POE, never "To null Via POE".
 */
export function pricingQuoteRouteName(
  rate: PricingQuoteRoute,
  viaLabel: (poeName: string) => string = (poeName) => poeName,
): string {
  const origin = locationName(rate.polName)
  const poe = locationName(rate.poeName)
  const pod = locationName(rate.podName)
  const destination = pod || poe

  const route = origin && destination
    ? origin + ' To ' + destination
    : origin || destination

  if (!pod || !poe) return route

  return route + ' Via ' + viaLabel(poe)
}
