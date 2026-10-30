import type { CatalogItemDetailDto } from '@/core/interfaces/catalogs'

// International calling prefixes by ISO 3166-1 alpha-2. Territory-specific
// NANP prefixes are kept where they distinguish a country's national plan.
// Config metadata takes precedence so admins can override or add a country.
const rawCallingCodes = `
AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AQ:672 AR:54 AS:1684 AT:43 AU:61 AW:297 AX:35818 AZ:994
BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BL:590 BM:1441 BN:673 BO:591 BQ:599 BR:55 BS:1242 BT:975 BV:47 BW:267 BY:375 BZ:501
CA:1 CC:61 CD:243 CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 CV:238 CW:599 CX:61 CY:357 CZ:420
DE:49 DJ:253 DK:45 DM:1767 DO:1 DZ:213 EC:593 EE:372 EG:20 EH:212 ER:291 ES:34 ET:251
FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995 GF:594 GG:44 GH:233 GI:350 GL:299 GM:220 GN:224 GP:590 GQ:240 GR:30 GS:500 GT:502 GU:1671 GW:245 GY:592
HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IM:44 IN:91 IO:246 IQ:964 IR:98 IS:354 IT:39 JE:44 JM:1876 JO:962 JP:81
KE:254 KG:996 KH:855 KI:686 KM:269 KN:1869 KP:850 KR:82 KW:965 KY:1345 KZ:7
LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 LY:218
MA:212 MC:377 MD:373 ME:382 MF:590 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 MP:1670 MQ:596 MR:222 MS:1664 MT:356 MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258
NA:264 NC:687 NE:227 NF:672 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674 NU:683 NZ:64
OM:968 PA:507 PE:51 PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PN:64 PR:1 PS:970 PT:351 PW:680 PY:595
QA:974 RE:262 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SH:290 SI:386 SJ:47 SK:421 SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268
TC:1649 TD:235 TF:262 TG:228 TH:66 TJ:992 TK:690 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 TZ:255
UA:380 UG:256 UM:1 US:1 UY:598 UZ:998 VA:379 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678
WF:681 WS:685 YE:967 YT:262 ZA:27 ZM:260 ZW:263
`
const rawIso3 = `
ABW:AW AFG:AF AGO:AO AIA:AI ALA:AX ALB:AL AND:AD ARE:AE ARG:AR ARM:AM ASM:AS ATA:AQ ATF:TF ATG:AG AUS:AU AUT:AT AZE:AZ
BDI:BI BEL:BE BEN:BJ BES:BQ BFA:BF BGD:BD BGR:BG BHR:BH BHS:BS BIH:BA BLM:BL BLR:BY BLZ:BZ BMU:BM BOL:BO BRA:BR BRB:BB BRN:BN BTN:BT BVT:BV BWA:BW
CAF:CF CAN:CA CCK:CC CHE:CH CHL:CL CHN:CN CIV:CI CMR:CM COD:CD COG:CG COK:CK COL:CO COM:KM CPV:CV CRI:CR CUB:CU CUW:CW CXR:CX CYM:KY CYP:CY CZE:CZ
DEU:DE DJI:DJ DMA:DM DNK:DK DOM:DO DZA:DZ ECU:EC EGY:EG ERI:ER ESH:EH ESP:ES EST:EE ETH:ET FIN:FI FJI:FJ FLK:FK FRA:FR FRO:FO FSM:FM
GAB:GA GBR:GB GEO:GE GGY:GG GHA:GH GIB:GI GIN:GN GLP:GP GMB:GM GNB:GW GNQ:GQ GRC:GR GRD:GD GRL:GL GTM:GT GUF:GF GUM:GU GUY:GY
HKG:HK HMD:HM HND:HN HRV:HR HTI:HT HUN:HU IDN:ID IMN:IM IND:IN IOT:IO IRL:IE IRN:IR IRQ:IQ ISL:IS ISR:IL ITA:IT
JAM:JM JEY:JE JOR:JO JPN:JP KAZ:KZ KEN:KE KGZ:KG KHM:KH KIR:KI KNA:KN KOR:KR KWT:KW
LAO:LA LBN:LB LBR:LR LBY:LY LCA:LC LIE:LI LKA:LK LSO:LS LTU:LT LUX:LU LVA:LV
MAC:MO MAF:MF MAR:MA MCO:MC MDA:MD MDG:MG MDV:MV MEX:MX MHL:MH MKD:MK MLI:ML MLT:MT MMR:MM MNE:ME MNG:MN MNP:MP MOZ:MZ MRT:MR MSR:MS MTQ:MQ MUS:MU MWI:MW MYS:MY MYT:YT
NAM:NA NCL:NC NER:NE NFK:NF NGA:NG NIC:NI NIU:NU NLD:NL NOR:NO NPL:NP NRU:NR NZL:NZ OMN:OM
PAK:PK PAN:PA PCN:PN PER:PE PHL:PH PLW:PW PNG:PG POL:PL PRI:PR PRK:KP PRT:PT PRY:PY PSE:PS PYF:PF
QAT:QA REU:RE ROU:RO RUS:RU RWA:RW SAU:SA SDN:SD SEN:SN SGP:SG SGS:GS SHN:SH SJM:SJ SLB:SB SLE:SL SLV:SV SMR:SM SOM:SO SPM:PM SRB:RS SSD:SS STP:ST SUR:SR SVK:SK SVN:SI SWE:SE SWZ:SZ SXM:SX SYC:SC SYR:SY
TCA:TC TCD:TD TGO:TG THA:TH TJK:TJ TKL:TK TKM:TM TLS:TL TON:TO TTO:TT TUN:TN TUR:TR TUV:TV TWN:TW TZA:TZ
UGA:UG UKR:UA UMI:UM URY:UY USA:US UZB:UZ VAT:VA VCT:VC VEN:VE VGB:VG VIR:VI VNM:VN VUT:VU WLF:WF WSM:WS YEM:YE ZAF:ZA ZMB:ZM ZWE:ZW
`
const parseCodes = (source: string) => new Map(source.trim().split(/\s+/).map(entry => {
  const [country, value] = entry.split(':')
  return [country, value] as const
}))
export const callingCodes = parseCodes(rawCallingCodes)
const iso3Codes = parseCodes(rawIso3)
const normalize = (value: unknown) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function validPrefix(value: unknown): string | null {
  const input = String(value ?? '').trim().replace(/[\s-]/g, '')
  return /^\+?\d{1,6}$/.test(input) ? '+' + input.replace(/^\+/, '') : null
}
function fromMetadata(metadataJson: string | null): string | null {
  if (!metadataJson) return null
  try {
    const meta: unknown = JSON.parse(metadataJson)
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
    const values = meta as Record<string, unknown>
    for (const key of ['dialCode', 'dialingCode', 'callingCode', 'phoneCode',
      'phonePrefix', 'telephoneCode', 'countryCallingCode', 'internationalDialCode']) {
      const result = validPrefix(values[key])
      if (result) return result
    }
  } catch { /* metadata may be unstructured; use ISO fallback */ }
  return null
}
const isoNameMap = new Map<string, string>()
if (typeof Intl.DisplayNames === 'function') {
  for (const locale of ['es', 'en']) {
    const names = new Intl.DisplayNames([locale], { type: 'region' })
    for (const code of callingCodes.keys()) {
      const label = names.of(code)
      if (label) isoNameMap.set(normalize(label), code)
    }
  }
}
const aliases: Record<string, string> = {
  'estados unidos': 'US', 'ee uu': 'US', 'reino unido': 'GB', 'gran bretana': 'GB',
  'panama': 'PA', 'costa rica': 'CR', 'republica dominicana': 'DO',
  'corea del sur': 'KR', 'corea del norte': 'KP', 'china continental': 'CN',
  'taiwan': 'TW', 'hong kong': 'HK', 'curazao': 'CW', 'paises bajos': 'NL',
  'venezuela': 'VE', 'bolivia': 'BO', 'rusia': 'RU', 'turquia': 'TR',
}
export function dialCodeForCountry(country: Pick<CatalogItemDetailDto,
  'code' | 'slug' | 'name' | 'value' | 'metadataJson'>): string | null {
  const explicit = fromMetadata(country.metadataJson)
  if (explicit) return explicit
  for (const value of [country.code, country.value, country.slug, country.name]) {
    const input = String(value ?? '').trim().toUpperCase()
    const alpha2 = callingCodes.has(input) ? input : iso3Codes.get(input)
    if (alpha2 && callingCodes.has(alpha2)) return '+' + callingCodes.get(alpha2)
    const normalized = normalize(value)
    const localized = aliases[normalized] ?? isoNameMap.get(normalized)
    if (localized) return '+' + callingCodes.get(localized)
  }
  return null
}

/** Never add the same country prefix twice; preserve existing international values. */
export function localPhonePart(phone: string, prefix: string | null): string {
  const value = phone.trim()
  if (!prefix) return value
  if (value.startsWith(prefix)) return value.slice(prefix.length).replace(/^[\s()-]+/, '')
  return value
}
export function internationalPhone(prefix: string | null, local: string): string {
  const value = local.trim()
  if (!value) return ''
  // Pasted international numbers must remain international, not become +506+34....
  if (value.startsWith('+')) return '+' + value.slice(1).replace(/\D/g, '')
  if (!prefix) return value
  const digits = value.replace(/\D/g, '')
  return digits ? prefix + digits : ''
}
