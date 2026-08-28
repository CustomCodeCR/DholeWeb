from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8-sig')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    "const destinationVatEnabled = ref(false)\nconst optionalVatEnabled = ref(false)\n",
    "",
    'remove global VAT toggles',
)

replace_once(
    """      if (line.included && optionalVatEnabled.value && canApplyDestinationTax(line)) {
        line.applyDestinationTax = true
      }
""",
    "",
    'remove optional VAT auto-selection',
)

replace_once(
    """function setDestinationVat(enabled: boolean) {
  destinationVatEnabled.value = enabled
  rateLines.value.forEach((line) => {
    if (line.section === 'destination_charges' && !line.optional && line.costDetailType !== 'AgentCharge') {
      line.applyDestinationTax = enabled
    }
  })
}
function setOptionalVat(enabled: boolean) {
  optionalVatEnabled.value = enabled
  rateLines.value.forEach((line) => {
    if (line.optional) line.applyDestinationTax = enabled && line.included
  })
}
function vatSummary(lines: RateLine[]) {
  const applicable = lines.filter((line) => line.included && canApplyDestinationTax(line))
  return {
    tax: applicable.reduce((sum, line) => sum + lineTaxAmount(line), 0),
    total: applicable.reduce((sum, line) => sum + lineSaleWithTax(line), 0),
  }
}
""",
    """function setLineDestinationTax(line: RateLine, enabled: boolean) {
  line.applyDestinationTax = Boolean(enabled) && canApplyDestinationTax(line) && destinationTaxRate.value > 0
}
""",
    'replace group VAT helpers with line VAT helper',
)

replace_once(
    """  rateLines.value = lines
  if (destinationVatEnabled.value) setDestinationVat(true)
  if (optionalVatEnabled.value) setOptionalVat(true)
""",
    """  rateLines.value = lines
""",
    'remove global VAT restoration',
)

replace_once(
    """    if (!line.included) {
      line.applyDestinationTax = false
    } else if (optionalVatEnabled.value && canApplyDestinationTax(line)) {
      line.applyDestinationTax = true
    }
""",
    """    if (!line.included) {
      line.applyDestinationTax = false
    }
""",
    'keep haulage VAT manual',
)

replace_once(
    """  destinationVatEnabled.value = false
  optionalVatEnabled.value = false
""",
    "",
    'remove reset global VAT',
)

replace_once(
    """            <div class=\"crystal-group-header\">
              <h3 class=\"text-xs font-black uppercase tracking-[0.15em] text-[var(--dh-text-muted)]\">{{ group.label }}</h3>
              <div v-if=\"group.key === 'destination'\" class=\"crystal-vat-header\">
                <DhCheckbox
                  :model-value=\"destinationVatEnabled\"
                  :label=\"`Aplicar IVA destino (${destinationTaxRate}%)`\"
                  :disabled=\"destinationTaxRate <= 0\"
                  @update:model-value=\"setDestinationVat\"
                />
                <DhInput :model-value=\"vatSummary(group.lines).tax\" type=\"number\" label=\"Monto IVA\" disabled />
                <DhInput :model-value=\"vatSummary(group.lines).total\" type=\"number\" label=\"Venta + IVA\" disabled />
              </div>
            </div>
""",
    """            <div class=\"crystal-group-header\">
              <h3 class=\"text-xs font-black uppercase tracking-[0.15em] text-[var(--dh-text-muted)]\">{{ group.label }}</h3>
            </div>
""",
    'remove destination group VAT header',
)

replace_once(
    'class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_180px_180px]"',
    'class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_160px_160px_minmax(220px,280px)]"',
    'add standard line VAT column',
)

replace_once(
    """              <DhInput v-model.number=\"line.costAmount\" type=\"number\" step=\"0.01\" min=\"0\" label=\"Costo\" :disabled=\"line.costDetailType === 'AgentCharge' || line.costType !== 'Variable'\" />
              <DhInput v-model.number=\"line.saleAmount\" type=\"number\" step=\"0.01\" min=\"0\" label=\"Venta\" :disabled=\"line.costDetailType === 'AgentCharge'\" />
""",
    """              <DhInput v-model.number=\"line.costAmount\" type=\"number\" step=\"0.01\" min=\"0\" label=\"Costo\" :disabled=\"line.costDetailType === 'AgentCharge' || line.costType !== 'Variable'\" />
              <DhInput v-model.number=\"line.saleAmount\" type=\"number\" step=\"0.01\" min=\"0\" label=\"Venta\" :disabled=\"line.costDetailType === 'AgentCharge'\" />
              <div v-if=\"canApplyDestinationTax(line)\" class=\"crystal-line-vat\">
                <DhCheckbox
                  :model-value=\"Boolean(line.applyDestinationTax)\"
                  :label=\"`IVA destino (${destinationTaxRate}%)`\"
                  :disabled=\"destinationTaxRate <= 0\"
                  @update:model-value=\"(enabled) => setLineDestinationTax(line, enabled)\"
                />
                <div class=\"crystal-line-vat__amounts\">
                  <span>IVA <strong>{{ formatMoney(lineTaxAmount(line), line.currencyName || line.currencyCode || 'USD') }}</strong></span>
                  <span>Venta + IVA <strong>{{ formatMoney(lineSaleWithTax(line), line.currencyName || line.currencyCode || 'USD') }}</strong></span>
                </div>
              </div>
""",
    'add VAT control to standard lines',
)

