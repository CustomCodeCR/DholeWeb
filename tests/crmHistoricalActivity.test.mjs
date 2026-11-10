import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const view = readFileSync(new URL('../src/modules/crm/components/CrmSalesCalendar.vue', import.meta.url), 'utf8')

test('backdated activities are not automatically moved forward', () => {
  assert.match(view, /data\.type === 'FOLLOWUP' && !userEditedStart\.value/)
  assert.match(view, /data\.type === 'FOLLOWUP' && start\.getTime\(\) < Date\.now\(\) - 60000/)
  assert.match(view, /data\.type !== 'FOLLOWUP' && \(!Number\.isFinite\(end\.getTime\(\)\) \|\| end <= start\)/)
})

test('completed historical activity sends original end as occurredAt', () => {
  assert.match(view, /const historicalActivity = data\.type !== 'FOLLOWUP'/)
  assert.match(view, /occurredAt: historicalActivity \? end\.toISOString\(\) : null/)
  assert.match(view, /no generar|sin avisos retroactivos/i)
})

test('past activities are explained in the form; future commitments keep validation', () => {
  assert.match(view, /historicalActivityDraft/)
  assert.match(view, /'Revisá cada acuerdo y asignale una fecha futura válida/)
  assert.match(view, /commitmentDue\.getTime\(\) <= end\.getTime\(\)/)
})
