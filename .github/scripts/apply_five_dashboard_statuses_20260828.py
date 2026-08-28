from pathlib import Path

path = Path('src/modules/dashboard/components/PricingRoleDashboard.vue')
text = path.read_text()

old = """  return [
    { label: 'Abiertas', value: data.openCount, status: 'Open' as RateStatus, icon: FileCheck2 },
    {
      label: 'Aprobadas',
      value: data.approvedCount,
      status: 'ApprovedByManagement' as RateStatus,
      icon: BadgeCheck,
    },
    {
      label: 'Rechazadas',
      value: data.rejectedCount,
      status: null as RateStatus | null,
      icon: XCircle,
    },
    {
      label: 'Solicitadas por cliente',
      value: data.requestedByClientCount,
      status: 'RequestedByClient' as RateStatus,
      icon: Send,
    },
    { label: 'Cerradas', value: data.closedCount, status: 'Closed' as RateStatus, icon: Ban },
    { label: 'Vencidas', value: data.expiredCount, status: 'Expired' as RateStatus, icon: TimerOff },
  ]"""
new = """  return [
    { label: 'Abiertas', value: data.openCount, status: 'Open' as RateStatus, icon: FileCheck2 },
    { label: 'Enviadas', value: data.sentCount, status: 'Sent' as RateStatus, icon: Send },
    { label: 'Vencidas', value: data.expiredCount, status: 'Expired' as RateStatus, icon: TimerOff },
    { label: 'Aceptadas', value: data.acceptedByClientCount, status: 'AcceptedByClient' as RateStatus, icon: BadgeCheck },
    { label: 'No aceptadas', value: data.rejectedCount, status: 'RejectedByClient' as RateStatus, icon: XCircle },
  ]"""
if old not in text:
    raise SystemExit('Dashboard status cards pattern not found')
text = text.replace(old, new, 1)

old = """function openStatus(status: RateStatus | null) {
  if (!status) return
  router.push({ path: '/pricing/rates', query: { status } })
}

function statusLabel(status: RateStatus) {
  return (
    {
      PendingApproval: 'Pendiente de autorización',
      ApprovedByManagement: 'Aprobada por gerencia',
      RejectedByManagement: 'Rechazada por gerencia',
      Open: 'Abierta',
      Sent: 'Enviada',
      AcceptedByClient: 'Aceptada por el cliente',
      RejectedByClient: 'Rechazada por el cliente',
      RequestedByClient: 'Solicitada por el cliente',
      Closed: 'Cerrada',
      Expired: 'Vencida',
    } satisfies Record<RateStatus, string>
  )[status]
}"""
new = """function commercialStatus(status: RateStatus): RateStatus {
  if (['PendingApproval', 'ApprovedByManagement', 'RejectedByManagement', 'RequestedByClient', 'Open'].includes(status)) return 'Open'
  if (status === 'Closed' || status === 'RejectedByClient') return 'RejectedByClient'
  return status
}

function openStatus(status: RateStatus | null) {
  if (!status) return
  router.push({ path: '/pricing/rates', query: { status: commercialStatus(status) } })
}

function statusLabel(status: RateStatus) {
  return (
    {
      Open: 'Abierta',
      Sent: 'Enviada',
      Expired: 'Vencida',
      AcceptedByClient: 'Aceptada',
      RejectedByClient: 'No aceptada',
    } as Record<string, string>
  )[commercialStatus(status)] ?? 'Abierta'
}"""
if old not in text:
    raise SystemExit('Dashboard status mapping pattern not found')
text = text.replace(old, new, 1)

text = text.replace('xl:grid-cols-6', 'xl:grid-cols-5', 1)
text = text.replace('Incluye tarifas aprobadas, abiertas, enviadas, solicitadas o aceptadas; excluye rechazadas, cerradas y vencidas.', 'Incluye tarifas abiertas, enviadas y aceptadas; excluye no aceptadas y vencidas.', 1)
text = text.replace('Pendientes de autorización</p>\n              <p class="mt-2 text-3xl font-black text-yellow-600 dark:text-yellow-400">{{ dashboard.pendingApprovalCount }}</p>', 'Abiertas</p>\n              <p class="mt-2 text-3xl font-black text-yellow-600 dark:text-yellow-400">{{ dashboard.openCount }}</p>', 1)

for forbidden in ("label: 'Aprobadas'", "label: 'Rechazadas'", "label: 'Solicitadas por cliente'", "label: 'Cerradas'"):
    if forbidden in text:
        raise SystemExit(f'Legacy dashboard category remains: {forbidden}')

path.write_text(text)
