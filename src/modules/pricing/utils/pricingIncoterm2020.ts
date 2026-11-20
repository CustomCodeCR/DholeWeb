/** Incoterms® 2020 ICC, vigentes en 2026. Recomendaciones, nunca prohibiciones de servicio. */
export type IncotermCode = 'EXW'|'FCA'|'FAS'|'FOB'|'CFR'|'CIF'|'CPT'|'CIP'|'DAP'|'DPU'|'DDP'
export type IncotermParty = 'Exporter'|'Importer'|'ByAgreement'
export type ChargeCategory = 'pickup'|'exportCustoms'|'mainFreight'|'insurance'|'destinationHandling'|'importCustoms'|'importTaxes'|'delivery'|'unloading'|'demurrageDetention'
export interface IncotermRule {
  code: IncotermCode
  maritimeOnly: boolean
  sellerPaysMainCarriage: boolean
  mandatorySellerInsurance: boolean
  sellerClearsImport: boolean
  sellerUnloads: boolean
  riskTransfer: string
  sellerScope: string
  buyerScope: string
}
const mk=(code:IncotermCode,maritimeOnly:boolean,sellerPaysMainCarriage:boolean,mandatorySellerInsurance:boolean,sellerClearsImport:boolean,sellerUnloads:boolean,riskTransfer:string,sellerScope:string,buyerScope:string):IncotermRule=>({code,maritimeOnly,sellerPaysMainCarriage,mandatorySellerInsurance,sellerClearsImport,sellerUnloads,riskTransfer,sellerScope,buyerScope})
export const ICC_INCOTERMS_2020: Record<IncotermCode, IncotermRule> = {
  EXW:mk('EXW',false,false,false,false,false,'Mercancía disponible sin cargar en origen','Mercancía disponible en origen','Carga, recolección, exportación, flete, importación y entrega'),
  FCA:mk('FCA',false,false,false,false,false,'Al entregar al transportista/persona designada','Entrega al transportista y despacho exportación','Transporte posterior, importación y entrega'),
  FAS:mk('FAS',true,false,false,false,false,'Mercancía junto al buque','Mercancía junto al buque y exportación','Carga a bordo, flete, destino e importación'),
  FOB:mk('FOB',true,false,false,false,false,'Mercancía a bordo en origen','A bordo y despacho exportación','Flete, destino, importación y entrega'),
  CFR:mk('CFR',true,true,false,false,false,'Mercancía a bordo en origen','FOB + flete marítimo hasta destino','Seguro opcional, destino no incluido e importación'),
  CIF:mk('CIF',true,true,true,false,false,'Mercancía a bordo en origen','CFR + seguro marítimo obligatorio','Destino no incluido, importación y entrega'),
  CPT:mk('CPT',false,true,false,false,false,'Entrega al primer transportista','Exportación y transporte a lugar pactado','Importación y servicios no incluidos posteriores'),
  CIP:mk('CIP',false,true,true,false,false,'Entrega al primer transportista','CPT + seguro obligatorio','Importación y servicios no incluidos posteriores'),
  DAP:mk('DAP',false,true,false,false,false,'En destino, listo para descargar','Transporte a destino pactado','Importación, tributos y descarga'),
  DPU:mk('DPU',false,true,false,false,true,'Después de descarga en destino','Transporte y descarga en destino pactado','Importación, tributos y servicios posteriores'),
  DDP:mk('DDP',false,true,false,true,false,'En destino despachado, listo para descargar','Transporte, importación y tributos','Descarga final y servicios posteriores'),
}
export function resolveIncoterm2020(code?:string|null,label?:string|null):IncotermRule|null {
  for(const candidate of [code,label]){
    const match=String(candidate??'').toUpperCase().match(/(?:^|[^A-Z])(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)(?=$|[^A-Z])/)
    if(match)return ICC_INCOTERMS_2020[match[1] as IncotermCode]
  }
  return null
}
export function recommendedIncotermPayer(code:string,category:ChargeCategory):IncotermParty {
  const rule=resolveIncoterm2020(code)
  if(!rule)return 'ByAgreement'
  if(category==='mainFreight')return rule.sellerPaysMainCarriage?'Exporter':'Importer'
  if(category==='exportCustoms')return rule.code==='EXW'?'Importer':'Exporter'
  if(category==='importCustoms'||category==='importTaxes')return rule.sellerClearsImport?'Exporter':'Importer'
  if(category==='unloading')return rule.sellerUnloads?'Exporter':'Importer'
  if(category==='insurance')return rule.mandatorySellerInsurance?'Exporter':'ByAgreement'
  if(category==='pickup'&&rule.code==='EXW')return 'Importer'
  if(category==='pickup'&&['DAP','DPU','DDP'].includes(rule.code))return 'Exporter'
  // Terminal/descarga/almacenaje y demurrage/detention dependen del lugar y contrato.
  return 'ByAgreement'
}
export function requiresIncotermExceptionReason(code:string,category:ChargeCategory,agreed:IncotermParty):boolean {
  const expected=recommendedIncotermPayer(code,category)
  return expected!=='ByAgreement'&&agreed!=='ByAgreement'&&expected!==agreed
}
export function incotermModeIsRecommended(code:string,modality:string):boolean {
  const rule=resolveIncoterm2020(code)
  return !rule?.maritimeOnly||modality.toLowerCase()==='maritime'
}
export const INCOTERM_WEB_EXPLANATION='Los Incoterms® 2020, vigentes en 2026, establecen gastos, obligaciones de entrega y riesgo entre exportador e importador. El lugar pactado y el transporte contratado determinan los cargos concretos. CIF/CIP incluyen seguro, DDP incluye despacho e impuestos de importación y DPU incluye descarga.'
