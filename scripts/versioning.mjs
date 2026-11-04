import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { bumpVersion, parseVersion } from './semver.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const packagePath = join(root, 'package.json')
const lockPath = join(root, 'package-lock.json')
const changelogPath = join(root, 'CHANGELOG.md')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function checkConsistency() {
  const pkg = readJson(packagePath)
  const lock = readJson(lockPath)
  parseVersion(pkg.version)

  if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) {
    throw new Error('package.json and package-lock.json versions differ.')
  }

  const changelog = readFileSync(changelogPath, 'utf8')
  if (!changelog.includes(`## [${pkg.version}]`)) {
    throw new Error(`CHANGELOG.md is missing release ${pkg.version}.`)
  }

  return { pkg, lock, changelog }
}

function bump(level, notes) {
  if (!notes?.trim()) throw new Error('A release note is required: bump major|minor|patch "Description".')
  const { pkg, lock, changelog } = checkConsistency()
  const next = bumpVersion(pkg.version, level)
  const date = new Date().toISOString().slice(0, 10)
  pkg.version = next
  lock.version = next
  lock.packages[''].version = next

  const entry = `## [${next}] - ${date}\n\n- ${notes.trim().replaceAll('\n', ' ')}\n\n`
  const marker = '# Changelog\n\n'
  if (!changelog.startsWith(marker)) throw new Error('CHANGELOG.md has an unexpected format.')
  const updatedChangelog = marker + entry + changelog.slice(marker.length)

  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n')
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
  writeFileSync(changelogPath, updatedChangelog)
  console.log(`Dhole Web ${next} (${level}). Commit package.json, package-lock.json and CHANGELOG.md together.`)
}

try {
  const [, , command, level, ...details] = process.argv
  if (command === 'check') {
    const { pkg } = checkConsistency()
    console.log(`Dhole Web ${pkg.version}: semantic version and release notes are consistent.`)
  } else if (command === 'bump') {
    bump(level, details.join(' '))
  } else {
    throw new Error('Usage: node scripts/versioning.mjs check | bump major|minor|patch "Release notes"')
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
