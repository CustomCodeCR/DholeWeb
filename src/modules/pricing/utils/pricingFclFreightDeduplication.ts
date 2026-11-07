/**
 * FCL mixed-container tariffs already contain freight per selected equipment.
 * A second generic Screen 6 freight must not be billed or persisted.
 * Do not collapse legitimate distinct freight rows for different equipment.
 */
export function removeDuplicateFclFreight<T extends {
  key: string
  name: string
  costDetailType: string
  included: boolean
}>(lines: readonly T[], shipmentMode: string): T[] {
  if (shipmentMode.toLowerCase() !== 'fcl') return [...lines]
  const specificFreight = lines.some((line) =>
    line.included && line.costDetailType === 'Freight'
    && (line.key.startsWith('freight:')
      || /flete\s+internacional\s*[-–]\s*\d+\s*(?:pies|ft|hc|high cube|reefer|open top)/i.test(line.name)),
  )
  if (!specificFreight) return [...lines]
  return lines.filter((line) =>
    !(line.included && line.costDetailType === 'Freight' && line.key === 'freight'),
  )
}
