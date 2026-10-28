/**
 * A carrier/naviera belongs to maritime FCL/FTL-style quotes only.
 * Terrestrial LTL/FTL use their land agent and tariff; maritime LCL
 * uses its own source/agent selector. Air never requires a naviera.
 */
export function requiresMaritimeCarrier(
  modality: string | null | undefined,
  shipmentMode: string | null | undefined,
): boolean {
  return (modality === 'Maritime' || modality === 'Multimodal') && shipmentMode !== 'Lcl'
}
