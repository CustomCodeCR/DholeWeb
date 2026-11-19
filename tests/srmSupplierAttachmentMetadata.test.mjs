import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync(new URL('../src/modules/srm/components/SrmSupplierFilesPanel.vue', import.meta.url), 'utf8')

test('supplier attachments display legacy and corrected Storage metadata', () => {
  assert.match(panel, /file\.metadataJson \?\? file\.metadatJson/)
  assert.match(panel, /JSON\.parse\(raw\)/)
  assert.match(panel, /description: typeof data\.description/)
  assert.match(panel, /validFrom: typeof data\.validFrom/)
  assert.match(panel, /validTo: typeof data\.validTo/)
})

test('supplier attachments show description and both tariff validity dates beside each document', () => {
  assert.match(panel, /Descripción:/)
  assert.match(panel, /Sin descripción/)
  assert.match(panel, /Válida desde:/)
  assert.match(panel, /Válida hasta:/)
  assert.match(panel, /formatMetadataDate\(detail\(file\)\?\.validFrom\)/)
  assert.match(panel, /formatMetadataDate\(detail\(file\)\?\.validTo\)/)
  assert.match(panel, /new Date\(file\.createdAt\)/)
})

test('new uploads continue storing each supplied metadata field', () => {
  assert.match(panel, /metadataJson: JSON\.stringify/)
  assert.match(panel, /description: description\.value\.trim/)
  assert.match(panel, /validFrom: isTariff\.value \? validFrom\.value/)
  assert.match(panel, /validTo: isTariff\.value \? validTo\.value/)
})