replace_once(
    """              <div class=\"crystal-group-header mb-3\">
                <p class=\"text-xs font-black uppercase tracking-[0.15em] text-[var(--dh-text-muted)]\">Cargos opcionales</p>
                <div class=\"crystal-vat-header\">
                  <DhCheckbox
                    :model-value=\"optionalVatEnabled\"
                    :label=\"`Aplicar IVA destino (${destinationTaxRate}%)`\"
                    :disabled=\"destinationTaxRate <= 0\"
                    @update:model-value=\"setOptionalVat\"
                  />
                  <DhInput :model-value=\"vatSummary(bottomRateLines.filter((line) => line.optional)).tax\" type=\"number\" label=\"Monto IVA\" disabled />
                  <DhInput :model-value=\"vatSummary(bottomRateLines.filter((line) => line.optional)).total\" type=\"number\" label=\"Venta + IVA\" disabled />
                </div>
              </div>
""",
    """              <div class=\"crystal-group-header mb-3\">
                <p class=\"text-xs font-black uppercase tracking-[0.15em] text-[var(--dh-text-muted)]\">Cargos opcionales</p>
                <p class=\"text-[11px] font-bold text-[var(--dh-text-muted)]\">El IVA se selecciona individualmente en cada rubro.</p>
              </div>
""",
    'remove optional group VAT header',
)

replace_once(
    'class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]"',
    'class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_160px_160px_minmax(220px,280px)_auto]"',
    'add bottom line VAT column',
)

replace_once(
    """                <DhInput v-model.number=\"line.costAmount\" type=\"number\" step=\"0.01\" min=\"0\" label=\"Costo\" :disabled=\"line.costDetailType === 'AgentCharge'\" />
                <DhInput v-model.number=\"line.saleAmount\" type=\"number\" step=\"0.01\" min=\"0\" label=\"Venta\" :disabled=\"line.costDetailType === 'AgentCharge'\" />
                <button v-if=\"line.manual\" type=\"button\" class=\"h-10 px-2 text-xs font-black text-red-500\" @click=\"rateLines = rateLines.filter((item) => item.key !== line.key)\">Eliminar</button>
                <span v-else />
""",
    """                <DhInput v-model.number=\"line.costAmount\" type=\"number\" step=\"0.01\" min=\"0\" label=\"Costo\" :disabled=\"line.costDetailType === 'AgentCharge'\" />
                <DhInput v-model.number=\"line.saleAmount\" type=\"number\" step=\"0.01\" min=\"0\" label=\"Venta\" :disabled=\"line.costDetailType === 'AgentCharge'\" />
                <div v-if=\"canApplyDestinationTax(line)\" class=\"crystal-line-vat\">
                  <DhCheckbox
                    :model-value=\"Boolean(line.applyDestinationTax)\"
                    :label=\"`IVA destino (${destinationTaxRate}%)`\"
                    :disabled=\"destinationTaxRate <= 0\"
                    @update:model-value=\"(enabled) => setLineDestinationTax(line, enabled)\"
                  />
                  <div class=\"crystal-line-vat__amounts\">
                    <span>IVA <strong>{{ formatMoney(lineTaxAmount(line), line.currencyName || line.currencyCode || 'USD') }}</strong></span>
                    <span>Venta + IVA <strong>{{ formatMoney(lineSaleWithTax(line), line.currencyName || line.currencyCode || 'USD') }}</strong></span>
                  </div>
                </div>
                <span v-else />
                <button v-if=\"line.manual\" type=\"button\" class=\"h-10 px-2 text-xs font-black text-red-500\" @click=\"rateLines = rateLines.filter((item) => item.key !== line.key)\">Eliminar</button>
                <span v-else />
""",
    'add VAT control to bottom lines',
)

replace_once(
    """  background: color-mix(in srgb, var(--dh-card) 97%, transparent);
  box-shadow: var(--dh-shadow-md);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
""",
    """  background: var(--dh-card);
  box-shadow: var(--dh-shadow-md);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
""",
    'solid sticky lines header',
)

replace_once(
    """.crystal-vat-header {
  display: grid;
  width: min(100%, 640px);
  grid-template-columns: minmax(190px, 1fr) minmax(130px, 170px) minmax(130px, 170px);
  align-items: end;
  gap: 0.6rem;
  border: 1px solid color-mix(in srgb, var(--dh-border) 88%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--dh-card) 92%, transparent);
  padding: 0.65rem;
}
""",
    """.crystal-line-vat {
  display: grid;
  gap: 0.45rem;
  align-self: stretch;
  border: 1px solid var(--dh-border);
  border-radius: 16px;
  background: var(--dh-card);
  padding: 0.6rem 0.7rem;
}

.crystal-line-vat__amounts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--dh-text-muted);
}

.crystal-line-vat__amounts span {
  display: grid;
  gap: 0.1rem;
}

.crystal-line-vat__amounts strong {
  color: var(--dh-text);
  font-size: 0.76rem;
}
""",
    'line VAT styles',
)

replace_once(
    """  .crystal-vat-header {
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
""",
    """  .crystal-line-vat {
    width: 100%;
    min-width: 0;
  }

  .crystal-line-vat__amounts {
    grid-template-columns: minmax(0, 1fr);
  }
""",
    'mobile VAT styles',
)

path.write_text(text, encoding='utf-8')
