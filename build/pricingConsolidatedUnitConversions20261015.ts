import type { Plugin } from 'vite'

// Applied after cargo, Miami/air units, and consolidated height validation.
const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-consolidated-unit-conversions-20261015'
const REPLACEMENTS: { label: string; before: string; after: string; count: number }[] = [
  { label: "select units in all consolidated modes", before: "const usesSelectableCargoUnits = computed(() => isMiamiLcl.value || isAirLcl.value)", after: "const usesSelectableCargoUnits = computed(() => consolidatedCargoMode.value)", count: 1 },
  { label: "allow centimeters meters inches", before: "const miamiDimensionUnitOptions = [\n  { value: 'in', label: 'Pulgadas (in)' },\n  { value: 'cm', label: 'Centímetros (cm)' },\n]", after: "const miamiDimensionUnitOptions = [\n  { value: 'in', label: 'Pulgadas (in)' },\n  { value: 'cm', label: 'Centímetros (cm)' },\n  { value: 'm', label: 'Metros (m)' },\n  { value: 'mm', label: 'Milímetros (mm)' },\n]", count: 1 },
  { label: "default route units and respect user choice", before: "function roundCargoInputValue(value: number, decimals = 4) {", after: "const cargoDimensionWasSelectedManually = ref(false)\nfunction selectConsolidatedDimensionUnit(unit: string) {\n  if (!['mm', 'cm', 'm', 'in'].includes(unit)) return\n  cargoDimensionWasSelectedManually.value = true\n  form.miamiDimensionInputUnit = unit\n}\nwatch([isMiamiLcl, isAirLcl, isUnitedStatesPol, consolidatedCargoMode], () => {\n  if (!cargoDimensionWasSelectedManually.value) {\n    form.miamiDimensionInputUnit = isMiamiLcl.value || isAirLcl.value || isUnitedStatesPol.value ? 'in' : 'cm'\n  }\n}, { immediate: true })\n\nfunction roundCargoInputValue(value: number, decimals = 4) {", count: 1 },
  { label: "input display supports meters", before: "const displayValue = form.miamiDimensionInputUnit === 'cm' ? cm : cm / INCH_TO_CM", after: "const displayValue = form.miamiDimensionInputUnit === 'cm' ? cm : form.miamiDimensionInputUnit === 'm' ? cm / 100 : form.miamiDimensionInputUnit === 'mm' ? cm * 10 : cm / INCH_TO_CM", count: 1 },
  { label: "input meters to normalized centimeters", before: "const cm = form.miamiDimensionInputUnit === 'cm'\n    ? entered\n    : entered * INCH_TO_CM", after: "const cm = form.miamiDimensionInputUnit === 'cm'\n    ? entered\n    : form.miamiDimensionInputUnit === 'm' ? entered * 100 : form.miamiDimensionInputUnit === 'mm' ? entered / 10 : entered * INCH_TO_CM", count: 1 },
  { label: "live dimension equivalents including meters", before: "function miamiDimensionConversionText(storedValue: number) {\n  const cm = cargoDimensionToCm(storedValue)\n  const inches = cm / INCH_TO_CM\n  return form.miamiDimensionInputUnit === 'cm'\n    ? cm.toFixed(2) + ' cm → ' + inches.toFixed(2) + ' in'\n    : inches.toFixed(2) + ' in → ' + cm.toFixed(2) + ' cm'\n}", after: "function miamiDimensionConversionText(storedValue: number) {\n  const cm = cargoDimensionToCm(storedValue)\n  const inches = cm / INCH_TO_CM\n  const meters = cm / 100\n  const millimeters = cm * 10\n  return form.miamiDimensionInputUnit === 'mm'\n    ? millimeters.toFixed(2) + ' mm → ' + cm.toFixed(2) + ' cm / ' + inches.toFixed(2) + ' in'\n    : form.miamiDimensionInputUnit === 'm'\n    ? meters.toFixed(3) + ' m → ' + cm.toFixed(2) + ' cm / ' + inches.toFixed(2) + ' in'\n    : form.miamiDimensionInputUnit === 'cm'\n      ? cm.toFixed(2) + ' cm → ' + meters.toFixed(3) + ' m / ' + inches.toFixed(2) + ' in'\n      : inches.toFixed(2) + ' in → ' + cm.toFixed(2) + ' cm / ' + meters.toFixed(3) + ' m'\n}", count: 1 },
  { label: "keep standard LCL/LTL price-volume conventions", before: "const useCftCargoVolume = computed(() =>\n  usesSelectableCargoUnits.value\n    ? form.miamiDimensionInputUnit === 'in'\n    : isUnitedStatesPol.value,\n)", after: "const useCftCargoVolume = computed(() =>\n  isMiamiLcl.value || isAirLcl.value\n    ? form.miamiDimensionInputUnit === 'in'\n    : isUnitedStatesPol.value,\n)", count: 1 },
  { label: "preserve coloader chargeable basis", before: ":chargeable-volume-unit=\"usesSelectableCargoUnits && form.miamiDimensionInputUnit === 'in' ? 'CFT' : 'CBM'\"", after: ":chargeable-volume-unit=\"(isMiamiLcl || isAirLcl) && form.miamiDimensionInputUnit === 'in' ? 'CFT' : 'CBM'\"", count: 1 },
  { label: "preserve manually selected dimension unit", before: "v-model=\"form.miamiDimensionInputUnit\"", after: ":model-value=\"form.miamiDimensionInputUnit\" @update:model-value=\"selectConsolidatedDimensionUnit($event)\"", count: 2 },
  { label: "correct consolidated height limit in meters", before: "const value = normalizedUnit === 'in' ? maximumCm / INCH_TO_CM : maximumCm", after: "const value = normalizedUnit === 'in' ? maximumCm / INCH_TO_CM : normalizedUnit === 'm' ? maximumCm / 100 : normalizedUnit === 'mm' ? maximumCm * 10 : maximumCm", count: 1 },
  { label: "display meter choice", before: "{{ form.miamiDimensionInputUnit === 'in' ? 'Pulgadas' : 'Centímetros' }}", after: "{{ form.miamiDimensionInputUnit === 'in' ? 'Pulgadas' : form.miamiDimensionInputUnit === 'm' ? 'Metros' : form.miamiDimensionInputUnit === 'mm' ? 'Milímetros' : 'Centímetros' }}", count: 1 },
  { label: "honest conversion guidance", before: "'Pulgadas (in) trabaja y muestra el volumen en CFT; centímetros (cm) trabaja y muestra el volumen en CBM. Dhole conserva el mismo volumen físico al cambiar de unidad.'", after: "'El sistema normaliza dimensiones a centímetros y peso a kilogramos. Los CBM/CFT de cobro mantienen las reglas propias de la tarifa. El peso se suma entre las líneas.'", count: 1 },
  { label: "select units in standard LCL/LTL", before: "              <div class=\"space-y-3\">\n                <div\n                  v-for=\"(line, index) in consolidatedCargoLines\"", after: "              <div v-if=\"consolidatedCargoMode && !isMiamiLcl && !isAirLcl\" class=\"grid gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 md:grid-cols-2\">\n                <DhSelect :model-value=\"form.miamiDimensionInputUnit\" @update:model-value=\"selectConsolidatedDimensionUnit($event)\" label=\"Unidad de dimensiones\" :options=\"miamiDimensionUnitOptions\" />\n                <DhSelect v-model=\"form.miamiWeightInputUnit\" label=\"Unidad de peso\" :options=\"miamiWeightUnitOptions\" />\n                <p class=\"text-xs font-semibold text-[var(--dh-text-muted)] md:col-span-2\">Ingrese las dimensiones en milímetros, centímetros, metros o pulgadas y el peso en kg o libras. Al cambiar unidades se mantienen los valores físicos.</p>\n              </div>\n\n              <div class=\"space-y-3\">\n                <div\n                  v-for=\"(line, index) in consolidatedCargoLines\"", count: 1 },
  { label: "show total consolidated weight", before: "              <div class=\"grid gap-3 sm:grid-cols-2 xl:grid-cols-4\">\n                <div class=\"crystal-metric crystal-metric--neutral\">\n                  <span class=\"block text-[10px] font-black uppercase tracking-[0.12em]\">Volumen físico</span>", after: "              <div class=\"grid gap-3 sm:grid-cols-2 xl:grid-cols-5\">\n                <div class=\"crystal-metric crystal-metric--neutral\">\n                  <span class=\"block text-[10px] font-black uppercase tracking-[0.12em]\">Peso total consolidado</span>\n                  <strong class=\"mt-1 block text-base\">{{ consolidatedTotalWeightKg.toFixed(2) }} kg</strong>\n                  <small>{{ miamiKgToLb(consolidatedTotalWeightKg).toFixed(2) }} lb · {{ form.cargoPackages }} bultos declarados · {{ consolidatedTotalPallets }} tarimas</small>\n                </div>\n                <div class=\"crystal-metric crystal-metric--neutral\">\n                  <span class=\"block text-[10px] font-black uppercase tracking-[0.12em]\">Volumen físico</span>", count: 1 },
]
function patchWizard(source: string): string {
  if (source.includes(MARKER)) return source
  if (!source.includes('// dhole-miami-lcl-rules-20261002')
    || !source.includes('// dhole-consolidated-height-limits-20261007')) return source
  let code = source
  for (const { label, before, after, count } of REPLACEMENTS) {
    const found = code.split(before).length - 1
    if (found !== count) {
      throw new Error('[pricingConsolidatedUnitConversions20261015] ' + label + ': expected ' + count + ' matches but got ' + found)
    }
    code = code.replaceAll(before, after)
  }
  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd < 0) throw new Error('[pricingConsolidatedUnitConversions20261015] Vue script end not found')
  return code.slice(0, scriptEnd) + '\n' + MARKER + '\n' + code.slice(scriptEnd)
}
export function pricingConsolidatedUnitConversions20261015(): Plugin {
  return {
    name: 'dhole-pricing-consolidated-unit-conversions-20261015',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replace(/\\/g, '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
