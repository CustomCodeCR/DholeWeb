import type { OpeningFieldStatus } from '../services/operationsApi'

const labels: Record<OpeningFieldStatus, string> = {
  CONFIRMADO: 'Confirmado',
  PENDIENTE_PERMITIDO: 'Pendiente permitido',
  PENDIENTE_BLOQUEANTE: 'Pendiente bloqueante',
  NO_APLICA: 'No aplica',
}
const variants = {
  CONFIRMADO: 'success',
  PENDIENTE_PERMITIDO: 'warning',
  PENDIENTE_BLOQUEANTE: 'danger',
  NO_APLICA: 'neutral',
} as const
const fields: Record<string, string> = {
  accountId: 'Cliente CRM', modality: 'Modalidad', transportType: 'Transporte', shipmentType: 'Tipo de embarque',
  provenance: 'Origen de solicitud', clientPoReference: 'Referencia del cliente', crmDivisionId: 'División CRM',
  cargoNature: 'Naturaleza de la carga', cabysCode: 'CABYS', packageType: 'Tipo de bulto', packageCount: 'Cantidad de bultos',
  agentReference: 'Agente', merchantReference: 'Merchant', etm: 'ETD', eta: 'ETA', observations: 'Observaciones',
  contactIds: 'Contactos operativos', services: 'Servicios', supportDocuments: 'Documentos de respaldo',
  operationDirection: 'Sentido de operación', pol: 'POL / origen', poe: 'POE / entrada',
  pod: 'POD / destino final', polTerminalType: 'Terminal de origen',
  poeTerminalType: 'Terminal de entrada', podTerminalType: 'Terminal de destino',
  incoterm: 'Incoterm', equipment: 'Tipo y cantidad de equipo', cargoDescription: 'Descripción de carga',
  estimatedWeight: 'Peso estimado', actualWeight: 'Peso real', actualWeightInput: 'Restricción de peso real',
  dimensions: 'Dimensiones', volume: 'Volumen', deliveryLocations: 'Puntos de entrega',
  destinationAddress: 'Dirección de entrega', portHandlingMode: 'Operación portuaria',
  whsName: 'WHS', pickupLocations: 'Puntos de recolecta', pickupAddress: 'Dirección de recolecta',
  imoClass: 'Clase IMO', unNumber: 'Número UN', overweightNotes: 'Observaciones de sobrepeso',
  stackable: 'Estibabilidad', consolidation: 'Consolidación', carrierReference: 'Naviera',
  bookingNumber: 'Número de booking', blNumber: 'Número de BL', containerNumber: 'Número de contenedor',
  airline: 'Aerolínea', openingData: 'Datos de apertura',
}
export const openingFieldLabel = (code: string) => fields[code] ?? code
export const openingStatusLabel = (status: OpeningFieldStatus) => labels[status] ?? status
export const openingStatusVariant = (status: OpeningFieldStatus) => variants[status] ?? 'neutral'
