export function normalizePublicPath(value: string): string {
  let path = value.trim().replaceAll('\\', '/')
  if (!path) return '/'
  if (!path.startsWith('/')) path = `/${path}`
  while (path.includes('//')) path = path.replaceAll('//', '/')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  return path.toLowerCase()
}

export function shouldCreatePermanentRedirect(previousPath: string, nextPath: string): boolean {
  if (!previousPath.trim() || !nextPath.trim()) return false
  return normalizePublicPath(previousPath) !== normalizePublicPath(nextPath)
}
