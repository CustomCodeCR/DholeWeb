from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:140]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


# Public contract
replace_once(
    'src/core/interfaces/pricing.ts',
    "  | 'PerShipment'\n  | 'PerContainer'",
    "  | 'PerShipment'\n  | 'PerService'\n  | 'PerContainer'",
)

# Cost editor
cost_form = 'src/modules/pricing/components/PricingCostFormDrawer.vue'
replace_once(
    cost_form,
    "const isEquipmentBasis = computed(\n  () => form.chargeBasis === 'PerContainer' || form.chargeBasis === 'PerTruck',\n)\nconst utility",
    "const isEquipmentBasis = computed(\n  () => form.chargeBasis === 'PerContainer' || form.chargeBasis === 'PerTruck',\n)\nconst perServiceId = computed<string>({\n  get: () => form.serviceIds[0] ?? '',\n  set: (value) => {\n    form.serviceIds = value ? [value] : []\n  },\n})\nconst utility",
)
replace_once(
    cost_form,
    "  { label: 'Por embarque', value: 'PerShipment' },\n  { label: 'Por contenedor', value: 'PerContainer' },",
    "  { label: 'Por embarque', value: 'PerShipment' },\n  { label: 'Por Servicio', value: 'PerService' },\n  { label: 'Por contenedor', value: 'PerContainer' },",
)
replace_once(
    cost_form,
    "  (basis) => {\n    form.isAccountant = basis === 'PerContainer' || basis === 'PerTruck'\n  },",
    "  (basis) => {\n    form.isAccountant = basis === 'PerContainer' || basis === 'PerTruck'\n    if (basis === 'PerService' && form.serviceIds.length > 1) {\n      form.serviceIds = form.serviceIds.slice(0, 1)\n    }\n  },",
)
replace_once(
    cost_form,
    "    !routeSelectionValid.value ||\n    Number(form.costAmount) < 0 ||",
    "    !routeSelectionValid.value ||\n    (form.chargeBasis === 'PerService' && services.length !== 1) ||\n    Number(form.costAmount) < 0 ||",
)
replace_once(
    cost_form,
    "        <DhSelect v-model=\"form.chargeBasis\" label=\"Base de cobro\" :options=\"chargeBasisOptions\" />\n        <DhSelect\n          v-model=\"form.routeScope\"",
    "        <DhSelect v-model=\"form.chargeBasis\" label=\"Base de cobro\" :options=\"chargeBasisOptions\" />\n        <DhSelect\n          v-if=\"form.chargeBasis === 'PerService'\"\n          v-model=\"perServiceId\"\n          label=\"Servicio de Pricing\"\n          placeholder=\"Seleccione el servicio\"\n          :options=\"catalogs.serviceOptions.value\"\n          :error=\"form.submitted && !perServiceId ? 'Seleccione el servicio de Pricing.' : undefined\"\n        />\n        <DhSelect\n          v-model=\"form.routeScope\"",
)
replace_once(
    cost_form,
    "        <div class=\"md:col-span-2\">\n          <PricingMultiSelect\n            v-model=\"form.serviceIds\"",
    "        <div v-if=\"form.chargeBasis !== 'PerService'\" class=\"md:col-span-2\">\n          <PricingMultiSelect\n            v-model=\"form.serviceIds\"",
)

# Human-readable labels in the pricing matrix and rate wizard.
replace_once(
    'src/modules/pricing/views/PricingCostsView.vue',
    "        PerShipment: 'Por embarque',\n        PerContainer: 'Por contenedor',",
    "        PerShipment: 'Por embarque',\n        PerService: 'Por Servicio',\n        PerContainer: 'Por contenedor',",
)
replace_once(
    'src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
    "    PerShipment: 'Por embarque',\n    PerContainer: 'Por contenedor',",
    "    PerShipment: 'Por embarque',\n    PerService: 'Por Servicio',\n    PerContainer: 'Por contenedor',",
)

print('Per-service charge basis applied to Web.')
