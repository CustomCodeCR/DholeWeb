import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

const sourceRoot = new URL('../src/', import.meta.url)
let removed = 0

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      await walk(path)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.js')) continue

    const typescriptSource = path.slice(0, -3) + '.ts'
    const vueSource = path.slice(0, -3)

    if (await exists(typescriptSource) || (entry.name.endsWith('.vue.js') && await exists(vueSource))) {
      await rm(path)
      removed += 1
    }
  }
}

await walk(sourceRoot.pathname)

if (removed > 0) {
  console.log(`Removed ${removed} generated JavaScript file(s) from src/.`)
}
