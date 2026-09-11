import { readFileSync } from 'node:fs'

const wizardPath = new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url)
const source = readFileSync(wizardPath, 'utf8')

const mapperStart = source.indexOf(
  'const details: CreateRateDetailRequest[] = includedLines.value.map((line) => ({',
)

if (mapperStart < 0) {
  throw new Error('No se encontró el mapper de details de PricingAlternativeWizardCrystal.')
}

const mapperEnd = source.indexOf('\n  }))', mapperStart)
if (mapperEnd < 0) {
  throw new Error('No se pudo delimitar el mapper de details de PricingAlternativeWizardCrystal.')
}

const mapper = source.slice(mapperStart, mapperEnd)

if (!mapper.includes('saleAmount: number(line.saleAmount),')) {
  throw new Error(
    'Regresión de Pricing: todos los detalles, incluidos OriginCharge, deben enviar la venta editable en saleAmount.',
  )
}

if (/saleAmount\s*:\s*line\.costDetailType\s*===\s*['"]OriginCharge['"]\s*\?\s*0/.test(mapper)) {
  throw new Error('Regresión de Pricing: OriginCharge no puede enviarse con saleAmount en cero.')
}

console.log('Pricing origin-sale payload check: OK')
