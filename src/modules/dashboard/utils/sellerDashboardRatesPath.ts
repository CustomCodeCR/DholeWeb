/**
 * La misma proyección comercial autorizada para vendedor y supervisión.
 * El filtro nunca se aplica al endpoint personal ni modifica la identidad.
 */
export function sellerDashboardRatesPath(adminPreview: boolean, sellerUserId?: string | null): string {
  if (!adminPreview) return '/api/pricing/seller-rates'
  const base = '/api/pricing/seller-rates/dashboard'
  return sellerUserId ? `${base}?sellerUserId=${encodeURIComponent(sellerUserId)}` : base
}
