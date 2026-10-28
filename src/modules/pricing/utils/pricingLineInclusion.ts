/**
 * Insurance is a shipment-wide service, not an EXW pickup charge. When explicitly
 * included, it must appear in the editable breakdown AND in the saved totals,
 * even for historical quote details without a catalog CostId (manual=true).
 */
export function shouldIncludePricedLine(
  line: Readonly<{ included: boolean; costDetailType: string }>,
  pickupCargoConditionsMatch: boolean,
): boolean {
  return Boolean(line.included)
    && (line.costDetailType === 'Insurance' || pickupCargoConditionsMatch)
}
