import type { MaerskHealthAlertDto, MaerskMonitoringDto } from '@/core/interfaces/agent'

/**
 * Pure operator-UI safety policy. The Agent API independently authorizes and
 * validates every mutation; a hidden button is never an authorization boundary.
 */
export function visibleMaerskAlerts(
  monitoring: MaerskMonitoringDto | null | undefined,
): MaerskHealthAlertDto[] {
  if (!monitoring?.monitoringEnabled) return []
  return monitoring.alerts.filter((alert) => alert.state === 'Active')
}

export function canAcknowledgeMaerskAlert(
  hasOperatorPermission: boolean,
  monitoring: MaerskMonitoringDto | null | undefined,
  alert: MaerskHealthAlertDto | null | undefined,
): boolean {
  return Boolean(
    hasOperatorPermission &&
    monitoring?.monitoringEnabled === true &&
    alert?.state === 'Active' &&
    alert.acknowledgedAtUtc == null,
  )
}

export function canResetMaerskCircuit(
  hasOperatorPermission: boolean,
  featureEnabled: boolean | undefined,
  state: string | undefined,
): boolean {
  return hasOperatorPermission &&
    featureEnabled === true &&
    (state === 'Open' || state === 'HalfOpen')
}
