import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  limitWorkspaceTabs,
  MAX_WORKSPACE_TABS,
  visibleWorkspaceTabKeys,
  workspaceTabKey,
} from '../src/core/stores/workspaceTabPolicy.ts'

test('filters, hashes and wizard query parameters reuse the same tab', () => {
  assert.equal(workspaceTabKey('/pricing/rates?page=2&seller=123'), '/pricing/rates')
  assert.equal(workspaceTabKey('/pricing/rates?page=3'), '/pricing/rates')
  assert.equal(workspaceTabKey('/pricing/rates/id-1/wizard?step=7'), '/pricing/rates/id-1/wizard')
  assert.notEqual(workspaceTabKey('/pricing/rates/id-2/wizard'), workspaceTabKey('/pricing/rates/id-1/wizard'))
  assert.equal(workspaceTabKey('/home#summary'), '/home')
  assert.equal(workspaceTabKey('/pricing/'), '/pricing')
})

test('workspace has a hard bound while protecting dashboard, active and split tabs', () => {
  const tabs = [
    { key: '/home', closable: false },
    ...Array.from({ length: 20 }, (_, i) => ({ key: `/pricing/rates/${i}`, closable: true })),
  ]
  const bounded = limitWorkspaceTabs(tabs, '/pricing/rates/0', '/pricing/rates/1')
  assert.equal(bounded.length, MAX_WORKSPACE_TABS)
  assert.ok(bounded.some((tab) => tab.key === '/home'))
  assert.ok(bounded.some((tab) => tab.key === '/pricing/rates/0'))
  assert.ok(bounded.some((tab) => tab.key === '/pricing/rates/1'))
  assert.equal(bounded.some((tab) => tab.key === '/pricing/rates/2'), false)
})

test('compact strip always shows active tab and Dashboard', () => {
  const tabs = [
    { key: '/home', closable: false },
    ...Array.from({ length: 10 }, (_, i) => ({ key: `/module/${i}`, closable: true })),
  ]
  const visible = visibleWorkspaceTabKeys(tabs, '/module/1')
  assert.ok(visible.has('/home'))
  assert.ok(visible.has('/module/1'))
  assert.ok(visible.size <= 5)
  assert.equal(visible.has('/module/0'), false)
})
