/**
 * Fallback for public QR origin offices; transcribed from the supplied
 * "Directorio_WHS_Internacional_Panama.xlsx" (WHS China, rows 5-21).
 *
 * ConfigService remains the authoritative source for existing agent offices,
 * contacts, photographs and routing. This directory is only used if that
 * endpoint cannot find an office; it never overrides a resolved RS/WWL WHS.
 */
export interface DirectoryContact {
  name: string
  email: string
  phone: string
}

export interface DirectoryOffice {
  locator: string
  code?: string
  address: string
  schedule: string
  contacts: DirectoryContact[]
  region: 'china' | 'spain' | 'usa' | 'costa-rica' | 'panama'
}

const officeDirectory: DirectoryOffice[] = [
  { locator: 'Xiamen, China', address: 'Haoxin Logistics Park Fujian Quanzhou City, Jinjiang City Zhangjing', schedule: '12:00 - 20:00', region: 'china', contacts: [] },
  { locator: 'Ningbo, China', address: 'No. 188, Citong Avenue, Ningbo', schedule: '08:00 - 19:00', region: 'china', contacts: [] },
  { locator: 'Dalian, China', address: 'No. 6, West North Road, Ganjingzi District, Dalian City, Liaoning Province', schedule: '09:00 - 18:00', region: 'china', contacts: [] },
  { locator: 'Qingdao, China', address: 'Changqing Logistics Park (50 meters west of intersection of Shuangyuan Road and Hedong Road), North District Warehouse 2-3', schedule: '08:00 - 19:00', region: 'china', contacts: [] },
  { locator: 'Xingang, China', address: 'Jinya Logistics Park No. 876 East Yangbei Road, Dongli District, Tianjin', schedule: '08:00 - 19:00', region: 'china', contacts: [] },
  { locator: 'Shenzhen, China', address: 'No. 1-3, Building 6, District B, Jinpeng Logistics Park', schedule: '09:00 - 22:00', region: 'china', contacts: [] },
  { locator: 'Guangzhou, China', address: 'Gate 105-106, Building F1, Huabang Logistics Park, Taihe Town, Baiyun District, Guangzhou', schedule: '08:00 - 22:00', region: 'china', contacts: [] },
  { locator: 'Fuzhou, China', address: 'Haoxin Logistics Park Fujian Quanzhou City, Jinjiang City Zhangjing', schedule: '12:00 - 20:00', region: 'china', contacts: [] },
  { locator: 'Barcelona, España', address: 'C/ Illes Medes, Nave 1, 08192 Sant Quirze, Barcelona, Spain', schedule: '08:00 - 16:00', region: 'spain', contacts: [
    { name: 'Julio Tomalá', email: 'sea.export@bclgroup.net', phone: '+34 93 715 67 60' },
    { name: 'Alejandro Sandi', email: 'espana@grupocastrofallas.com', phone: '' },
  ] },
  { locator: 'Miami, USA', address: '8501 NW 17 Street, Suite 101, Miami, FL 33126', schedule: '09:00 - 16:00', region: 'usa', contacts: [] },
  { locator: 'New York, USA', address: '6801 West Side Avenue, North Bergen, NJ 07047', schedule: '09:00 - 16:00', region: 'usa', contacts: [] },
  { locator: 'Houston, USA', address: '2222 N. Wayside Dr., Houston, TX 77020', schedule: '09:00 - 16:00', region: 'usa', contacts: [] },
  { locator: 'Los Angeles, USA', address: '19001 Harborgate Way, Torrance, CA 90501', schedule: '09:00 - 16:00', region: 'usa', contacts: [] },
  { locator: 'Hueneme, USA', address: '710 N Del Norte Blvd, Oxnard, CA 93030', schedule: '09:00 - 16:00', region: 'usa', contacts: [] },
  { locator: 'A257 Curridabat, Costa Rica', code: 'A257', address: 'Frente a Café Volio, Barrio San José, Curridabat, Costa Rica', schedule: '08:00 - 16:00', region: 'costa-rica', contacts: [
    { name: 'Josue Alvarado / Andrea Monge', email: 'costarica@grupocastrofallas.com', phone: '' },
  ] },
  { locator: 'A287 Tibás, Costa Rica', code: 'A287', address: 'Detrás del Hotel El Edén, Tibás, Costa Rica', schedule: '08:00 - 16:00', region: 'costa-rica', contacts: [
    { name: 'Josue Alvarado / Andrea Monge', email: 'costarica@grupocastrofallas.com', phone: '' },
  ] },
  { locator: 'Panamá, Panamá', address: 'France Field, Calle 7ma., Avenida 5ta., al lado de la Bodega de Anker, Panamá', schedule: '08:00 - 16:00', region: 'panama', contacts: [
    { name: 'Josue Alvarado', email: 'panama@grupocastrofallas.com', phone: '' },
  ] },
]

