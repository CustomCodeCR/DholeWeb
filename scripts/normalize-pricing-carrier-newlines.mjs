import { readFileSync, writeFileSync } from 'node:fs'

// An existing transient Pricing preparation step can insert the *literal*
// characters backslash+n into executable Vue/TypeScript instead of line breaks.
// Normalize ONLY this known injected block, leaving unrelated strings intact.
const path = new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url)
let source = readFileSync(path, 'utf8')
const malformed = String.raw`details.forEach((detail, index) => {\n    const line = normalizedIncludedLines[index]\n    if (line) detail.notes = fclPersistCarrierNote(line, detail.notes)\n  })\n\n  const includedNameKeys`
if (source.includes(malformed)) {
  source = source.replace(malformed, malformed.replaceAll(String.raw`\n`, '\n'))
  writeFileSync(path, source)
  console.log('Pricing carrier included-line patch normalized')
}
if (source.includes(String.raw`details.forEach((detail, index) => {\n`)) {
  throw new Error('Malformed Pricing carrier block remains; refuse compilation')
}
