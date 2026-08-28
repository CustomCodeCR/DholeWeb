import type { Router } from 'vue-router'
import { AuditLogsService } from '@/core/services/auditLogsService'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function installAuditNavigation(router: Router) {
  let lastAuditKey = ''

  router.afterEach((to) => {
    if (to.name === 'login' || to.path.startsWith('/login')) return

    const pageName = resolvePageName(to.meta.tabTitle, to.name, to.path)
    const resourceId = Object.values(to.params)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map((value) => String(value ?? ''))
      .find((value) => GUID_PATTERN.test(value))
    const resourceType = typeof to.name === 'string' ? to.name : 'Screen'
    const route = to.path
    const auditKey = `${pageName}|${route}|${resourceId ?? ''}`

    if (auditKey === lastAuditKey) return
    lastAuditKey = auditKey

    void AuditLogsService.registerAccess({
      pageName,
      route,
      resourceType,
      resourceId: resourceId ?? null,
    }).catch(() => {
      // La auditoría nunca debe bloquear la navegación del usuario.
    })
  })
}

function resolvePageName(tabTitle: unknown, routeName: unknown, path: string): string {
  if (typeof tabTitle === 'string' && tabTitle.trim()) return tabTitle.trim()
  if (typeof routeName === 'string' && routeName.trim()) return humanize(routeName)
  return humanize(path.split('/').filter(Boolean).pop() || 'Dhole')
}

function humanize(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim()
}
