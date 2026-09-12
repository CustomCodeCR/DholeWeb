import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isAllowedMarketingFile,
  mediaContentTypeFilter,
  mediaKind,
  parseMarketingMediaMetadata,
} from '../src/core/media/mediaLibrary.ts'

test('classifies supported marketing media', () => {
  assert.equal(mediaKind('image/png', 'hero.png'), 'image')
  assert.equal(mediaKind('video/mp4', 'spot.mp4'), 'video')
  assert.equal(mediaKind('application/pdf', 'brochure.pdf'), 'pdf')
  assert.equal(mediaKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'brief.docx'), 'document')
})

test('builds server filters for image video and pdf', () => {
  assert.equal(mediaContentTypeFilter('image'), 'image/')
  assert.equal(mediaContentTypeFilter('video'), 'video/')
  assert.equal(mediaContentTypeFilter('pdf'), 'application/pdf')
  assert.equal(mediaContentTypeFilter('document'), undefined)
  assert.equal(mediaContentTypeFilter('all'), undefined)
})

test('accepts only the formats enabled by marketing storage', () => {
  assert.equal(isAllowedMarketingFile({ name: 'hero.webp', type: 'image/webp' }), true)
  assert.equal(isAllowedMarketingFile({ name: 'campaign.mov', type: 'video/quicktime' }), true)
  assert.equal(isAllowedMarketingFile({ name: 'proposal.pptx' }), true)
  assert.equal(isAllowedMarketingFile({ name: 'payload.exe' }), false)
  assert.equal(isAllowedMarketingFile({ name: 'archive.zip' }), false)
})

test('reads metadata returned by marketing storage', () => {
  const parsed = parseMarketingMediaMetadata(JSON.stringify({
    category: 'Image',
    format: 'png',
    width: 1920,
    height: 1080,
    durationSeconds: null,
    variants: [{ key: 'thumbnail', fileName: 'thumbnail.webp' }],
  }))

  assert.equal(parsed?.category, 'Image')
  assert.equal(parsed?.width, 1920)
  assert.equal(parsed?.height, 1080)
  assert.equal(parsed?.variants?.[0]?.key, 'thumbnail')
})
