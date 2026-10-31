// Canonical service coverage codes accepted by CRM credit proposals.
export const CRM_CREDIT_COVERAGE_OPTIONS = [
  { code: 'CUSTOMS_TAXES', label: 'Impuestos Aduanas' },
  { code: 'THIRD_PARTY_PAYMENTS', label: 'Pagos a terceros' },
  { code: 'BONDED_STORAGE', label: 'Almacenaje Fiscal' },
  { code: 'CUSTOMS_BROKERAGE', label: 'Servicio Correduría Aduanera' },
  { code: 'LOCAL_TRANSPORT', label: 'Transporte Local' },
  { code: 'INTERNATIONAL_FREIGHT', label: 'Transporte Internacional de Carga' },
] as const
export function creditCoverageLabel(code: string) {
  return CRM_CREDIT_COVERAGE_OPTIONS.find(x => x.code === code)?.label ?? code
}
