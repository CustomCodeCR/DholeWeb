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
    `<DhBadge\n                      v-for="requirement in fclRateRequirements"\n                      :key="'required:' + requirement.containerTypeId"\n                      variant="primary"\n                    >\n                      {{ requirement.quantity }} × {{ requirement.containerTypeName }}\n                    </DhBadge>`,
    `<DhBadge\n                      v-for="coverage in fclRateCoverage"\n                      :key="'required:' + coverage.containerTypeId"\n                      :variant="coverage.availableCount > 0 ? 'success' : 'danger'"\n                    >\n                      {{ coverage.quantity }} × {{ coverage.containerTypeName }} · {{ coverage.availableCount > 0 ? coverage.availableCount + ' tarifa' + (coverage.availableCount === 1 ? '' : 's') : 'Sin tarifas' }}\n                    </DhBadge>`,
    'FCL coverage chips',
  )

  code = replaceRequired(
    code,
    `Si hay varios contenedores del mismo tipo, se usa una tarifa unitaria y se multiplica por la cantidad. Si hay tipos diferentes, cada tipo puede usar una naviera distinta; Dhole mantiene agente y moneda compatibles para construir una sola cotización.`,
    `Si hay varios contenedores del mismo tipo, se usa una tarifa unitaria y se multiplica por la cantidad. Si hay tipos diferentes, cada tipo puede usar una naviera distinta; Dhole mantiene agente y moneda compatibles para construir una sola cotización. La vigencia y los días restantes se muestran por cada tarifa de contenedor.`,
    'FCL coverage explanation',
  )

  code = replaceRequired(
    code,
    `<strong class="text-sm text-[var(--dh-primary)]">{{ formatMoney(line.totalCost, bundle.currency) }}</strong>`,
    `<div class="flex shrink-0 flex-col items-end gap-2">\n                        <DhBadge :variant="fclDaysUntilExpiry(line.rate.validTo) <= 3 ? 'danger' : fclDaysUntilExpiry(line.rate.validTo) <= 7 ? 'warning' : 'success'">{{ fclExpiryLabel(line.rate.validTo) }}</DhBadge>\n                        <strong class="text-sm text-[var(--dh-primary)]">{{ formatMoney(line.totalCost, bundle.currency) }}</strong>\n                      </div>`,
    'per-line FCL expiry chip',
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

  code = replaceRequired(
    code,
    `Dhole consultó cada tipo de contenedor por separado, pero no encontró tarifas compatibles por agente y moneda para cubrir toda la solicitud. Las navieras sí pueden ser diferentes.`,
    `Revise la cobertura por equipo. Si un contenedor aparece como “Sin tarifa”, falta una tarifa vigente para ese tipo y no se puede construir la combinación completa. Si todos tienen tarifas, no existe una combinación compatible por agente y moneda. Las navieras sí pueden ser diferentes.`,
    'FCL incomplete coverage explanation',
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
