import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  limitWorkspaceTabs,
  MAX_WORKSPACE_TABS,
  visibleWorkspaceTabKeys,
  workspaceTabKey,
  workspaceTabGroup,
  reusableWorkspaceTabIndex,
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

test('related pricing/editor routes reuse a workspace slot, unrelated modules do not', () => {
  assert.equal(workspaceTabGroup('/pricing'), 'pricing-create')
  assert.equal(workspaceTabGroup('/pricing/rates/a/wizard?step=4'), 'pricing-editor')
  assert.equal(workspaceTabGroup('/pricing/rates/b/wizard'), 'pricing-editor')
  assert.notEqual(workspaceTabGroup('/pricing'), workspaceTabGroup('/pricing/rates/a/wizard'))
  assert.equal(workspaceTabGroup('/pricing/imports'), workspaceTabGroup('/pricing/imports/review/id-1'))
  assert.equal(workspaceTabGroup('/pricing/email-imports'), workspaceTabGroup('/pricing/email-source/batch-2'))
  assert.equal(workspaceTabGroup('/pricing/request-rate'), workspaceTabGroup('/pricing/seller-rates/id-3'))
  assert.notEqual(workspaceTabGroup('/pricing'), workspaceTabGroup('/pricing/imports'))
  assert.equal(workspaceTabGroup('/dynamics'), null)
})


test('CRM accounts and contacts each share a single workspace across list and details', () => {
  for (const module of ['accounts', 'contacts']) {
    const list = '/crm/' + module
    const first = list + '/11111111-1111-4111-8111-111111111111'
    const second = list + '/22222222-2222-4222-8222-222222222222'
    assert.equal(workspaceTabGroup(list), workspaceTabGroup(first))
    assert.equal(workspaceTabGroup(first), workspaceTabGroup(second + '?edit=1'))
  }
  assert.notEqual(workspaceTabGroup('/crm/accounts/a'), workspaceTabGroup('/crm/contacts/a'))
  assert.equal(workspaceTabGroup('/crm/accounts/a/change-history'), null)
  assert.equal(workspaceTabGroup('/crm/contacts/a/history'), null)
})

test('existing CRM tab is reusable even when a different module is currently active', () => {
  const tabs = [
    { path: '/home' }, { path: '/crm/accounts' },
    { path: '/pricing/rates' }, { path: '/crm/contacts/a' },
  ]
  assert.equal(reusableWorkspaceTabIndex(tabs, '/crm/accounts/b'), 1)
  assert.equal(reusableWorkspaceTabIndex(tabs, '/crm/contacts'), 3)
  assert.equal(reusableWorkspaceTabIndex(tabs, '/crm/contacts/c?edit=1'), 3)
  assert.equal(reusableWorkspaceTabIndex(tabs, '/crm/leads'), -1)
  assert.equal(reusableWorkspaceTabIndex(tabs, '/pricing/rates'), -1)
})
