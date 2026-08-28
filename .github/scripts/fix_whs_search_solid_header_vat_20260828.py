from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Pattern not found: {label}")
    return text.replace(old, new, 1)


location = Path("src/modules/pricing/components/PricingLocationSearchSelect.vue")
text = location.read_text()
text = replace_once(text, "import { Anchor, ChevronDown, Search, Truck, X } from 'lucide-vue-next'", "import { Anchor, ChevronDown, Search, Truck, Warehouse, X } from 'lucide-vue-next'", "location import")
text = replace_once(text, "interface LocationOption {\n  value: string\n  label: string\n}", "interface LocationOption {\n  value: string\n  label: string\n  searchText?: string\n}", "location option search text")
text = replace_once(text, "  terminalType?: 'CY' | 'SD'", "  terminalType?: 'CY' | 'SD' | 'WHS'", "WHS terminal type")
text = replace_once(text, "const icon = computed(() => props.terminalType === 'SD' ? Truck : Anchor)", "const icon = computed(() => {\n  if (props.terminalType === 'WHS') return Warehouse\n  return props.terminalType === 'SD' ? Truck : Anchor\n})", "WHS icon")
text = replace_once(text, "      const haystack = normalize(option.label)\n      return tokens.every((token) => haystack.includes(token))", "      const haystack = normalize(`${option.label} ${option.searchText ?? ''}`)\n      return tokens.every((token) => haystack.includes(token))", "search text filter")
location.write_text(text)

wizard = Path("src/modules/pricing/components/PricingAlternativeWizardCrystal.vue")
text = wizard.read_text()
text = replace_once(
    text,
    """const warehouseOptions = computed(() => catalogs.warehouses.map((item) => ({
  value: item.id,
  label: item.label || displayValue(item) || item.code,
})))""",
    """const warehouseOptions = computed(() => catalogs.warehouses.map((item) => {
  const meta = metadata(item)
  const name = item.label || displayValue(item) || item.code
  return {
    value: item.id,
    label: name,
    searchText: [
      name,
      displayValue(item),
      item.code,
      item.slug,
      meta?.countryCode,
      meta?.address,
    ].filter(Boolean).join(' '),
  }
}))""",
    "warehouse options",
)
text = replace_once(
    text,
    """function canApplyDestinationTax(line: RateLine) {
  return line.section === 'destination_charges' || line.optional
}""",
    """function canApplyDestinationTax(line: RateLine) {
  // IVA destino solo pertenece a cargos de destino. Recolecta, origen y costos de agente no llevan IVA.
  return line.section === 'destination_charges' && line.costDetailType !== 'AgentCharge'
}""",
    "VAT destination rule",
)
text = replace_once(
    text,
    """    return [{
      id: warehouse.id,
      label: warehouse.label || displayValue(warehouse) || warehouse.code,
      latitude,
      longitude,
      selected: warehouse.id === form.warehouseId,
    }]""",
    """    return [{
      id: warehouse.id,
      label: `WHS · ${warehouse.label || displayValue(warehouse) || warehouse.code}`,
      latitude,
      longitude,
      selected: warehouse.id === form.warehouseId,
    }]""",
    "WHS map label",
)
text = replace_once(
    text,
    """            <DhSelect
              v-if=\"selectedIncotermCode === 'FCA' && warehouseOptions.length\"
              v-model=\"form.warehouseId\"
              label=\"WHS global\"
              placeholder=\"Seleccione WHS\"
              :options=\"warehouseOptions\"
            />""",
    """            <PricingLocationSearchSelect
              v-if=\"selectedIncotermCode === 'FCA' && warehouseOptions.length\"
              v-model=\"form.warehouseId\"
              label=\"WHS global\"
              placeholder=\"Buscar o seleccionar WHS\"
              search-placeholder=\"Buscar WHS, país, ciudad, código o iniciales…\"
              terminal-type=\"WHS\"
              :options=\"warehouseOptions\"
            />""",
    "WHS searchable selector",
)
text = replace_once(
    text,
    """              <p v-if=\"metadata(selectedWarehouse)?.phone\" class=\"mt-1\"><strong>Teléfono:</strong> {{ metadata(selectedWarehouse)?.phone }}</p>
            </div>""",
    """              <p v-if=\"metadata(selectedWarehouse)?.phone\" class=\"mt-1\"><strong>Teléfono:</strong> {{ metadata(selectedWarehouse)?.phone }}</p>
              <p v-if=\"metadataNumber(selectedWarehouse, 'latitude', 'lat') != null && metadataNumber(selectedWarehouse, 'longitude', 'lng') != null\" class=\"mt-1\">
                <strong>Ubicación:</strong>
                {{ metadataNumber(selectedWarehouse, 'latitude', 'lat')?.toFixed(6) }},
                {{ metadataNumber(selectedWarehouse, 'longitude', 'lng')?.toFixed(6) }}
              </p>
            </div>""",
    "WHS coordinates display",
)
text = replace_once(
    text,
    """  background: var(--dh-card);
  box-shadow: var(--dh-shadow-md);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}""",
    """  background-color: #ffffff;
  background-image: none;
  opacity: 1;
  box-shadow: var(--dh-shadow-md);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.dark) .crystal-lines-header {
  background-color: #18181b;
}""",
    "solid sticky header",
)
wizard.write_text(text)