for (const entry of officeDirectory) {
  if (entry.region === 'china') {
    entry.contacts = [
      { name: 'Tiki Wang', email: 'consol.sh@rslog.com', phone: '' },
      { name: 'Alejandro Sandi', email: 'consolidado-china@grupocastrofallas.com', phone: '' },
    ]
  } else if (entry.region === 'usa') {
    entry.contacts = [
      { name: 'Tomas Lobotrico', email: 'tlobotrico@pluscargousa.com', phone: '' },
      { name: 'Randy Salazar', email: 'estadosunidos@grupocastrofallas.com', phone: '' },
    ]
  }
}

export function normalizeOriginLocator(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

export function findPublicDirectoryOffice(pol: string): DirectoryOffice | null {
  const text = normalizeOriginLocator(pol)
  if (!text) return null
  // A257/A287 must never be selected arbitrarily from a generic Costa Rica POL.
  const code = text.match(/\ba(?:257|287)\b/)?.[0]?.toUpperCase()
  if (code) return officeDirectory.find((office) => office.code === code) ?? null
  return officeDirectory.find((office) =>
    normalizeOriginLocator(office.locator) === text
    || normalizeOriginLocator(office.locator.replace(/^A(?:257|287) /, '')) === text
  ) ?? null
}

export function canUsePublicDirectoryFallback(pol: string, agentCode: string, agentName: string): boolean {
  const entry = findPublicDirectoryOffice(pol)
  if (!entry) return false
  if (entry.region !== 'china') return true
  // The spreadsheet's generic China WHS is not proof of a WWL-specific location.
  const agent = normalizeOriginLocator([agentCode, agentName].filter(Boolean).join(' '))
  return !/\bwwl\b|worldwide logistics/.test(agent)
}

export interface CompanyOriginContact {
  name: string
  email: string
  role: string
}

/**
 * Only verified @grupocastrofallas.com addresses. Never fabricate direct
 * numbers or use external coloader/agent contacts on public coloader pages.
 */
export function getPublicColoaderContacts(pol: string): CompanyOriginContact[] {
  const entry = findPublicDirectoryOffice(pol)
  const normalized = normalizeOriginLocator(pol)
  const region = entry?.region
    ?? (normalized.includes('china') ? 'china'
      : normalized.includes('costa rica') ? 'costa-rica'
      : normalized.includes('panama') ? 'panama'
      : normalized.includes('espana') || normalized.includes('spain') ? 'spain'
      : normalized.includes('usa') || normalized.includes('estados unidos') ? 'usa' : null)
  const regionalAddress: Record<string, string> = {
    china: 'consolidado-china@grupocastrofallas.com',
    spain: 'espana@grupocastrofallas.com',
    usa: 'estadosunidos@grupocastrofallas.com',
    panama: 'panama@grupocastrofallas.com',
    'costa-rica': 'costarica@grupocastrofallas.com',
  }
  const consolidatedEmail = region ? regionalAddress[region] ?? '' : ''
  // China's GCF address is already part of the ConfigService China matrix.
  // Other regions currently publish one shared regional mailbox in the Excel.
  const gcfEmail = region === 'china' ? 'china@grupocastrofallas.com' : consolidatedEmail
  return [
    { name: 'Grupo Castro Fallas', email: gcfEmail, role: 'Coordinación en origen' },
    {
      name: 'Consolidados',
      email: consolidatedEmail,
      role: region === 'china' ? 'Departamento de consolidados' : 'Departamento de consolidados · canal regional compartido',
    },
  ]
}
