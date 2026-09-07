import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingRateRequestPoePodFix] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function replaceAfter(source: string, marker: string, anchor: string, replacement: string, label: string) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) throw new Error(`[pricingRateRequestPoePodFix] Missing ${label} marker.`)
  const anchorIndex = source.indexOf(anchor, markerIndex)
  if (anchorIndex < 0) throw new Error(`[pricingRateRequestPoePodFix] Missing ${label}.`)
  return source.slice(0, anchorIndex) + replacement + source.slice(anchorIndex + anchor.length)
}

function patchWizard(source: string) {
  let code = source

  // Persist POE and POD as first-class fields in the seller request API contract.
  code = replaceOne(
    code,
    `          destinationName: finalDestination ? displayValue(finalDestination) : displayValue(destination),\n          payload: {`,
    `          destinationName: finalDestination ? displayValue(finalDestination) : displayValue(destination),\n          poeId: destination.id,\n          poeName: displayValue(destination),\n          podId: finalDestination?.id ?? (form.podId || null),\n          podName: finalDestination ? displayValue(finalDestination) : null,\n          payload: {`,
    'seller request POE/POD payload',
  )

  // Prefer typed route fields returned by Pricing and retain JSON fallback for old requests.
  code = replaceOne(
    code,
    `      const routeContext = (request.payload as unknown as { requestContext?: Record<string, unknown> })?.requestContext\n      const poeId = String(routeContext?.poeId ?? '').trim()\n      const podId = String(routeContext?.podId ?? '').trim()\n      if (poeId) form.destinationId = poeId\n      if (podId) form.podId = podId`,
    `      const typedRoute = request as unknown as { poeId?: string | null; podId?: string | null }\n      const routeContext = (request.payload as unknown as { requestContext?: Record<string, unknown> })?.requestContext\n      const savedForm = request.payload?.form as Record<string, unknown> | undefined\n      const poeId = String(typedRoute.poeId ?? routeContext?.poeId ?? savedForm?.destinationId ?? '').trim()\n      const podId = String(typedRoute.podId ?? routeContext?.podId ?? savedForm?.podId ?? '').trim()\n      if (poeId) form.destinationId = poeId\n      if (podId) form.podId = podId`,
    'request route hydration fallback',
  )

  code = replaceOne(
    code,
    `Pricing recibe el tipo de contenedor, Incoterm, fecha de carga lista y la indicación de Anticipado/Redestino antes de seleccionar la tarifa.`,
    `Pricing recibe POE y POD exactamente como los definió Ventas, además del contenedor, Incoterm, fecha de carga lista y la indicación de Anticipado/Redestino antes de seleccionar la tarifa.`,
    'screen 5 request description',
  )

  const handoffMarker = `Datos definidos por Ventas`
  const oldGrid = `            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">`
  const newGrid = `            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">`
  code = replaceAfter(code, handoffMarker, oldGrid, newGrid, 'screen 5 request summary grid')

  const cargoReadyCard = `              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">\n                <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Carga lista</span>\n                <strong class="mt-1 block text-sm">{{ requestedCargoReadyDate || 'No indicada' }}</strong>\n              </div>`

  const routeCards = `              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">\n                <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">POE</span>\n                <strong class="mt-1 block text-sm">{{ displayValue(selectedDestination) || 'No indicado' }}</strong>\n              </div>\n              <div class="rounded-xl border border-[rgb(var(--dh-primary-rgb)/0.32)] bg-[rgb(var(--dh-primary-rgb)/0.06)] p-3">\n                <div class="flex items-center justify-between gap-2">\n                  <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">POD</span>\n                  <DhBadge variant="primary">Destino final</DhBadge>\n                </div>\n                <strong\n                  class="mt-1 block text-sm"\n                  :class="shipmentModeForApi === 'Lcl' && !selectedPod ? 'text-red-600 dark:text-red-300' : ''"\n                >{{ displayValue(selectedPod) || (shipmentModeForApi === 'Lcl' ? 'POD no indicado por Ventas' : 'No indicado') }}</strong>\n              </div>\n${cargoReadyCard}`

  code = replaceAfter(code, handoffMarker, cargoReadyCard, routeCards, 'screen 5 POE/POD cards')

  return code
}

export function pricingRateRequestPoePodFix(): Plugin {
  return {
    name: 'dhole-pricing-rate-request-poe-pod-fix',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
