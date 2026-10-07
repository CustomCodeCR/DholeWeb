import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const strictI18n = process.argv.includes('--strict-i18n')
const jsonOutput = process.argv.includes('--json')

function walk(dir, extensions, output = []) {
  if (!fs.existsSync(dir)) return output
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, extensions, output)
    else if (extensions.some((extension) => entry.name.endsWith(extension))) output.push(full)
  }
  return output
}

function flatten(value, prefix = '', output = new Map()) {
  for (const [key, child] of Object.entries(value ?? {})) {
    const name = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, name, output)
    else output.set(name, child)
  }
  return output
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\\\', '/')
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

function templateOnly(source) {
  const match = source.match(/<template(?:\s[^>]*)?>([\s\S]*?)<\/template>/i)
  return match?.[1] ?? ''
}

function looksTranslatable(value) {
  const clean = value.trim()
  if (!clean || clean.length < 2) return false
  if (/^(?:https?:|\/|#|\.|@|[A-Z0-9_-]{1,5}$)/.test(clean)) return false
  if (/^[\d\s.,:;+%$€₡/_()-]+$/.test(clean)) return false
  if (/^(?:GET|POST|PUT|PATCH|DELETE|JSON|UUID|ID|URL|HTTP|HTTPS|FCL|LCL|LTL|FTL|POL|POE|POD|CBM|CFT|SED|NVOCC)$/i.test(clean)) return false
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(clean)
}

const esPath = path.join(SRC, 'core/i18n/es.json')
const enPath = path.join(SRC, 'core/i18n/en.json')
const es = flatten(JSON.parse(fs.readFileSync(esPath, 'utf8')))
const en = flatten(JSON.parse(fs.readFileSync(enPath, 'utf8')))
const missingInEnglish = [...es.keys()].filter((key) => !en.has(key)).sort()
const missingInSpanish = [...en.keys()].filter((key) => !es.has(key)).sort()

const vueFiles = walk(SRC, ['.vue'])
const sourceFiles = walk(SRC, ['.vue', '.ts'])
const missingUsedKeys = []
const hardcoded = []
const responsive = []

const usedKeyPattern = /(?:\bt|\$t)\(\s*['"]([^'"]+)['"]/g
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(usedKeyPattern)) {
    const key = match[1]
    if (!es.has(key) || !en.has(key)) {
      missingUsedKeys.push({ file: relative(file), line: lineNumber(source, match.index ?? 0), key })
    }
  }
}

for (const file of vueFiles) {
  const source = fs.readFileSync(file, 'utf8')
  const template = templateOnly(source)
  const hasI18n = /\buseI18n\s*\(|\$t\s*\(|\bt\(\s*['"]/.test(source)
  const literals = []

  const attrPattern = /\b(?:label|title|placeholder|aria-label|alt)=['"]([^'"{}:$][^'"]*)['"]/g
  for (const match of template.matchAll(attrPattern)) {
    if (looksTranslatable(match[1])) literals.push({ type: 'attribute', value: match[1].trim() })
  }

  const textPattern = />\s*([^<>{}\n][^<>{}\n]{1,160})\s*</g
  for (const match of template.matchAll(textPattern)) {
    const value = match[1].replace(/\s+/g, ' ').trim()
    if (looksTranslatable(value) && !/^(?:true|false|null|undefined)$/i.test(value)) {
      literals.push({ type: 'text', value })
    }
  }

  if (literals.length) {
    hardcoded.push({ file: relative(file), hasI18n, count: literals.length, examples: literals.slice(0, 5) })
  }

  const fixedWidth = (source.match(/\b(?:w|min-w|max-w)-\[(?:\d+(?:\.\d+)?)(?:px|rem)\]/g) ?? []).length
  const nowrap = (source.match(/\bwhitespace-nowrap\b/g) ?? []).length
  const unresponsiveGrid = (source.match(/(?<![:\w-])grid-cols-[2-9]\b/g) ?? []).length
  const important = (source.match(/!important/g) ?? []).length
  const fixedPosition = (source.match(/\bfixed\b/g) ?? []).length
  const score = fixedWidth * 3 + nowrap + unresponsiveGrid * 2 + important + fixedPosition

  if (score > 0) {
    responsive.push({ file: relative(file), score, fixedWidth, nowrap, unresponsiveGrid, important, fixedPosition })
  }
}

hardcoded.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
responsive.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))

const report = {
  summary: {
    vueFiles: vueFiles.length,
    esKeys: es.size,
    enKeys: en.size,
    missingInEnglish: missingInEnglish.length,
    missingInSpanish: missingInSpanish.length,
    missingUsedKeys: missingUsedKeys.length,
    filesWithHardcodedVisibleText: hardcoded.length,
    filesWithResponsiveSmells: responsive.length,
  },
  missingInEnglish,
  missingInSpanish,
  missingUsedKeys,
  topHardcodedFiles: hardcoded.slice(0, 30),
  topResponsiveFiles: responsive.slice(0, 30),
}

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('\nDholeWeb UI quality audit')
  console.log('========================')
  console.table(report.summary)

  if (missingInEnglish.length) console.log('\nMissing in EN:', missingInEnglish.join(', '))
  if (missingInSpanish.length) console.log('\nMissing in ES:', missingInSpanish.join(', '))
  if (missingUsedKeys.length) {
    console.log('\nTranslation keys used in source but missing from a dictionary:')
    for (const item of missingUsedKeys.slice(0, 50)) console.log(`- ${item.file}:${item.line} -> ${item.key}`)
  }

  console.log('\nTop files with visible hardcoded text:')
  for (const item of hardcoded.slice(0, 20)) {
    const examples = item.examples.map((example) => JSON.stringify(example.value)).join(', ')
    console.log(`- ${item.file}: ${item.count} (${item.hasI18n ? 'partial i18n' : 'no i18n'}) ${examples}`)
  }

  console.log('\nTop responsive-risk files:')
  for (const item of responsive.slice(0, 20)) {
    console.log(`- ${item.file}: score ${item.score} | fixed-width ${item.fixedWidth}, nowrap ${item.nowrap}, base grids ${item.unresponsiveGrid}, !important ${item.important}, fixed ${item.fixedPosition}`)
  }
}

if (strictI18n && (missingInEnglish.length || missingInSpanish.length || missingUsedKeys.length)) {
  process.exitCode = 1
}
