from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"Expected block not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        if new in text:
            return
        raise RuntimeError(f"Expected text not found in {path}: {old!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


# 1) Costos y recargos: icono legible en sidebar y encabezado.
replace_all(
    "src/core/composables/useSidebarItems.ts",
    "BadgeDollarSign",
    "CircleDollarSign",
)
replace_all(
    "src/modules/pricing/views/PricingCostsView.vue",
    "BadgeDollarSign",
    "CircleDollarSign",
)
replace_once(
    "src/modules/pricing/views/PricingCostsView.vue",
    "  { key: 'actions', label: '', align: 'right', width: '120px' },",
    "  { key: 'actions', label: '', align: 'right', width: '144px' },",
)
replace_once(
    "src/modules/pricing/views/PricingCostsView.vue",
    '''          <template #cell-actions="{ row }"\n            ><div class="flex justify-end gap-1">\n              <button\n                v-if="canUpdate"\n                type="button"\n                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"\n                title="Editar"\n                @click.stop="openForm(row)"\n              >\n                <Pencil class="h-4 w-4" /></button\n              ><button\n                v-if="canSetActive"\n                type="button"\n                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"\n                :title="row.isActive ? 'Inactivar' : 'Activar'"\n                @click.stop="toggleActive(row)"\n              >\n                <PowerOff v-if="row.isActive" class="h-4 w-4 text-amber-600" /><Power\n                  v-else\n                  class="h-4 w-4 text-emerald-600"\n                /></button\n              ><button\n                v-if="canDelete"\n                type="button"\n                class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10"\n                title="Eliminar"\n                @click.stop="confirmDelete(row)"\n              >\n                <Trash2 class="h-4 w-4" />\n              </button></div\n          ></template>''',
    '''          <template #cell-actions="{ row }">\n            <div class="flex items-center justify-end gap-2">\n              <button\n                v-if="canUpdate"\n                type="button"\n                class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-black/[0.025] text-[var(--dh-text-soft)] transition hover:bg-black/[0.07] hover:text-[var(--dh-text)] dark:bg-white/[0.05] dark:hover:bg-white/[0.12]"\n                aria-label="Editar costo"\n                title="Editar"\n                @click.stop="openForm(row)"\n              >\n                <Pencil class="h-[18px] w-[18px] shrink-0" />\n              </button>\n              <button\n                v-if="canSetActive"\n                type="button"\n                class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-black/[0.025] transition hover:bg-black/[0.07] dark:bg-white/[0.05] dark:hover:bg-white/[0.12]"\n                :aria-label="row.isActive ? 'Inactivar costo' : 'Activar costo'"\n                :title="row.isActive ? 'Inactivar' : 'Activar'"\n                @click.stop="toggleActive(row)"\n              >\n                <PowerOff v-if="row.isActive" class="h-[18px] w-[18px] shrink-0 text-amber-500" />\n                <Power v-else class="h-[18px] w-[18px] shrink-0 text-emerald-500" />\n              </button>\n              <button\n                v-if="canDelete"\n                type="button"\n                class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/[0.06] text-red-500 transition hover:bg-red-500/[0.14]"\n                aria-label="Eliminar costo"\n                title="Eliminar"\n                @click.stop="confirmDelete(row)"\n              >\n                <Trash2 class="h-[18px] w-[18px] shrink-0" />\n              </button>\n            </div>\n          </template>''',
)

wizard = "src/modules/pricing/components/PricingAlternativeWizardCrystal.vue"

# 2) El agente se resuelve automáticamente por país del POL. Se conserva selección manual
# si no existe una coincidencia verificable en metadata/etiqueta.
replace_once(
    wizard,
    "const agentOptions = computed(() => catalogs.agents.map((item) => ({ value: item.id, label: displayValue(item) })))",
    '''const agentOptions = computed(() => catalogs.agents.map((item) => ({ value: item.id, label: displayValue(item) })))\n\nfunction countryTokens(item: CatalogItemSelectDto | null | undefined) {\n  const tokens = new Set<string>()\n  if (!item) return tokens\n\n  const meta = (metadata(item) ?? {}) as unknown as Record<string, unknown>\n  const add = (raw: unknown) => {\n    if (Array.isArray(raw)) {\n      raw.forEach(add)\n      return\n    }\n    if (raw == null || typeof raw === 'object') return\n    const value = normalizeCatalogValue(String(raw))\n    if (value.length >= 2) tokens.add(value)\n  }\n\n  for (const key of [\n    'countryCode', 'country', 'countryName', 'countryIso2', 'countryIso3',\n    'originCountryCode', 'originCountry', 'iso2', 'iso3', 'countries', 'countryCodes',\n  ]) add(meta[key])\n\n  for (const raw of [item.value, item.label]) {\n    const text = String(raw ?? '').trim()\n    if (!text.includes(',')) continue\n    add(text.split(',').at(-1))\n  }\n\n  return tokens\n}\n\nfunction resolveAgentForOrigin() {\n  const origin = selectedOrigin.value\n  const originTokens = countryTokens(origin)\n  if (!origin || !originTokens.size) return null\n\n  let best: CatalogItemSelectDto | null = null\n  let bestScore = 0\n  for (const agent of catalogs.agents) {\n    const agentTokens = countryTokens(agent)\n    const searchText = normalizeCatalogValue(\n      [agent.code, agent.value, agent.label, agent.metadataJson].filter(Boolean).join(' '),\n    )\n    let score = 0\n    for (const token of originTokens) {\n      if (agentTokens.has(token)) score = Math.max(score, token.length <= 3 ? 100 : 90)\n      else if (token.length >= 4 && searchText.includes(token)) score = Math.max(score, 60)\n    }\n    if (score > bestScore) {\n      best = agent\n      bestScore = score\n    }\n  }\n  return best\n}\n\nfunction assignAgentForOrigin() {\n  if (hydratingExistingRate.value || !form.originId) return\n  const agent = resolveAgentForOrigin()\n  if (agent && form.agentId !== agent.id) form.agentId = agent.id\n}''',
)
replace_once(
    wizard,
    '''watch(\n  () => form.destinationId,''',
    '''watch(\n  () => form.originId,\n  () => assignAgentForOrigin(),\n)\n\nwatch(\n  () => form.destinationId,''',
)

# 3) Pantalla 09: las líneas persistidas LCL sin CostId (reglas/Excel) también deben verse.
replace_once(
    wizard,
    '''function standardSectionLines(section: RateSection) {\n  return rateLines.value.filter(\n    (line) =>\n      line.section === section &&\n      line.included &&\n      !line.optional &&\n      !line.manual &&\n      line.costDetailType !== 'AgentCharge',\n  )\n}\n\nconst agentLines = computed(() =>\n  rateLines.value.filter(\n    (line) => line.included && !line.optional && !line.manual && line.costDetailType === 'AgentCharge',\n  ),\n)''',
    '''function persistedLineInFullView(line: RateLine) {\n  return props.viewOnly && step.value === 9 && Boolean(line.detailId)\n}\n\nfunction standardSectionLines(section: RateSection) {\n  return rateLines.value.filter(\n    (line) =>\n      line.section === section &&\n      line.included &&\n      ((!line.optional && !line.manual) || persistedLineInFullView(line)) &&\n      line.costDetailType !== 'AgentCharge',\n  )\n}\n\nconst agentLines = computed(() =>\n  rateLines.value.filter(\n    (line) =>\n      line.included &&\n      line.costDetailType === 'AgentCharge' &&\n      ((!line.optional && !line.manual) || persistedLineInFullView(line)),\n  ),\n)''',
)

print("Requested develop pricing fixes applied.")
