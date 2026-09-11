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
    `<div class="crystal-validity-range">\n          <span>Vigencia</span>\n          <strong>{{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}</strong>\n        </div>`,
    `<div class="crystal-validity-range">\n          <span>Vigencia de la tarifa</span>\n          <strong>{{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}</strong>\n        </div>`,
    'single-rate validity label',
  )

  code = replaceRequired(
    code,
    `<p v-if="rate.spaceComment" class="mt-3 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-left text-xs font-semibold text-[var(--dh-text-muted)]">\n                  Comentario: {{ rate.spaceComment }}\n                </p>`,
    `<div class="mt-3 rounded-xl border border-[var(--dh-border)] bg-black/[0.025] px-3 py-2 text-left text-xs text-[var(--dh-text-muted)] dark:bg-white/[0.04]">\n                  <strong class="block font-black text-[var(--dh-text)]">Comentarios de la tarifa</strong>\n                  <span class="mt-1 block whitespace-pre-line font-semibold">{{ rate.spaceComment || 'Sin comentarios registrados' }}</span>\n                </div>`,
    'single-rate comments',
  )

  code = replaceRequired(
    code,
    `<strong class="block font-black">Condiciones / observaciones</strong>`,
    `<strong class="block font-black">Comentarios de la tarifa</strong>`,
    'FCL line comments label',
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
    `<span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Vencimiento más próximo</span>`,
    `<span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Vigencia de la tarifa</span>`,
    'bundle validity label',
  )

  code = replaceRequired(
    code,
    `<strong class="mt-1 block text-sm">{{ formatDate(bundle.validTo) }} · {{ fclExpiryLabel(bundle.validTo) }}</strong>`,
    `<strong class="mt-1 block text-sm">{{ formatDate(bundle.validFrom) }} – {{ formatDate(bundle.validTo) }}</strong>`,
    'bundle validity range',
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
