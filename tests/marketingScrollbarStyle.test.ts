import assert from 'node:assert/strict'
import test from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const themeUrl = new URL('../src/assets/theme.css', import.meta.url)
const marketingDir = fileURLToPath(new URL('../src/modules/marketing/', import.meta.url))

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(fullPath)
    return ['.vue', '.css', '.ts'].includes(extname(entry.name)) ? [fullPath] : []
  }))
  return nested.flat()
}

test('FASE 56 defines one standard Dhole scrollbar contract for every surface', async () => {
  const theme = await readFile(themeUrl, 'utf8')

  assert.match(theme, /FASE 56 — One Dhole scrollbar contract for every scrollable surface/)
  assert.match(theme, /:where\(html, body, body \*, \.dh-scrollbar\)\s*\{[^}]*scrollbar-width:\s*thin;[^}]*scrollbar-color:\s*var\(--dh-scrollbar-thumb\) var\(--dh-scrollbar-track\);/s)
  assert.match(theme, /:where\(html, body, body \*, \.dh-scrollbar\)::\-webkit-scrollbar\s*\{[^}]*width:\s*var\(--dh-scrollbar-size\);[^}]*height:\s*var\(--dh-scrollbar-size\);/s)
  assert.match(theme, /::\-webkit-scrollbar-track\s*\{[^}]*background:\s*var\(--dh-scrollbar-track\);/s)
  assert.match(theme, /::\-webkit-scrollbar-thumb\s*\{[^}]*background:\s*var\(--dh-scrollbar-thumb\);/s)
  assert.match(theme, /::\-webkit-scrollbar-thumb:hover\s*\{[^}]*background:\s*var\(--dh-scrollbar-thumb-hover\);/s)
  assert.match(theme, /::\-webkit-scrollbar-thumb:active\s*\{[^}]*background:\s*var\(--dh-scrollbar-thumb-active\);/s)
})

test('FASE 56 has dedicated light and dark scrollbar tokens', async () => {
  const theme = await readFile(themeUrl, 'utf8')
  const root = theme.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  const dark = theme.match(/\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(root, /--dh-scrollbar-track:/)
  assert.match(root, /--dh-scrollbar-thumb:/)
  assert.match(root, /--dh-scrollbar-thumb-hover:/)
  assert.match(root, /--dh-scrollbar-thumb-active:/)

  assert.match(dark, /--dh-scrollbar-track:/)
  assert.match(dark, /--dh-scrollbar-thumb:/)
  assert.match(dark, /--dh-scrollbar-thumb-hover:/)
  assert.match(dark, /--dh-scrollbar-thumb-active:/)
})

test('FASE 56 keeps the scrollbar easy to grab without making it visually heavy', async () => {
  const theme = await readFile(themeUrl, 'utf8')

  assert.match(theme, /--dh-scrollbar-size:\s*10px;/)
  assert.match(theme, /::\-webkit-scrollbar-thumb\s*\{[^}]*min-width:\s*36px;[^}]*min-height:\s*36px;[^}]*border:\s*2px solid transparent;[^}]*background-clip:\s*padding-box;/s)
})

test('FASE 56 does not create Marketing-specific scrollbar visuals', async () => {
  const files = await collectSourceFiles(marketingDir)
  const sources = await Promise.all(files.map(async (file) => ({ file, source: await readFile(file, 'utf8') })))

  for (const { file, source } of sources) {
    assert.doesNotMatch(
      source,
      /::\-webkit-scrollbar|scrollbar-(?:color|width)\s*:/,
      `${file} must inherit the standard Dhole scrollbar instead of defining its own visual style`,
    )
  }
})
