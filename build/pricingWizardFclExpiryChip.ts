import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingWizardFclExpiryChip] Missing ${label} anchor.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceRequired(
    code,
    `<div class="flex flex-wrap justify-end gap-2">\n                    <DhBadge variant="primary">{{ fclContainerTotal }} contenedores</DhBadge>\n                    <DhBadge :variant="bundle.preAuthorized ? 'warning' : 'success'">{{ bundle.preAuthorized ? 'Incluye preautorizada' : 'Preaprobada' }}</DhBadge>\n                  </div>`,
    `<div class="flex flex-wrap justify-end gap-2">\n                    <DhBadge variant="primary">{{ fclContainerTotal }} contenedores</DhBadge>\n                    <DhBadge :variant="fclDaysUntilExpiry(bundle.validTo) <= 3 ? 'danger' : fclDaysUntilExpiry(bundle.validTo) <= 7 ? 'warning' : 'success'">{{ fclExpiryLabel(bundle.validTo) }}</DhBadge>\n                    <DhBadge :variant="bundle.preAuthorized ? 'warning' : 'success'">{{ bundle.preAuthorized ? 'Incluye preautorizada' : 'Preaprobada' }}</DhBadge>\n                  </div>`,
    'FCL header chips',
  )

  code = replaceRequired(
    code,
    `<span class="text-[10px] font-bold text-[var(--dh-text-muted)]">{{ formatDate(line.rate.validFrom) }} – {{ formatDate(line.rate.validTo) }} · <strong>{{ fclExpiryLabel(line.rate.validTo) }}</strong></span>`,
    `<span class="text-[10px] font-bold text-[var(--dh-text-muted)]">{{ formatDate(line.rate.validFrom) }} – {{ formatDate(line.rate.validTo) }}</span>`,
    'remove duplicated line expiry text',
  )

  code = replaceRequired(
    code,
    `<strong class="mt-1 block text-sm">{{ formatDate(bundle.validTo) }} · {{ fclExpiryLabel(bundle.validTo) }}</strong>`,
    `<strong class="mt-1 block text-sm">{{ formatDate(bundle.validTo) }}</strong>`,
    'remove duplicated bundle expiry text',
  )

  return code
}

export function pricingWizardFclExpiryChip(): Plugin {
  return {
    name: 'dhole-pricing-wizard-fcl-expiry-chip',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
