import type { ChargeBasis, CostSelectDto } from '@/core/interfaces/pricing'

export type PreferentialCostZone = 'origin' | 'destination' | 'transit' | 'other'
export interface PreferentialProviderGroup {
  key: string
  label: string
  agentNames: string[]
  carrierNames: string[]
  costs: CostSelectDto[]
}
export interface PreferentialCostSection {
  key: PreferentialCostZone
  label: string
  description: string
  providers: PreferentialProviderGroup[]
  count: number
}
const zoneDescriptions: Array<Pick<PreferentialCostSection,'key' | 'label' | 'description'>> = [
  { key: 'origin', label: 'Cargos en origen', description: 'Manejos y servicios en origen' },
  { key: 'destination', label: 'Cargos en destino', description: 'Manejos y servicios en destino' },
  { key: 'transit', label: 'Flete y transporte', description: 'Flete y transporte interno' },
  { key: 'other', label: 'Otros cargos', description: 'Conceptos sin ubicación de cobro explícita' },
]
const clean = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .trim().toLocaleLowerCase()
const distinct = (names: Array<string | null | undefined>) => [...new Set(names.map(s => String(s ?? '').trim()).filter(Boolean))]
  .sort((a,b)=>a.localeCompare(b,'es'))

export function preferentialCostZone(cost: CostSelectDto): PreferentialCostZone {
  if (cost.costDetailType === 'OriginCharge') return 'origin'
  if (cost.costDetailType === 'DestinationCharge') return 'destination'
  if (clean(cost.portRole) === 'pol') return 'origin'
  if (['poe','pod'].includes(clean(cost.portRole))) return 'destination'
  const name = clean(cost.name)
  if (/\b(origen|origin|salida)\b/.test(name)) return 'origin'
  if (/\b(destino|destination|llegada|arribo)\b/.test(name)) return 'destination'
  if (['Freight', 'InlandTransport'].includes(cost.costDetailType)) return 'transit'
  return 'other'
}

export function preferentialCostOwners(cost: CostSelectDto) {
  return {
    agentNames: distinct([...(cost.agents ?? []).map(x => x.name || x.code), cost.agentName]),
    carrierNames: distinct([...(cost.carriers ?? []).map(x => x.name || x.code), cost.carrierName]),
  }
}

export function groupPreferentialCosts(costs: readonly CostSelectDto[]): PreferentialCostSection[] {
  const sections = new Map<PreferentialCostZone, Map<string, PreferentialProviderGroup>>()
  for(const cost of costs) {
    const zone = preferentialCostZone(cost)
    const owners = preferentialCostOwners(cost)
    const identity = [
      owners.agentNames.map(clean).join('|') || 'none',
      owners.carrierNames.map(clean).join('|') || 'none',
    ].join('::')
    const key = zone + ':' + identity
    let providers = sections.get(zone)
    if (!providers) { providers = new Map(); sections.set(zone, providers) }
    let group = providers.get(key)
    if (!group) {
      const label = [
        owners.agentNames.length ? 'Agente: ' + owners.agentNames.join(', ') : '',
        owners.carrierNames.length ? 'Naviera: ' + owners.carrierNames.join(', ') : '',
      ].filter(Boolean).join(' · ') || 'Sin agente o naviera asignado'
      group = { key, label, ...owners, costs: [] }
      providers.set(key, group)
    }
    group.costs.push(cost)
  }
  return zoneDescriptions.flatMap(zone => {
    const providerMap = sections.get(zone.key)
    if (!providerMap) return []
    const providers = [...providerMap.values()].sort((a,b) =>
      (a.agentNames.length || a.carrierNames.length ? 0 : 1) -
      (b.agentNames.length || b.carrierNames.length ? 0 : 1) ||
      a.label.localeCompare(b.label, 'es'))
    providers.forEach(p => p.costs.sort((a,b)=>a.name.localeCompare(b.name,'es') || a.id.localeCompare(b.id)))
    return [{...zone,providers,count:providers.reduce((sum,p)=>sum+p.costs.length,0)}]
  })
}

const basis: Record<ChargeBasis,string> = {
  PerShipment: 'Por embarque', PerService: 'Por servicio',
  PerContainer: 'Por contenedor', PerTruck: 'Por camión', PerTeu: 'Por TEU',
  PerPickup: 'Por recolecta', PerCbm: 'Por CBM', PerChargeableCbm: 'Por CBM cobrable',
  PerCft: 'Por CFT', PerChargeableCft: 'Por CFT cobrable',
  PerKg: 'Por KG', PerLb: 'Por LB', Per100Kg: 'Por 100 KG', PerTon: 'Por tonelada',
  PerPallet: 'Por pallet', PerPackage: 'Por bulto', PerDocument: 'Por BL / documento',
}
export function preferentialCostBasis(value: ChargeBasis) { return basis[value] ?? String(value ?? '—') }
