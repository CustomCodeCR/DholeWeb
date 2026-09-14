import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { formatMediaFileSize, mediaSizeInBytes } from '../src/core/media/mediaLibrary.ts'

test('FASE 48 renders the media library as a gallery with the four requested filters', async () => {
  const source = await readFile(new URL('../src/modules/marketing/components/MarketingMediaTab.vue', import.meta.url), 'utf8')

  assert.match(source, /media-gallery/)
  assert.match(source, /MarketingMediaThumbnail/)
  assert.match(source, /Todos/)
  assert.match(source, /Imágenes/)
  assert.match(source, /Videos/)
  assert.match(source, /Documentos/)
  assert.doesNotMatch(source, /<option value="pdf">/)
})

test('FASE 48 searches locally by file name, ALT and creation date', async () => {
  const source = await readFile(new URL('../src/modules/marketing/components/MarketingMediaTab.vue', import.meta.url), 'utf8')

  assert.match(source, /item\.fileName/)
  assert.match(source, /item\.altText/)
  assert.match(source, /searchableDate\(item\.createdAtUtc\)/)
  assert.match(source, /Buscar por nombre, ALT o fecha/)
  assert.match(source, /ContentService\.browseMedia\(\{ pageNumber: 1, pageSize: 300 \}\)/)
})

test('FASE 48 gallery cards expose thumbnail, human type, file size and date', async () => {
  const source = await readFile(new URL('../src/modules/marketing/components/MarketingMediaTab.vue', import.meta.url), 'utf8')
  const thumbnail = await readFile(new URL('../src/modules/marketing/components/MarketingMediaThumbnail.vue', import.meta.url), 'utf8')

  assert.match(source, /MarketingMediaThumbnail/)
  assert.match(source, /readableType\(item\)/)
  assert.match(source, /fileSize\(item\)/)
  assert.match(source, /formatDate\(item\.createdAtUtc\)/)
  assert.match(thumbnail, /IntersectionObserver/)
  assert.match(thumbnail, /downloadFile/)
})

test('FASE 48 reads and formats file size from stored Storage metadata', () => {
  const storageMetadata = JSON.stringify({ file: { sizeInBytes: 1536 } })
  assert.equal(mediaSizeInBytes(storageMetadata), 1536)
  assert.equal(formatMediaFileSize(1536), '1.5 KB')

  const nestedMetadata = JSON.stringify({ file: { metadataJson: JSON.stringify({ sizeInBytes: 2 * 1024 * 1024 }) } })
  assert.equal(mediaSizeInBytes(nestedMetadata), 2 * 1024 * 1024)
  assert.equal(formatMediaFileSize(2 * 1024 * 1024), '2 MB')
})

test('FASE 48 keeps FASE 49 focal point and file replacement out of scope', async () => {
  const source = await readFile(new URL('../src/modules/marketing/components/MarketingMediaTab.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /focal/i)
  assert.doesNotMatch(source, /reemplazar archivo/i)
  assert.doesNotMatch(source, /window\.confirm/)
  assert.match(source, /DhConfirmDialog/)
})
