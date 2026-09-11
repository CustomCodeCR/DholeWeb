from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


def replace_exact_count(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{label}: expected {expected} matches, found {count}")
    return text.replace(old, new)


def patch_interfaces() -> None:
    path = Path("src/core/interfaces/pricing.ts")
    text = path.read_text(encoding="utf-8")

    text = replace_once(
        text,
        "  notes?: string | null\n  applyDestinationTax: boolean\n",
        "  notes?: string | null\n  billToClient?: string | null\n  applyDestinationTax: boolean\n",
        "RateDetailDto.billToClient",
    )
    text = replace_once(
        text,
        "  notes?: string | null\n  quantity?: number | null\n  applyDestinationTax?: boolean\n",
        "  notes?: string | null\n  billToClient?: string | null\n  quantity?: number | null\n  applyDestinationTax?: boolean\n",
        "CreateRateDetailRequest.billToClient",
    )

    path.write_text(text, encoding="utf-8")


def patch_wizard() -> None:
    path = Path("src/modules/pricing/components/PricingAlternativeWizardCrystal.vue")
    text = path.read_text(encoding="utf-8")

    text = replace_once(
        text,
        "  notes?: string | null\n  currencyId: string\n",
        "  notes?: string | null\n  billToClient?: string | null\n  currencyId: string\n",
        "RateLine.billToClient",
    )
    text = replace_once(
        text,
        "const rateLines = ref<RateLine[]>([])\nconst locatingPickup = ref(false)\n",
        "const rateLines = ref<RateLine[]>([])\nconst billToBatchByGroup = ref<Record<string, string>>({})\nconst locatingPickup = ref(false)\n",
        "batch billing state",
    )
    text = replace_once(
        text,
        "function number(value: unknown) {\n  const parsed = Number(value)\n  return Number.isFinite(parsed) ? parsed : 0\n}\n\nfunction distanceKm(",
        "function number(value: unknown) {\n  const parsed = Number(value)\n  return Number.isFinite(parsed) ? parsed : 0\n}\n\nfunction normalizeBillToClient(value?: string | null) {\n  const normalized = String(value ?? '').trim()\n  return normalized || null\n}\n\nfunction applyBillToBatch(group: { key: string; lines: RateLine[] }) {\n  const billToClient = normalizeBillToClient(billToBatchByGroup.value[group.key])\n  group.lines.forEach((line) => {\n    line.billToClient = billToClient\n  })\n}\n\nfunction distanceKm(",
        "billing helpers",
    )
    text = replace_once(
        text,
        "        notes: detail.notes ?? null,\n        serviceIds: configuredCost?.services?.map((service) => service.id) ?? [],\n",
        "        notes: detail.notes ?? null,\n        billToClient: detail.billToClient ?? null,\n        serviceIds: configuredCost?.services?.map((service) => service.id) ?? [],\n",
        "hydrate billToClient",
    )
    text = replace_once(
        text,
        "    saleAmount: number(line.saleAmount),\n    quantity: quantityForChargeBasis(line.chargeBasis),\n",
        "    saleAmount: number(line.saleAmount),\n    billToClient: normalizeBillToClient(line.billToClient),\n    quantity: quantityForChargeBasis(line.chargeBasis),\n",
        "save billToClient",
    )

    old_group_header = """          <div v-for=\"group in orderedRateGroups\" :key=\"group.key\" class=\"space-y-2\">\n            <div class=\"crystal-group-header\">\n              <h3 class=\"text-xs font-black uppercase tracking-[0.15em] text-[var(--dh-text-muted)]\">{{ group.label }}</h3>\n            </div>\n"""
    new_group_header = """          <div v-for=\"group in orderedRateGroups\" :key=\"group.key\" class=\"space-y-2\">\n            <div class=\"crystal-group-header\">\n              <h3 class=\"text-xs font-black uppercase tracking-[0.15em] text-[var(--dh-text-muted)]\">{{ group.label }}</h3>\n              <div class=\"flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end\">\n                <DhInput\n                  :model-value=\"billToBatchByGroup[group.key] ?? ''\"\n                  class=\"min-w-[240px]\"\n                  label=\"Facturar / cobrar a (bloque)\"\n                  placeholder=\"Ej. Cliente A\"\n                  maxlength=\"200\"\n                  autocomplete=\"off\"\n                  @update:model-value=\"(value) => { billToBatchByGroup[group.key] = String(value ?? '') }\"\n                />\n                <DhButton type=\"button\" variant=\"secondary\" size=\"sm\" @click=\"applyBillToBatch(group)\">\n                  Aplicar al bloque\n                </DhButton>\n              </div>\n            </div>\n"""
    text = replace_once(text, old_group_header, new_group_header, "block billing header")

    text = replace_once(
        text,
        "lg:grid-cols-[minmax(200px,1fr)_120px_140px_140px_minmax(190px,230px)]', group.key === 'freight'",
        "lg:grid-cols-[minmax(200px,1fr)_120px_140px_140px_minmax(200px,260px)_minmax(190px,230px)]', group.key === 'freight'",
        "main rate line grid",
    )
    text = replace_once(
        text,
        "class=\"crystal-line grid items-end gap-3 p-3 lg:grid-cols-[minmax(200px,1fr)_120px_140px_140px_minmax(190px,230px)_auto]\"",
        "class=\"crystal-line grid items-end gap-3 p-3 lg:grid-cols-[minmax(200px,1fr)_120px_140px_140px_minmax(200px,260px)_minmax(190px,230px)_auto]\"",
        "bottom rate line grid",
    )

    sale_input = '              <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" :disabled="line.costDetailType === \'AgentCharge\'" />\n'
    sale_with_billing = sale_input + """              <DhInput\n                :model-value=\"line.billToClient ?? ''\"\n                maxlength=\"200\"\n                label=\"Facturar / cobrar a\"\n                placeholder=\"Cliente\"\n                autocomplete=\"off\"\n                @update:model-value=\"(value) => { line.billToClient = String(value ?? '') }\"\n              />\n"""
    text = replace_exact_count(text, sale_input, sale_with_billing, 2, "per-line billing inputs")

    text = replace_once(
        text,
        "grid-template-columns: minmax(320px, 1fr) 120px 140px 140px !important;",
        "grid-template-columns: minmax(320px, 1fr) 120px 140px 140px minmax(200px, 260px) !important;",
        "freight billing grid",
    )

    # Keep the existing 1180px table anchor intact because a Vite pre-transform
    # uses that exact anchor to add the responsive Screen 9 mobile cards.
    text = replace_once(
        text,
        '<tr><th class="px-4 py-3">Rubro</th><th class="px-4 py-3">Base</th><th class="px-4 py-3">Cant.</th><th class="px-4 py-3">Divisa</th><th class="px-4 py-3 text-right">Costo unit.</th><th class="px-4 py-3 text-right">Venta unit.</th><th class="px-4 py-3 text-right">Venta subtotal</th><th class="px-4 py-3 text-right">IVA</th><th class="px-4 py-3 text-right">Venta total</th></tr>',
        '<tr><th class="px-4 py-3">Rubro</th><th class="px-4 py-3">Base</th><th class="px-4 py-3">Cant.</th><th class="px-4 py-3">Divisa</th><th class="px-4 py-3">Facturar / cobrar a</th><th class="px-4 py-3 text-right">Costo unit.</th><th class="px-4 py-3 text-right">Venta unit.</th><th class="px-4 py-3 text-right">Venta subtotal</th><th class="px-4 py-3 text-right">IVA</th><th class="px-4 py-3 text-right">Venta total</th></tr>',
        "summary billing header",
    )
    text = replace_once(
        text,
        '                    <td class="px-4 py-3 font-black">{{ detailCurrencyValue(line) }}</td>\n                    <td class="px-4 py-3 text-right">{{ formatMoney(number(line.costAmount), canonicalCurrencyCode(line)) }}</td>',
        '                    <td class="px-4 py-3 font-black">{{ detailCurrencyValue(line) }}</td>\n                    <td class="px-4 py-3 font-semibold">{{ line.billToClient || \'—\' }}</td>\n                    <td class="px-4 py-3 text-right">{{ formatMoney(number(line.costAmount), canonicalCurrencyCode(line)) }}</td>',
        "summary billing cell",
    )

    path.write_text(text, encoding="utf-8")


def validate() -> None:
    pricing = Path("src/core/interfaces/pricing.ts").read_text(encoding="utf-8")
    wizard = Path("src/modules/pricing/components/PricingAlternativeWizardCrystal.vue").read_text(encoding="utf-8")
    required = [
        "billToClient?: string | null",
        "billToClient: normalizeBillToClient(line.billToClient)",
        "billToClient: detail.billToClient ?? null",
        "Facturar / cobrar a (bloque)",
        "Aplicar al bloque",
        ":model-value=\"line.billToClient ?? ''\"",
        "applyBillToBatch(group)",
    ]
    for needle in required:
        if needle not in pricing and needle not in wizard:
            raise RuntimeError(f"Missing expected feature marker: {needle}")


patch_interfaces()
patch_wizard()
validate()
print("Frontend billing client patch applied and structurally validated.")
