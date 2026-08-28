from pathlib import Path

path = Path('src/modules/pricing/views/PricingRatesView.vue')
text = path.read_text()

marker = "const route = useRoute()\n"
insert = """type CommercialRateStatus = 'Open' | 'Sent' | 'Expired' | 'AcceptedByClient' | 'RejectedByClient'

const commercialStatuses = new Set<CommercialRateStatus>([
  'Open',
  'Sent',
  'Expired',
  'AcceptedByClient',
  'RejectedByClient',
])

function normalizeCommercialStatus(value: unknown): CommercialRateStatus {
  const status = typeof value === 'string' ? value : ''
  if (commercialStatuses.has(status as CommercialRateStatus)) return status as CommercialRateStatus
  if (status === 'RejectedByClient' || status === 'Closed') return 'RejectedByClient'
  if (status === 'Sent') return 'Sent'
  if (status === 'Expired') return 'Expired'
  if (status === 'AcceptedByClient') return 'AcceptedByClient'
  return 'Open'
}

"""
if insert.strip() not in text:
    if marker not in text:
        raise SystemExit('Route marker not found')
    text = text.replace(marker, insert + marker, 1)

old = "  status: (typeof route.query.status === 'string' ? route.query.status : '') as RateStatus | '',"
new = "  status: normalizeCommercialStatus(route.query.status),"
if old not in text:
    raise SystemExit('Initial status pattern not found')
text = text.replace(old, new, 1)

old = """const statusOptions = [
  { label: 'Todos', value: '' },
  { label: 'Abiertas', value: 'Open' },
  { label: 'Enviadas', value: 'Sent' },
  { label: 'Vencidas', value: 'Expired' },
  { label: 'Aceptadas', value: 'AcceptedByClient' },
  { label: 'No aceptadas', value: 'RejectedByClient' },
]

const quickStatusOptions: Array<{ label: string; value: RateStatus | '' }> = [
  { label: 'Todas', value: '' },
  { label: 'Abiertas', value: 'Open' },
  { label: 'Enviadas', value: 'Sent' },
  { label: 'Vencidas', value: 'Expired' },
  { label: 'Aceptadas', value: 'AcceptedByClient' },
  { label: 'No aceptadas', value: 'RejectedByClient' },
]"""
new = """const statusOptions: Array<{ label: string; value: CommercialRateStatus }> = [
  { label: 'Abiertas', value: 'Open' },
  { label: 'Enviadas', value: 'Sent' },
  { label: 'Vencidas', value: 'Expired' },
  { label: 'Aceptadas', value: 'AcceptedByClient' },
  { label: 'No aceptadas', value: 'RejectedByClient' },
]

const quickStatusOptions = statusOptions"""
if old not in text:
    raise SystemExit('Status options pattern not found')
text = text.replace(old, new, 1)

old = "Object.entries(filters).filter(([key, value]) => key !== 'search' && String(value || '').trim())"
new = "Object.entries(filters).filter(([key, value]) => !['search', 'status'].includes(key) && String(value || '').trim())"
if old not in text:
    raise SystemExit('Active filters pattern not found')
text = text.replace(old, new, 1)

old = "function applyQuickStatus(status: RateStatus | '') {"
new = "function applyQuickStatus(status: CommercialRateStatus) {"
if old not in text:
    raise SystemExit('Quick status function pattern not found')
text = text.replace(old, new, 1)

old = "    status: '',\n      agentId: '',"
new = "    status: 'Open',\n    agentId: '',"
if old not in text:
    raise SystemExit('Clear filters status pattern not found')
text = text.replace(old, new, 1)

text = text.replace('          Vista rápida\n', '          Categorías\n', 1)
text = text.replace(":key=\"option.value || 'all'\"", ':key="option.value"', 1)

for label in ('Abiertas', 'Enviadas', 'Vencidas', 'Aceptadas', 'No aceptadas'):
    if f"label: '{label}'" not in text:
        raise SystemExit(f'Missing commercial category: {label}')

path.write_text(text)
