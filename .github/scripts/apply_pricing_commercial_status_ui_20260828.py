from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Anchor not found: {label}')
    return text.replace(old, new, 1)


# Keep existing backend states for compatibility, but expose only the five requested categories.
p = Path('src/modules/pricing/views/PricingRatesView.vue')
s = p.read_text(encoding='utf-8')
start = s.index('const statusOptions = [')
end = s.index('const approvalOptions = [', start)
s = s[:start] + '''const statusOptions = [
  { label: 'Todos', value: '' },
  { label: 'Abiertas', value: 'Open' },
  { label: 'Enviadas', value: 'Sent' },
  { label: 'Vencidas', value: 'Expired' },
  { label: 'Aceptadas', value: 'AcceptedByClient' },
  { label: 'No aceptadas', value: 'RejectedByClient' },
]
''' + s[end:]
start = s.index('const quickStatusOptions:')
end = s.index('const activeFiltersCount', start)
s = s[:start] + '''const quickStatusOptions: Array<{ label: string; value: RateStatus | '' }> = [
  { label: 'Todas', value: '' },
  { label: 'Abiertas', value: 'Open' },
  { label: 'Enviadas', value: 'Sent' },
  { label: 'Vencidas', value: 'Expired' },
  { label: 'Aceptadas', value: 'AcceptedByClient' },
  { label: 'No aceptadas', value: 'RejectedByClient' },
]

''' + s[end:]
old = '''        Open: 'Abierta',
        PendingApproval: 'Pendiente',
        ApprovedByManagement: 'Aprobada por gerencia',
        RejectedByManagement: 'Rechazada por gerencia',
        Sent: 'Enviada',
        RequestedByClient: 'Solicitada por el cliente',
        AcceptedByClient: 'Aceptada por el cliente',
        RejectedByClient: 'Rechazada por el cliente',
        Closed: 'Cerrada',
        Expired: 'Vencida','''
new = '''        Open: 'Abierta',
        PendingApproval: 'Abierta',
        ApprovedByManagement: 'Abierta',
        RejectedByManagement: 'Abierta',
        Sent: 'Enviada',
        RequestedByClient: 'Abierta',
        AcceptedByClient: 'Aceptada',
        RejectedByClient: 'No aceptada',
        Closed: 'No aceptada',
        Expired: 'Vencida','''
s = replace_once(s, old, new, 'rates status labels')
p.write_text(s, encoding='utf-8')

# Reuse the existing reason modal for a required client rejection reason.
p = Path('src/modules/pricing/components/PricingReasonModal.vue')
s = p.read_text(encoding='utf-8')
s = replace_once(s, "  target: 'import' | 'margin'", "  target: 'import' | 'margin' | 'client'", 'reason target')
s = replace_once(s, '''    } else if (props.id) {
      await PricingService.rejectRateMargin(props.id, { reason: form.reason.trim() })
    } else {''', '''    } else if (props.target === 'client' && props.id) {
      await PricingService.setRateStatus(props.id, { status: 'RejectedByClient', reason: form.reason.trim() })
    } else if (props.id) {
      await PricingService.rejectRateMargin(props.id, { reason: form.reason.trim() })
    } else {''', 'client reject submit')
s = replace_once(s, '''        : 'Margen rechazado',''', '''        : props.target === 'client'
          ? 'Tarifa no aceptada por el cliente'
          : 'Margen rechazado',''', 'client reject toast')
p.write_text(s, encoding='utf-8')

p = Path('src/modules/pricing/components/PricingRateDetailDrawer.vue')
s = p.read_text(encoding='utf-8')
old = '''        PendingApproval: 'Pendiente de autorización',
        ApprovedByManagement: 'Aprobada por gerencia',
        RejectedByManagement: 'Rechazada por gerencia',
        Open: 'Abierta',
        Sent: 'Enviada',
        RequestedByClient: 'Solicitada por el cliente',
        AcceptedByClient: 'Aceptada por el cliente',
        RejectedByClient: 'Rechazada por el cliente',
        Closed: 'Cerrada',
        Expired: 'Vencida','''
new = '''        PendingApproval: 'Abierta',
        ApprovedByManagement: 'Abierta',
        RejectedByManagement: 'Abierta',
        Open: 'Abierta',
        Sent: 'Enviada',
        RequestedByClient: 'Abierta',
        AcceptedByClient: 'Aceptada',
        RejectedByClient: 'No aceptada',
        Closed: 'No aceptada',
        Expired: 'Vencida','''
s = replace_once(s, old, new, 'detail status labels')
s = replace_once(s, '''async function setCommercialStatus(status: SetRateStatusRequest['status']) {
  try {
    await PricingService.setRateStatus(current.value.id, { status })''', '''function rejectByClient() {
  modalStore.open({
    title: 'Registrar no aceptación del cliente',
    component: PricingReasonModal,
    props: {
      target: 'client',
      id: current.value.id,
      onSaved: async () => {
        await reload()
        await props.onSaved?.()
      },
    },
  })
}

async function setCommercialStatus(status: SetRateStatusRequest['status']) {
  if (status === 'AcceptedByClient' && !current.value.idtraNumber?.trim()) {
    toastStore.warning('IDTRA requerido', 'Registre el IDTRA en Editar antes de marcar la tarifa como Aceptada.')
    edit()
    return
  }
  try {
    await PricingService.setRateStatus(current.value.id, { status })''', 'decision functions')
s = replace_once(s, '''            @click="setCommercialStatus('RejectedByClient')"''', '''            @click="rejectByClient"''', 'reject button')
p.write_text(s, encoding='utf-8')
