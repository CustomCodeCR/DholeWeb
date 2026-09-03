from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new)

# 1) TypeScript contract
p = Path('src/core/interfaces/pricing.ts')
text = p.read_text(encoding='utf-8')
text = replace_once(
    text,
    "export type ImportStatus = 'Pending' | 'Approved' | 'Rejected' | 'Created' | 'Expired'",
    "export type ImportStatus = 'Pending' | 'PreAuthorized' | 'Approved' | 'Rejected' | 'Created' | 'Expired'",
    'ImportStatus union',
)
p.write_text(text, encoding='utf-8')

# 2) Review queue: show/preapprove auto-preauthorized rates
p = Path('src/modules/pricing/views/PricingImportsView.vue')
text = p.read_text(encoding='utf-8')
text = replace_once(
    text,
    "type QueueStatus = '' | 'Pending' | 'Approved' | 'Rejected' | 'Created'",
    "type QueueStatus = '' | 'Pending' | 'PreAuthorized' | 'Approved' | 'Rejected' | 'Created'",
    'QueueStatus',
)
text = replace_once(
    text,
    "  status: 'Pending' as QueueStatus,",
    "  status: 'PreAuthorized' as QueueStatus,",
    'default queue status',
)
text = replace_once(
    text,
    "  { label: 'Pendientes', value: 'Pending' },\n  { label: 'Aprobadas', value: 'Approved' },",
    "  { label: 'Pendientes manuales', value: 'Pending' },\n  { label: 'Preautorizadas', value: 'PreAuthorized' },\n  { label: 'Preaprobadas', value: 'Approved' },",
    'status options',
)
text = replace_once(
    text,
    ".filter((row) => row.status === 'Pending' && selectedIds.value.includes(row.id))",
    ".filter((row) => ['Pending', 'PreAuthorized'].includes(row.status) && selectedIds.value.includes(row.id))",
    'selected approvable rows',
)
text = replace_once(
    text,
    "    Pending: 'Pendiente',\n    Approved: 'Aprobada',",
    "    Pending: 'Pendiente manual',\n    PreAuthorized: 'Preautorizada',\n    Approved: 'Preaprobada',",
    'status labels',
)
text = replace_once(
    text,
    "  if (value === 'Approved' || value === 'Created') return 'success'\n  if (value === 'Pending') return 'warning'",
    "  if (value === 'Approved' || value === 'Created') return 'success'\n  if (value === 'PreAuthorized') return 'warning'\n  if (value === 'Pending') return 'warning'",
    'status variants',
)
text = replace_once(
    text,
    "  filters.status = 'Pending'",
    "  filters.status = 'PreAuthorized'",
    'clear filters status',
)
text = text.replace(
    "row.status === 'Pending'",
    "['Pending', 'PreAuthorized'].includes(row.status)",
)
text = text.replace(
    "tarifa${pending.length === 1 ? '' : 's'} aprobada${pending.length === 1 ? '' : 's'}",
    "tarifa${pending.length === 1 ? '' : 's'} preaprobada${pending.length === 1 ? '' : 's'}",
)
text = text.replace(
    "No se pudieron aprobar las tarifas.",
    "No se pudieron preaprobar las tarifas.",
)
text = text.replace(
    "title: 'Rechazar tarifas',",
    "title: 'Rechazar tarifas preautorizadas',",
)
text = text.replace(
    "filters.status = 'Pending'",
    "filters.status = 'PreAuthorized'",
)
p.write_text(text, encoding='utf-8')

# 3) Review drawer wording and local optimistic status
p = Path('src/modules/pricing/components/PricingImportReviewDrawer.vue')
text = p.read_text(encoding='utf-8')
text = text.replace(
    "Todos los datos obligatorios están listos para guardar y aprobar.",
    "Todos los datos obligatorios están listos para guardar y preaprobar.",
)
text = text.replace(
    "La tarifa está lista para guardarse y aprobarse.",
    "La tarifa está lista para guardarse y preaprobarse.",
)
text = text.replace(
    "antes de aprobar.",
    "antes de preaprobar.",
)
text = text.replace(
    "label=\"Guardar y aprobar\"",
    "label=\"Guardar y preaprobar\"",
)
text = text.replace(
    "La tarifa fue corregida y aprobada correctamente.",
    "La tarifa fue corregida y preaprobada correctamente.",
)
p.write_text(text, encoding='utf-8')

print('Completed Sep 03 import preapproval frontend patch')
