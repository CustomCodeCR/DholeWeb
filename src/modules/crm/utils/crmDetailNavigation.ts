const crmAccountIdPattern = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i

export function crmDetailReturnPath(section: string, fromAccount: unknown): string {
  if (section !== 'accounts' && typeof fromAccount === 'string' && crmAccountIdPattern.test(fromAccount)) {
    return '/crm/accounts/' + encodeURIComponent(fromAccount)
  }
  return '/crm/' + (section === 'activities' ? 'followups' : section)
}
