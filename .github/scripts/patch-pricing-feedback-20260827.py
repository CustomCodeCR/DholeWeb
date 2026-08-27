from pathlib import Path
import re

wizard_path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
layout_path = Path('src/shared/components/layouts/MainLayout.vue')

wizard = wizard_path.read_text(encoding='utf-8')
original_wizard = wizard

# El ejecutivo es dato comercial digitado, nunca el usuario autenticado.
if "executiveName: ''" not in wizard:
    raise SystemExit('No se encontró executiveName inicializado vacío.')
executive_old = '<DhInput v-model="form.executiveName" label="Ejecutivo de venta" placeholder="Escriba el nombre del ejecutivo" />'
executive_new = '<DhInput v-model="form.executiveName" label="Ejecutivo de venta" placeholder="Escriba el nombre del ejecutivo" autocomplete="off" />'
if executive_old in wizard:
    wizard = wizard.replace(executive_old, executive_new, 1)
elif executive_new not in wizard:
    raise SystemExit('No se encontró el input libre de Ejecutivo de venta.')

# El IVA se cobra al cliente, pero no es venta ganada ni utilidad.
financial_pattern = re.compile(
    r"const totalCost = computed\(\(\) => includedLines\.value\.reduce\(\(sum, line\) => sum \+ number\(line\.costAmount\), 0\)\)\n"
    r"const totalSale = computed\(\(\) => includedLines\.value\.reduce\(\(sum, line\) => sum \+ lineSaleWithTax\(line\), 0\)\)\n"
    r"const totalUtility = computed\(\(\) => totalSale\.value - totalCost\.value\)\n"
    r"const totalMarginPercentage = computed\(\(\) =>\n"
    r"  totalSale\.value > 0 \? \(totalUtility\.value / totalSale\.value\) \* 100 : 0,\n"
    r"\)"
)
financial_replacement = """const totalCost = computed(() => includedLines.value.reduce((sum, line) => sum + number(line.costAmount), 0))
const totalSaleBeforeTax = computed(() => includedLines.value.reduce((sum, line) => sum + number(line.saleAmount), 0))
const totalTax = computed(() => includedLines.value.reduce((sum, line) => sum + lineTaxAmount(line), 0))
// totalSale es el total a cobrar al cliente; el IVA se muestra, pero queda fuera de utilidad y margen.
const totalSale = computed(() => totalSaleBeforeTax.value + totalTax.value)
const totalUtility = computed(() => totalSaleBeforeTax.value - totalCost.value)
const totalMarginPercentage = computed(() =>
  totalSaleBeforeTax.value > 0 ? (totalUtility.value / totalSaleBeforeTax.value) * 100 : 0,
)"""
wizard, financial_count = financial_pattern.subn(financial_replacement, wizard, count=1)
if financial_count != 1:
    raise SystemExit(f'Bloque financiero no reemplazado: {financial_count}')

# Persistir la venta sin IVA para que el backend tampoco lo use en margen/aprobación.
old_sale = '    saleAmount: lineSaleWithTax(line),'
new_sale = '    saleAmount: number(line.saleAmount),'
if old_sale not in wizard:
    raise SystemExit('No se encontró saleAmount con IVA en details.')
wizard = wizard.replace(old_sale, new_sale, 1)

# Normalizar términos por línea antes de enviarlos: una misma condición no puede quedar
# repetida ni aparecer simultáneamente en Incluye / Sujeto a / No incluye.
helper_pattern = re.compile(
    r"  const uniqueText = \(values: Array<string \| null \| undefined>\) => \{\n"
    r"[\s\S]*?\n  \}\n\n  const includeTerms =",
    re.MULTILINE,
)
helper_replacement = """  const uniqueTermLines = (values: Array<string | null | undefined>) => {
    const seen = new Set<string>()
    const result: string[] = []

    values.forEach((value) => {
      String(value ?? '')
        .split(/\\r?\\n/)
        .forEach((rawLine) => {
          const text = rawLine.trim()
          if (!text) return
          const key = commercialTermKey(text) || normalizeCatalogValue(text)
          if (!key || seen.has(key)) return
          seen.add(key)
          result.push(text)
        })
    })

    return result
  }

  const includeTerms ="""
wizard, helper_count = helper_pattern.subn(lambda _: helper_replacement, wizard, count=1)
if helper_count != 1:
    raise SystemExit(f'Helper de términos no reemplazado: {helper_count}')

# Solo dentro de este archivo y bloque de guardado existía uniqueText.
wizard = wizard.replace('uniqueText([', 'uniqueTermLines([')
wizard = wizard.replace('uniqueText(\n    commercialTerms.excludes', 'uniqueTermLines(\n    commercialTerms.excludes')
if 'uniqueText(' in wizard:
    raise SystemExit('Quedó una referencia a uniqueText sin migrar.')

if wizard == original_wizard:
    raise SystemExit('El wizard no tuvo cambios.')
wizard_path.write_text(wizard, encoding='utf-8')

layout = layout_path.read_text(encoding='utf-8')
if 'overflow-x-hidden' not in layout:
    if 'overflow-x-clip' not in layout:
        raise SystemExit('No se encontró el overflow horizontal del layout.')
else:
    # hidden convierte el main en scroll container y rompe position: sticky de pantalla 7.
    layout = layout.replace('overflow-x-hidden', 'overflow-x-clip')
    layout_path.write_text(layout, encoding='utf-8')

print('Pricing feedback patch aplicado.')
