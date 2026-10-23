import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveNotificationDestination, safeNotificationRoute } from '../src/core/utils/notificationNavigation.ts'
import type { NotificationInboxItemDto } from '../src/core/interfaces/notifications'

const ORIGIN = 'https://sistema.logisticacastrofallas.com'
function notification(overrides: Partial<NotificationInboxItemDto> = {}): NotificationInboxItemDto {
  return {
    recipientId: 'recipient', notificationId: 'notification', notificationType: 'unknown',
    subject: null, body: null, payloadJson: '{}', entityType: null, entityId: null,
    createdAtUtc: '2026-10-23T15:00:00Z', readAtUtc: null,
    ...overrides,
  }
}

test('preauthorized import notification opens its own batch instead of the generic queue', () => {
  const item = notification({
    notificationType: 'pricing.imported-rate.approval-required',
    entityType: 'ImportFclRate',
    payloadJson: JSON.stringify({
      type: 'pricing.imported-rate.approval-required',
      ImportBatchId: '8a8d25af-9446-452d-9b21-72edcc104e7f',
      route: '/pricing/imports',
    }),
  })
  assert.equal(
    resolveNotificationDestination(item, ORIGIN),
    '/pricing/imports?importBatchId=8a8d25af-9446-452d-9b21-72edcc104e7f',
  )
})

test('explicit internal route is preferred over entity fallback', () => {
  const item = notification({
    notificationType: 'pricing.rate.sent-to-seller', entityType: 'RateHeader',
    entityId: 'a1b2c3', payloadJson: '{"route":"/pricing/seller-rates/a1b2c3"}',
  })
  assert.equal(resolveNotificationDestination(item, ORIGIN), '/pricing/seller-rates/a1b2c3')
})

test('same-origin absolute URL remains inside the app', () => {
  assert.equal(safeNotificationRoute(`${ORIGIN}/pricing/rates/42/wizard?mode=view`, ORIGIN), '/pricing/rates/42/wizard?mode=view')
  assert.equal(safeNotificationRoute('https://other.example/pricing/rates', ORIGIN), null)
  assert.equal(safeNotificationRoute('//other.example/path', ORIGIN), null)
  assert.equal(safeNotificationRoute('/\\\\evil.example', ORIGIN), null)
  assert.equal(safeNotificationRoute('javascript:alert(1)', ORIGIN), null)
})

test('falls back to supported entity destinations with identifiers', () => {
  assert.equal(resolveNotificationDestination(notification({ entityType: 'RateHeader', entityId: 'abc-123' }), ORIGIN), '/pricing/rates/abc-123/wizard?mode=view')
  assert.equal(resolveNotificationDestination(notification({ entityType: 'ImportFclRate' }), ORIGIN), '/pricing/imports')
  assert.equal(resolveNotificationDestination(notification({ entityType: 'RateRequest', entityId: 'request-1' }), ORIGIN), '/pricing/rate-requests/request-1/wizard')
  assert.equal(resolveNotificationDestination(notification({
    notificationType: 'pricing.imported-rate.lower-complete-rate',
    payloadJson: '{"comparisonId":"compare-1"}',
  }), ORIGIN), '/pricing/rate-comparisons/compare-1')
})

test('malformed, unrelated or malicious payloads never force navigation', () => {
  assert.equal(resolveNotificationDestination(notification({ payloadJson: '{invalid' }), ORIGIN), null)
  assert.equal(resolveNotificationDestination(notification({ payloadJson: '{"route":"https://evil.example/steal"}' }), ORIGIN), null)
  assert.equal(resolveNotificationDestination(notification({ entityType: 'RateHeader', entityId: '../../foo' }), ORIGIN), null)
})
