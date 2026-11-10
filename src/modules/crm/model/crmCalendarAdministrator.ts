// The server independently verifies active roles against Auth for every CRM
// calendar read. This helper is presentation/navigation only.
const calendarAdministratorRoles = [
  'Administrador', 'Administrator', 'Admin', 'SuperUsuario',
  'SuperUser', 'SuperAdmin', 'SuperAdministrador',
] as const

export function hasCrmCalendarAdministratorRole(hasRole: (role: string) => boolean): boolean {
  return calendarAdministratorRoles.some(role => hasRole(role))
}
