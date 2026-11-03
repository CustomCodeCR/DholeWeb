/**
 * Display labels for enums stored as numeric values in immutable Pricing
 * revision snapshots. Values follow Dhole.Pricing.Domain.Costs.Enums.
 * Revisions may also contain enum names (newer serializers).
 */
type EnumLabels = Readonly<Record<string, readonly [name: string, label: string]>>

function historicalLabel(value: unknown, labels: EnumLabels): string {
  const raw = typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
  if (!raw) return '—'

  const direct = labels[raw]
  if (direct) return direct[1]

  const named = Object.values(labels).find(([name]) => name.toLowerCase() === raw.toLowerCase())
  // Preserve unexpected historical values rather than assigning a wrong label.
  return named?.[1] ?? raw
}

// src/Dhole.Pricing.Domain/Costs/Enums/ChargeBasis.cs
const chargeBases: EnumLabels = {
  0: ['PerShipment', 'Por embarque'],
  1: ['PerContainer', 'Por contenedor'],
  2: ['PerTruck', 'Por camión'],
  3: ['PerTeu', 'Por TEU'],
  4: ['PerPickup', 'Por recolecta'],
  10: ['PerCbm', 'Por CBM'],
  11: ['PerChargeableCbm', 'Por CBM cobrable'],
  12: ['PerCft', 'Por CFT'],
  13: ['PerChargeableCft', 'Por CFT cobrable'],
  20: ['PerKg', 'Por kg'],
  21: ['Per100Kg', 'Por 100 kg'],
  22: ['PerTon', 'Por tonelada'],
  23: ['PerLb', 'Por lb'],
  30: ['PerPallet', 'Por pallet'],
  31: ['PerPackage', 'Por bulto'],
  40: ['PerDocument', 'Por documento'],
  50: ['PerService', 'Por servicio'],
}

// src/Dhole.Pricing.Domain/Costs/Enums/CostDetailType.cs
const costDetailTypes: EnumLabels = {
  0: ['Other', 'Otro'],
  1: ['Freight', 'Flete internacional'],
  2: ['OriginCharge', 'Cargo en origen'],
  3: ['DestinationCharge', 'Cargo en destino'],
  4: ['PortCharge', 'Cargo portuario'],
  5: ['CustomsCharge', 'Aduana'],
  6: ['InlandTransport', 'Transporte interno'],
  7: ['AgentCharge', 'Costo de agente'],
  8: ['Documentation', 'Documentación'],
  9: ['Insurance', 'Seguro'],
}

// src/Dhole.Pricing.Domain/Costs/Enums/CostType.cs
const costTypes: EnumLabels = {
  0: ['Optional', 'Opcional'],
  1: ['Fixed', 'Fijo'],
  2: ['Variable', 'Variable'],
}

export const historicalChargeBasisLabel = (value: unknown): string => historicalLabel(value, chargeBases)
export const historicalCostDetailTypeLabel = (value: unknown): string => historicalLabel(value, costDetailTypes)
export const historicalCostTypeLabel = (value: unknown): string => historicalLabel(value, costTypes)
