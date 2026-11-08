import { readFileSync, readdirSync } from 'node:fs'
const dir = 'dist/assets'
const file = readdirSync(dir).find((filename) => /^PricingAlternativeWizardCrystal.*\.js$/.test(filename))
if (!file) throw new Error('Pricing wizard bundle missing')
const code = readFileSync(dir + '/' + file, 'utf8')
console.log('Pricing bundle:', file, 'bytes:', code.length)
const marker = code.indexOf('setup(')
console.log('setup location:', marker, 'opening:', code.slice(marker, marker + 900))
const matches = [...code.matchAll(/\bW\b/g)]
console.log('W references total:', matches.length)
for (const match of matches.slice(0, 28)) {
  const i = match.index
  console.log('W @', i, ':', code.slice(Math.max(0, i - 110), Math.min(code.length, i + 160)))
}
for (const regex of [/\bconst W\s*=/g, /\blet W\s*=/g, /\bW\s*=\s*\w/g, /\bW\s*=/g]) {
  console.log('Declarations/assignments:', regex.toString())
  for (const m of [...code.matchAll(regex)].slice(0, 12)) {
    const i = m.index
    console.log(code.slice(Math.max(0, i - 250), Math.min(code.length, i + 420)))
  }
}
