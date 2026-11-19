import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  auditActionKey, auditCategoryKey, auditChanges,
  auditPreview, auditValue,
} from '../src/modules/operations/utils/operationsAudit.ts'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const translate = (key, args) => key + (args ? ':' + JSON.stringify(args) : '')
const audit = (actionCode, beforeJson, afterJson) => ({
  eventId: 'e', actionCode, actorUserId: 'u', beforeJson, afterJson, occurredAtUtc: '2026-11-19T10:00:00Z',
})

test('operations audit decodes catalog creation into readable title and description', () => {
  const event = audit('operations.team.catalog.created', null, JSON.stringify({
    teamId: 'internal-uuid', Name: 'Aperturas', DepartmentCode: 'APERTURAS',
  }))
  assert.equal(auditActionKey(event.actionCode), 'teamCreated')
  assert.equal(auditCategoryKey(event.actionCode), 'teams')
  assert.match(auditPreview(event, translate), /teamCreated/)
  assert.equal(auditChanges(event).some(c => c.field.toLowerCase() === 'teamid'), false)
})

test('operations audit compares values without exposing identity IDs as form fields', () => {
  const event = audit('operations.team.member.updated',
    JSON.stringify({ UserId: 'private', CapacityPoints: 5, IsAvailable: false }),
    JSON.stringify({ UserId: 'private', CapacityPoints: 10, IsAvailable: true }))
  const changes = auditChanges(event)
  assert.equal(changes.length, 2)
  assert.equal(changes.some(c => c.field === 'UserId'), false)
  assert.match(auditPreview(event, translate, () => 'Colaborador Demo'), /Colaborador Demo/)
  assert.match(auditValue(true, 'IsAvailable', translate), /operations.available/)
})

test('operations audit handles old malformed JSON and unknown actions safely', () => {
  const event = audit('legacy.unknown', '{bad-json', null)
  assert.deepEqual(auditChanges(event), [])
  assert.equal(auditActionKey(event.actionCode), 'generic')
  assert.match(auditPreview(event, translate), /generic/)
})

test('team and Aperturas screens share timeline; team directory uses buttons and mobile DhSelect', () => {
  const team = read('src/modules/operations/views/OperationsTeamsView.vue')
  const aperture = read('src/modules/operations/views/OperationsAperturesView.vue')
  const timeline = read('src/modules/operations/components/OperationsAuditTimeline.vue')
  const api = read('src/modules/operations/services/operationsApi.ts')
  const catalog = read('src/modules/operations/i18n.ts')
  assert.match(team, /<DhSelect v-model="teamSelection"/)
  assert.match(team, /operations\.eligibleRolesHint/)
  assert.match(api, /operations-audit-actors/)
  assert.match(team, /operationsApi\.saveMember/)
  assert.match(team, /v-for="team in filteredTeams"/)
  assert.match(team, /<nav v-else/)
  assert.match(team, /<details v-if="canAudit"/)
  assert.match(team, /<OperationsAuditTimeline/)
  assert.match(aperture, /<OperationsAuditTimeline/)
  assert.match(api, /operations-audit-actors/)
  assert.doesNotMatch(timeline, /\{\{ event\.actionCode \}\}<\/p>/)
  assert.match(timeline, /operations\.auditTimeline\.actions/)
  assert.match(catalog, /title: 'Operaciones'/)
  assert.match(catalog, /title: 'Operations'/)
})
