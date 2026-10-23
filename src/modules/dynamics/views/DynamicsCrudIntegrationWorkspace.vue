<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, Copy, Database, KeyRound, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import { fetchClient } from '@/core/api/fetchConfig'
import { ApiError } from '@/core/api/apiErrorHandler'
import { useAuthStore } from '@/core/stores/authStore'

type Connection = { code: string }
type Choice = { value: number; labels: Record<string,string> }
type Field = { logicalName: string; type: string; canRead: boolean; canCreate: boolean
  canUpdate: boolean; isCalculated: boolean; requiredLevel?: string | null
  labels: Record<string,string>; lookupTargets: string[]; choices: Choice[] }
type Relationship = { kind:string; referencingEntity?:string|null; referencingAttribute?:string|null
  referencedEntity?:string|null; referencingNavigation?:string|null }
type Table = { logicalName: string; entitySetName: string; labels: Record<string,string>
  primaryIdAttribute: string; primaryNameAttribute?: string|null; columns: Field[]; relationships?: Relationship[]
  alternateKeys?: Array<{ logicalName: string; attributes: string[] }> }
type Snapshot = { version: number; catalog: { tables: Table[] } }
type Policy = { entities: Array<{logicalName:string;enabled:boolean}>
  fields: Array<{entityName:string;fieldName:string;enabled:boolean;canCreate:boolean;canUpdate:boolean;canRead:boolean}> }
type Definition = {entityName:string;operation:string;
  inputs: Array<{name:string;type:string;required:boolean}>;
  mappings: Array<{target:string;source:string;steps?:Array<{op:string;argument?:string}>}>}
type Summary = {id:string;name:string;activeVersion:number|null;
  history:Array<{version:number;definition:Definition}>}
type KeyInfo = {id:string;templateName:string;operation:string;entityName:string;
  label:string;enabled:boolean;expiresAt:string;templateVersion:number;maxRequestsPerMinute:number;
  createdAt:string;lastUsedAt:string|null}
type Issued = {key:KeyInfo;apiKey:string}
type Operation = 'create'|'update'|'upsert'|'delete'

const props=defineProps<{connections:Connection[]}>()
const emit=defineEmits<{navigate:[section:'catalog'|'query'|'crud'|'security'|'integrations']}>()
const auth=useAuthStore()
const canManage=computed(()=>auth.hasScope('dynamics.security.admin'))
const connection=ref('principal')
const busy=ref(false)
const error=ref('')
const success=ref('')
const step=ref<1|2|3|4>(1)
const operation=ref<Operation>('create')
const entity=ref('')
const selected=ref<string[]>([])
const chosenRelations=ref<Record<string,string>>({})
const relationModes=ref<Record<string,'name'|'guid'>>({})
const lookupMatchFields=ref<Record<string,string>>({})
const quoteSetupConfirm=ref(false)
const quoteSetupBusy=ref(false)
const quoteSetupMessage=ref('')
const quoteSetupError=ref('')
const exampleOptions=ref<Record<string,number|string>>({})
const liveChoices=ref<Record<string,Array<{value:number;label:string}>>>({})
const choicesLoading=ref(false)
const choiceError=ref('')
let choiceRequest=0
const fieldSearch=ref('')
const fieldVisibility=ref<'all'|'selectable'|'restricted'>('all')
const showQuoteDetailFields=ref(false)
const quoteDetailSearch=ref('')
const MAX_COMMAND_FIELDS=64
const keyName=ref('')
const endpointName=ref('crear_oferta')
const snapshot=ref<Snapshot|null>(null)
const policies=ref<Policy>({entities:[],fields:[]})
const definitions=ref<Summary[]>([])
const keys=ref<KeyInfo[]>([])
const issued=ref<Issued|null>(null)
const createdVersion=ref<number|null>(null)
const keyForm=ref({label:'Mi aplicación',expiresInDays:30,maxRequestsPerMinute:30})
const quoteTotalGrantKeyId=ref('')
const quoteTotalGrantConfirm=ref(false)
const quoteTotalGrantBusy=ref(false)
const quoteTotalGrantSuccess=ref('')
const quoteTotalGrantError=ref('')
const base=(import.meta.env.VITE_API_URL||'https://api.logisticacastrofallas.com').trim().replace(/\/+$/,'')
const api=(path:string)=>'/api/dynamics-admin/connections/'+encodeURIComponent(connection.value)+'/'+path
const steps=['Operación','Tabla y campos','Definir comando','Publicar API'] as const
const operations=[
  {value:'create',name:'CREATE',description:'Crear un registro nuevo desde cualquier aplicación.'},
  {value:'update',name:'UPDATE',description:'Modificar campos autorizados de un registro existente.'},
  {value:'upsert',name:'UPSERT',description:'Crear o actualizar usando una clave alternativa de Dataverse.'},
  {value:'delete',name:'DELETE',description:'Eliminar con control de versión y confirmación específica.'},
] as const

function display(labels?:Record<string,string>,fallback='') {
  if(!labels)return fallback
  return labels['3082']||labels['1033']||Object.values(labels)[0]||fallback
}
function fieldType(f:Field):'string'|'guid'|'integer'|'decimal'|'boolean'|'datetime' {
  if(relationshipTypes.has(f.type)&&relationMode(f)==='name')return 'string'
  if(f.logicalName==='new_equipo'&&f.type==='Picklist')return 'string'
  if(['Boolean'].includes(f.type))return 'boolean'
  if(['Integer','BigInt','Picklist','State','Status'].includes(f.type))return 'integer'
  if(['Money','Decimal','Double'].includes(f.type))return 'decimal'
  if(['DateTime'].includes(f.type))return 'datetime'
  if(['Uniqueidentifier','Lookup','Customer','Owner'].includes(f.type))return 'guid'
  return 'string'
}
const tables=computed(()=>snapshot.value?.catalog.tables.filter(t=>
  policies.value.entities.some(p=>p.logicalName===t.logicalName&&p.enabled))??[])
const table=computed(()=>tables.value.find(t=>t.logicalName===entity.value))
const quoteDetailTable=computed(()=>snapshot.value?.catalog.tables.find(t=>t.logicalName==='quotedetail'))
const quoteDetailRequiredFields=[
  'quoteid','isproductoverridden','ispriceoverridden','productdescription',
  'quotedetailname','quantity','priceperunit'
] as const
const quoteDetailStatus=computed(()=>quoteDetailRequiredFields.map(name=>{
  const field=quoteDetailTable.value?.columns.find(f=>f.logicalName===name)
  const policy=policies.value.fields.find(p=>p.entityName==='quotedetail'&&p.fieldName===name)
  return {name, discovered:!!field, authorized:!!field?.canCreate&&!!policy?.enabled&&!!policy.canCreate}
}))
const filteredQuoteDetailFields=computed(()=>(quoteDetailTable.value?.columns??[])
  .filter(f=>(display(f.labels,f.logicalName)+' '+f.logicalName)
    .toLocaleLowerCase().includes(quoteDetailSearch.value.trim().toLocaleLowerCase()))
  .sort((a,b)=>a.logicalName.localeCompare(b.logicalName)))
const supportedTypes=new Set(['String','Memo','EntityName','Boolean','Integer','BigInt',
  'Picklist','State','Status','Money','Decimal','Double','DateTime','Uniqueidentifier'])
const relationshipTypes=new Set(['Lookup','Customer','Owner'])
type FieldAvailability={field:Field;selectable:boolean;reason:string;requiresPermission:boolean}
function availability(f:Field):FieldAvailability {
  const denied=(reason:string,requiresPermission=false):FieldAvailability=>({
    field:f,selectable:false,reason,requiresPermission
  })
  if(f.logicalName.startsWith('_')&&f.logicalName.endsWith('_value'))
    return denied('Referencia OData de solo lectura. Para escribir una relación se necesita el atributo real y @odata.bind.')
  if(f.isCalculated)
    return denied('Campo calculado o administrado por Dataverse: no admite escritura directa.')
  if(relationshipTypes.has(f.type)&&!lookupOptions(f).length)
    return denied('Falta descubrir la propiedad de navegación real. Usá Preparar Oferta y Línea de oferta.')
  if(!relationshipTypes.has(f.type)&&!supportedTypes.has(f.type))
    return denied('Tipo '+f.type+' no compatible con los campos de entrada del comando CRUD.')
  const action=operation.value==='create'?'crear':operation.value==='update'?'editar':'crear y editar'
  if(operation.value==='create'&&!f.canCreate)
    return denied('Dataverse no permite crear este campo (IsValidForCreate=false).')
  if(operation.value==='update'&&!f.canUpdate)
    return denied('Dataverse no permite editar este campo (IsValidForUpdate=false).')
  if(operation.value==='upsert'&&(!f.canCreate||!f.canUpdate))
    return denied('UPSERT requiere que Dataverse permita crear y editar este campo.')
  const rule=policies.value.fields.find(p=>p.entityName===entity.value&&p.fieldName===f.logicalName)
  if(!rule?.enabled)
    return denied('Sin autorización en Catálogo para '+action+'. Usá Habilitar todos con lectura y escritura.',true)
  if(operation.value==='create'&&!rule.canCreate||
     operation.value==='update'&&!rule.canUpdate||
     operation.value==='upsert'&&(!rule.canCreate||!rule.canUpdate))
    return denied('La política de Dhole no autoriza '+action+' este campo. Revisá Catálogo → Habilitar todos.',true)
  return {field:f,selectable:true,reason:'Disponible para '+action+' en este comando.',requiresPermission:false}
}
function lookupOptions(f:Field):Relationship[] {
  if(!relationshipTypes.has(f.type))return []
  return (table.value?.relationships??[]).filter(r=>
    r.kind==='ManyToOneRelationships'&&r.referencingEntity===entity.value&&
    r.referencingAttribute===f.logicalName&&!!r.referencingNavigation&&!!r.referencedEntity)
}
function chosenLookup(f:Field):Relationship|undefined {
  const options=lookupOptions(f)
  return options.find(r=>r.referencingNavigation===chosenRelations.value[f.logicalName])??options[0]
}
function targetTable(f:Field):Table|undefined {
  const rel=chosenLookup(f)
  return snapshot.value?.catalog.tables.find(t=>t.logicalName===rel?.referencedEntity)
}
function readableNameFields(f:Field):Field[] {
  const dest=targetTable(f)
  if(!dest)return []
  return dest.columns.filter(c=>c.canRead&&['String','Memo'].includes(c.type)&&
    policies.value.fields.some(p=>p.entityName===dest.logicalName&&
      p.fieldName===c.logicalName&&p.enabled&&p.canRead))
}
function selectedNameField(f:Field):string {
  const fields=readableNameFields(f)
  const existing=lookupMatchFields.value[f.logicalName]
  if(existing&&fields.some(c=>c.logicalName===existing))return existing
  const preferred=/^new_idtra(?:10|[1-9])$/i.test(f.logicalName)
    ?'title'
    :f.logicalName==='transactioncurrencyid'
      ?'isocurrencycode'
      :targetTable(f)?.primaryNameAttribute
  return fields.find(c=>c.logicalName===preferred)?.logicalName??fields[0]?.logicalName??''
}
function relationMode(f:Field):'name'|'guid' {
  const choice=relationModes.value[f.logicalName]
  return choice==='guid'||choice==='name'&&readableNameFields(f).length?choice:
    readableNameFields(f).length?'name':'guid'
}
const selectedLookups=computed(()=>selectedFields.value.filter(f=>relationshipTypes.has(f.type)))
const fieldAvailability=computed(()=>table.value?.columns.map(availability)??[])
const eligibleFields=computed(()=>fieldAvailability.value.filter(a=>a.selectable).map(a=>a.field))
const restrictedCount=computed(()=>fieldAvailability.value.filter(a=>!a.selectable).length)
const requiresPermissionCount=computed(()=>fieldAvailability.value.filter(a=>a.requiresPermission).length)
const filteredFields=computed(()=>fieldAvailability.value.filter(a=>{
  if(fieldVisibility.value==='selectable'&&!a.selectable)return false
  if(fieldVisibility.value==='restricted'&&a.selectable)return false
  return (display(a.field.labels,a.field.logicalName)+' '+a.field.logicalName)
    .toLocaleLowerCase().includes(fieldSearch.value.trim().toLocaleLowerCase())
}).sort((a,b)=>Number(b.selectable)-Number(a.selectable)||
  display(a.field.labels,a.field.logicalName).localeCompare(display(b.field.labels,b.field.logicalName),'es')))
function selectVisibleFields(){
  const current=new Set(selected.value)
  for(const row of filteredFields.value){
    if(current.size>=MAX_COMMAND_FIELDS)break
    if(row.selectable)current.add(row.field.logicalName)
  }
  selected.value=[...current]
}
function clearSelectedFields(){selected.value=[];chosenRelations.value={};relationModes.value={};lookupMatchFields.value={};exampleOptions.value={};createdVersion.value=null}
const entityNameOptions=computed(()=>(snapshot.value?.catalog.tables??[])
  .filter(t=>policies.value.entities.some(p=>p.logicalName===t.logicalName&&p.enabled))
  .map(t=>({ value:t.logicalName,label:display(t.labels,t.logicalName) }))
  .sort((a,b)=>a.label.localeCompare(b.label,'es')))
const optionFields=computed(()=>selectedFields.value.filter(f=>
  ['Picklist','State','Status','EntityName'].includes(f.type)))
const choicesFor=(f:Field):Array<{ value:number|string;label:string }> =>
  f.type==='EntityName'?entityNameOptions.value:
  liveChoices.value[f.logicalName] ??
    (f.choices??[]).map(c=>({value:c.value,label:display(c.labels,String(c.value))}))
const metadataChoicesMissing=computed(()=>optionFields.value.filter(f=>
  choicesFor(f).length===0))
const chosenValue=(f:Field):string|number|undefined=>{
  const options=choicesFor(f)
  const chosen=exampleOptions.value[f.logicalName]
  return options.some(o=>o.value===chosen)?chosen:options[0]?.value
}
function setExampleOption(field:Field,value:string) {
  exampleOptions.value[field.logicalName]=field.type==='EntityName'?value:Number(value)
}
const eligibleKeys=computed(()=>table.value?.alternateKeys??[])
const selectedKey=computed(()=>eligibleKeys.value.find(k=>k.logicalName===keyName.value))
const selectedFields=computed(()=>eligibleFields.value.filter(f=>selected.value.includes(f.logicalName)))
const definition=computed<Definition>(()=>({
  entityName:entity.value,operation:operation.value,
  inputs:operation.value==='delete'?[]:selectedFields.value.map(f=>({
    name:f.logicalName,type:fieldType(f),
    required:operation.value==='create'&&!!f.requiredLevel?.includes('Required')
  })),
  mappings:operation.value==='delete'?[]:selectedFields.value.map(f=>({
    target:relationshipTypes.has(f.type)
      ?(chosenLookup(f)?.referencingNavigation??'')+'@odata.bind'
      :f.logicalName,
    source:f.logicalName,
    ...(relationshipTypes.has(f.type)&&relationMode(f)==='name'
      ?{steps:[{op:'lookup_name',argument:selectedNameField(f)}]}:
      // Divisa/moneda use their supplied input value; mappings must
      // contain an object, never a raw string (invalid TypeScript spread).
      f.logicalName==='new_equipo'&&f.type==='Picklist'
      ?{steps:[{op:'choice_label'}]}:{})
  }))
}))
const nameValid=computed(()=>/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(endpointName.value))
const validationIssues=computed(()=>{
  const issues:string[]=[]
  if(!table.value)issues.push('La tabla no está habilitada en Catálogo o no está disponible en los metadatos.')
  if(!nameValid.value)issues.push('El nombre público debe comenzar con una letra y usar solo letras, números, guiones o guion bajo (máximo 80 caracteres).')
  if(operation.value!=='delete'&&!selectedFields.value.length)
    issues.push('Seleccioná al menos un campo con permiso de escritura.')
  const unavailable=selected.value.filter(name=>!eligibleFields.value.some(f=>f.logicalName===name))
  if(unavailable.length)issues.push('Los campos '+unavailable.join(', ')+' no están autorizados o no se pudieron recuperar. Revisá Tabla y campos; no se omitirán silenciosamente.')
  if(choicesLoading.value)issues.push('Todavía se están consultando las opciones de Dataverse.')
  if(choiceError.value)issues.push('Falló la lectura de opciones: '+choiceError.value)
  if(metadataChoicesMissing.value.length)
    issues.push('No hay opciones válidas para: '+metadataChoicesMissing.value.map(f=>f.logicalName).join(', '))
  if(operation.value==='upsert'&&!selectedKey.value)
    issues.push('UPSERT necesita una clave alternativa válida de Dataverse.')
  return issues
})
const configValid=computed(()=>validationIssues.value.length===0)
const selectedTemplate=computed(()=>definitions.value.find(t=>t.name===endpointName.value))
// Activation targets an immutable revision that was saved by the API. A client-side
// field comparison must not hide a persisted revision: metadata ordering, omitted
// default values and OData mappings can legitimately differ after a round-trip.
const savedVersion=computed(()=>createdVersion.value==null?null:
  selectedTemplate.value?.history.find(h=>h.version===createdVersion.value)??null)
const hasCurrentVersion=computed(()=>!!savedVersion.value)
function comparableDefinition(value:Definition):string {
  return JSON.stringify({
    entityName:value.entityName, operation:value.operation,
    inputs:value.inputs.map(i=>({name:i.name,type:i.type,required:i.required}))
      .sort((a,b)=>a.name.localeCompare(b.name)),
    mappings:value.mappings.map(m=>({
      target:m.target,source:m.source,
      steps:(m.steps??[]).map(step=>({op:step.op,argument:step.argument??null}))
    })).sort((a,b)=>a.target.localeCompare(b.target))
  })
}
const unsavedChanges=computed(()=>!!savedVersion.value&&
  comparableDefinition(savedVersion.value.definition)!==comparableDefinition(definition.value))
const active=computed(()=>hasCurrentVersion.value&&selectedTemplate.value?.activeVersion===createdVersion.value)
const exampleBody=computed(()=>{
  const inputs:Record<string,unknown>={}
  for(const f of selectedFields.value) {
    const kind=fieldType(f)
    inputs[f.logicalName]=relationshipTypes.has(f.type)&&relationMode(f)==='name'
      ?(/^new_idtra(?:10|[1-9])$/i.test(f.logicalName)
        ?'IDTRA-2026-00125'
        :f.logicalName==='transactioncurrencyid'?'USD':'NOMBRE EXACTO EN DYNAMICS'):
      f.logicalName==='new_equipo'&&f.type==='Picklist'
      ?choicesFor(f).find(o=>o.value===chosenValue(f))?.label??null:
      ['Picklist','State','Status','EntityName'].includes(f.type)
      ?chosenValue(f)??null:
      kind==='integer'||kind==='decimal'?0:
      kind==='boolean'?false:
      kind==='guid'?'GUID_REAL_OBTENIDO_CON_QUERY_BUILDER':
      kind==='datetime'?'2026-10-20T12:00:00Z':'VALOR'
  }
  const body:Record<string,unknown>={connectionCode:connection.value,inputs}
  if(operation.value==='update'||operation.value==='delete'){
    body.recordId='GUID_REAL_OBTENIDO_CON_QUERY_BUILDER'
    body.eTag='W/"VERSION_REAL_DEL_REGISTRO"'
  }
  if(operation.value==='upsert'){
    body.keys=Object.fromEntries((selectedKey.value?.attributes??[]).map(f=>
      [f,inputs[f]??'VALOR_DE_CLAVE']))
  }
  if(operation.value==='delete'){
    body.confirmDelete=true
    body.deleteReason='Motivo de eliminación registrado por el sistema consumidor.'
  }
  return body
})
const endpoint=computed(()=>base+'/api/dynamics-connector/keyed/templates/'+encodeURIComponent(endpointName.value)+'/execute')
const quoteTotalEndpoint=computed(()=>base+
  '/api/dynamics-connector/keyed/templates/crear_oferta/execute-with-total')
const quoteTotalExample=computed(()=>({
  connectionCode:connection.value,
  dholeRateId:'GUID_REAL_DE_LA_TARIFA_DHOLE',
  totalSaleAmount:3500,
  inputs:exampleBody.value.inputs
}))
const quoteTotalCurl=computed(()=>[
  'curl -X POST '+JSON.stringify(quoteTotalEndpoint.value),
  "  -H 'X-Dhole-Api-Key: <CLAVE_GENERADA_EN_DHOLE>'",
  "  -H 'Idempotency-Key: dhole-pricing-quote-<GUID_SIN_GUIONES>-v<REVISION>'",
  "  -H 'Content-Type: application/json'",
  "  --data '"+JSON.stringify(quoteTotalExample.value)+"'"
].join(' \\\n'))
const schemaEndpoint=computed(()=>base+'/api/dynamics-connector/keyed/templates/'+
  encodeURIComponent(endpointName.value)+'/schema?connectionCode='+encodeURIComponent(connection.value))
const schemaCurl=computed(()=>[
  'curl -X GET '+JSON.stringify(schemaEndpoint.value),
  "  -H 'X-Dhole-Api-Key: <CLAVE_GENERADA_EN_DHOLE>'"
].join(' \\\n'))
const sampleCurl=computed(()=>[
  'curl -X POST '+JSON.stringify(endpoint.value),
  "  -H 'X-Dhole-Api-Key: <CLAVE_GENERADA_EN_DHOLE>'",
  "  -H 'Idempotency-Key: <IDENTIFICADOR_UNICO_POR_OPERACION>'",
  "  -H 'Content-Type: application/json'",
  "  --data '"+JSON.stringify(exampleBody.value)+"'"
].join(' \\\n'))
async function prepareQuoteIntegration(){
  if(!canManage.value||!quoteSetupConfirm.value||quoteSetupBusy.value)return
  quoteSetupBusy.value=true
  quoteSetupError.value=''
  quoteSetupMessage.value=''
  try {
    const outcome=await fetchClient<{prepared:boolean;message:string}>(
      api('metadata/quote-integration/prepare'),{method:'POST',body:{confirm:true}})
    quoteSetupMessage.value=outcome.message
    quoteSetupConfirm.value=false
    await refresh()
  }catch(e){quoteSetupError.value=e instanceof Error?e.message:'No se pudo preparar la oferta.'}
  finally{quoteSetupBusy.value=false}
}
async function copy(value:string){await navigator.clipboard.writeText(value);success.value='Copiado al portapapeles.'}
function chooseOperation(op:Operation){
  if(operation.value!==op){operation.value=op;selected.value=[];chosenRelations.value={};exampleOptions.value={};keyName.value='';createdVersion.value=null;fieldVisibility.value='all'}
}
function changeTable(){selected.value=[];exampleOptions.value={};keyName.value='';createdVersion.value=null;fieldVisibility.value='all'}
function back(){if(step.value>1)step.value=(step.value-1) as 1|2|3|4}
function forward(){
  error.value=''
  if(step.value===1&&!table.value){error.value='Primero seleccioná una tabla habilitada en Catálogo.';return}
  if(step.value===2&&operation.value!=='delete'&&selectedFields.value.length===0){
    error.value='Elegí al menos un campo autorizado.';return
  }
  if(step.value===2&&(choicesLoading.value||choiceError.value)){
    error.value=choicesLoading.value?'Se están consultando las opciones en Dataverse.':
      'No se pudo consultar las opciones: '+choiceError.value;return
  }
  if(step.value===2&&metadataChoicesMissing.value.length){
    error.value='Dataverse no devolvió opciones para: '+
      metadataChoicesMissing.value.map(f=>f.logicalName).join(', ');return
  }
  if(step.value===2&&operation.value==='upsert'&&!selectedKey.value){
    error.value='Seleccioná una clave alternativa descubierta en Dataverse.';return
  }
  if(step.value===3&&!configValid.value){error.value=validationIssues.value.join(' ');return}
  if(step.value<4)step.value=(step.value+1) as 1|2|3|4
}
async function loadChoiceOptions(){
  const request=++choiceRequest
  const fields=optionFields.value.filter(f=>f.type!=='EntityName')
  liveChoices.value={}
  choiceError.value=''
  if(!fields.length){choicesLoading.value=false;return}
  choicesLoading.value=true
  try {
    const response=await fetchClient<{options:Record<string,Array<{value:number;label:string}>>}>(
      api('metadata/entities/'+encodeURIComponent(entity.value)+'/choices'),
      {method:'POST',body:{fields:fields.map(f=>f.logicalName)}})
    if(request!==choiceRequest)return
    liveChoices.value=response.options??{}
  } catch(e){
    if(request===choiceRequest)
      choiceError.value=e instanceof Error?e.message:'No se pudieron consultar las opciones en Dataverse.'
  } finally {
    if(request===choiceRequest)choicesLoading.value=false
  }
}
async function refresh(){
  if(!canManage.value)return
  busy.value=true;error.value=''
  try{
    const [meta,policy,summaries,keyList]=await Promise.all([
      fetchClient<Snapshot>(api('metadata'),{method:'GET'}),
      fetchClient<Policy>(api('metadata/policies'),{method:'GET'}),
      fetchClient<Summary[]>(api('templates'),{method:'GET'}),
      fetchClient<KeyInfo[]>(api('crud-keys'),{method:'GET'})
    ])
    snapshot.value=meta;policies.value=policy
    definitions.value=summaries;keys.value=keyList
    if(!tables.value.some(t=>t.logicalName===entity.value)){
      entity.value=tables.value[0]?.logicalName??''
      selected.value=[];chosenRelations.value={};relationModes.value={};lookupMatchFields.value={};
      exampleOptions.value={};createdVersion.value=null
    }
    void loadChoiceOptions()
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo cargar el catálogo.'}
  finally{busy.value=false}
}
async function reloadDefinitions(){
  definitions.value=await fetchClient<Summary[]>(api('templates'),{method:'GET'})
}
async function saveDefinition(){
  if(!canManage.value)return
  if(!configValid.value){
    error.value='No se puede guardar otra versión: '+validationIssues.value.join(' ')
    success.value=''
    return
  }
  busy.value=true;error.value='';success.value=''
  try{
    const response=await fetchClient<Summary>(
      api('templates/'+encodeURIComponent(endpointName.value)+'/versions'),
      {method:'POST',body:definition.value})
    const revision=response.history[0]
    if(!revision)throw new Error('El servidor no devolvió el número de versión guardada.')
    // Preserve the successful save even if refreshing the version list fails.
    createdVersion.value=revision.version
    definitions.value=[
      ...definitions.value.filter(t=>t.name!==response.name),
      response
    ]
    try{await reloadDefinitions()}catch{
      // The POST already persisted the revision. Its response is authoritative.
    }
    success.value='Versión v'+revision.version+' guardada como borrador. Seleccioná Activar versión v'+revision.version+' para publicarla.'
  }catch(e){error.value=describeCrudError(e,'Error guardando el comando.')}
  finally{busy.value=false}
}
async function activate(){
  if(!canManage.value||busy.value||!hasCurrentVersion.value)return
  busy.value=true;error.value='';success.value=''
  try{
    await fetchClient<Summary>(api('templates/'+encodeURIComponent(endpointName.value)+'/active'),
      {method:'PUT',body:{version:createdVersion.value}})
    await reloadDefinitions()
    success.value='Versión v'+createdVersion.value+' activada. Las escrituras de producción siguen sujetas a aprobación.'
  }catch(e){error.value=describeCrudError(e,'No se pudo activar.')}
  finally{busy.value=false}
}
const crudErrorReasons:Record<string,string>={
  crud_lookup_mapping_requires_oauth:'El conector estaba rechazando relaciones por nombre autorizadas; comprobá que esté desplegada la última versión del conector.',
  crud_lookup_mapping_not_approved:'Hay un campo de relación que no coincide con los metadatos de Dataverse. Revisá Cliente, Cuenta e IDTRA en el paso 2.',
  crud_field_denied:'Uno o más campos elegidos no tienen permiso de creación en Catálogo o cambiaron sus metadatos.',
  template_mapping_field_denied:'Una relación o campo del comando no conserva la autorización de Dataverse. Revisá Tabla y campos.',
  active_template_required:'Primero activá la versión de crear_oferta.',
  template_version_changed:'La versión activa cambió durante la operación. Recargá y generá una clave para la versión actual.',
  invalid_crud_key_request:'Verificá el nombre, vencimiento y límite de solicitudes de la clave.',
  approved_alternate_key_required:'UPSERT requiere una clave alternativa válida.',
  quote_lookup_name_field_not_authorized:'Falta lectura del campo elegido para buscar por nombre al cliente o IDTRA.'
}
function describeCrudError(value:unknown,fallback:string):string {
  if(value instanceof ApiError){
    const code=value.code??''
    const reason=crudErrorReasons[code]??value.message
    return (code?'Error '+code+' (HTTP '+(value.status??'?')+'): ':'')+reason
  }
  return value instanceof Error?value.message:fallback
}
async function issueKey(){
  if(!active.value||!canManage.value)return
  busy.value=true;error.value='';success.value=''
  try{
    issued.value=await fetchClient<Issued>(api('crud-keys'),{method:'POST',body:{
      templateName:endpointName.value,label:keyForm.value.label.trim(),
      expiresInDays:keyForm.value.expiresInDays,
      maxRequestsPerMinute:keyForm.value.maxRequestsPerMinute,
      keyFields:operation.value==='upsert'?selectedKey.value?.attributes??[]:[]
    }})
    keys.value=await fetchClient<KeyInfo[]>(api('crud-keys'),{method:'GET'})
    if(issued.value.key.templateName==='crear_oferta'&&
      issued.value.key.entityName==='quote'&&issued.value.key.operation==='create')
      quoteTotalGrantKeyId.value=issued.value.key.id
    success.value='Clave creada para la versión activa. Copiala ahora; no se mostrará nuevamente. Actualizá la configuración del backend de Pricing si usará esta clave.'
  }catch(e){error.value=describeCrudError(e,'No se pudo crear la clave.')}
  finally{busy.value=false}
}
const quoteTotalActiveVersion=computed(()=>definitions.value.find(t=>
  t.name==='crear_oferta')?.activeVersion??null)
const quoteTotalKeys=computed(()=>keys.value.filter(k=>k.templateName==='crear_oferta'&&
  k.entityName==='quote'&&k.operation==='create'&&k.enabled&&
  k.templateVersion===quoteTotalActiveVersion.value&&
  new Date(k.expiresAt).getTime()>Date.now()))
const outdatedQuoteTotalKeys=computed(()=>keys.value.filter(k=>
  k.templateName==='crear_oferta'&&k.entityName==='quote'&&
  k.operation==='create'&&k.enabled&&
  k.templateVersion!==quoteTotalActiveVersion.value))
const quoteTotalGrantHints:Record<string,string>={
  active_quote_template_key_not_found:'La clave no corresponde a la versión activa, venció o está revocada. Generá una nueva clave para crear_oferta y actualizá su secreto en Pricing.',
  quote_total_field_not_authorized:'Usá Preparar Oferta y Línea de oferta y verificá los permisos de creación de quotedetail.',
  quote_id_read_not_authorized:'Falta permiso de lectura del identificador principal de quote. Ejecutá Preparar Oferta y Línea de oferta.',
  quote_lookup_target_not_authorized:'Falta acceso de lectura al identificador de una tabla relacionada (cliente, cuenta o IDTRA). Revisá Catálogo.',
  quote_lookup_name_field_not_authorized:'Falta permiso de lectura sobre un campo de búsqueda por nombre de cliente o IDTRA. Revisá Catálogo.',
  crud_template_inactive:'Activá una versión de crear_oferta antes de autorizar.',
  table_denied:'Autorizá las tablas quote y quotedetail en Catálogo.'
}
async function approveQuoteTotalGrant(){
  if(!canManage.value||!quoteTotalGrantConfirm.value||!quoteTotalGrantKeyId.value||
    !quoteTotalKeys.value.some(k=>k.id===quoteTotalGrantKeyId.value))return
  quoteTotalGrantBusy.value=true
  quoteTotalGrantError.value=''
  quoteTotalGrantSuccess.value=''
  try{
    await fetchClient(api('quote-total-grants/'+encodeURIComponent(quoteTotalGrantKeyId.value)),{
      method:'POST'
    })
    quoteTotalGrantSuccess.value='Permisos aprobados: lectura del identificador de la oferta y creación de la línea de venta total. La API sigue usando la clave exclusiva y las políticas de Dataverse.'
    quoteTotalGrantConfirm.value=false
  }catch(e){
    if(e instanceof ApiError){
      const code=e.code??''
      quoteTotalGrantError.value='No se autorizó la línea de oferta'+
        (code?' ('+code+')':'')+'. '+(quoteTotalGrantHints[code]??e.message)
    }else quoteTotalGrantError.value=e instanceof Error?e.message:
      'No se pudieron aprobar los permisos. Verificá los campos de Oferta y Línea de oferta en Catálogo.'
  }finally{quoteTotalGrantBusy.value=false}
}
async function revoke(id:string){
  busy.value=true;error.value=''
  try{
    await fetchClient(api('crud-keys/'+encodeURIComponent(id)),{method:'DELETE'})
    if(issued.value?.key.id===id)issued.value=null
    keys.value=await fetchClient<KeyInfo[]>(api('crud-keys'),{method:'GET'})
    success.value='Acceso revocado.'
  }catch(e){error.value=describeCrudError(e,'No se pudo revocar.')}
  finally{busy.value=false}
}
function inspect(t:Summary){
  // Prefer the latest revision, including an inactive draft, so it can be
  // activated from the library instead of reopening an older active revision.
  const version=t.history[0]??t.history.find(h=>h.version===t.activeVersion)
  if(!version||!['create','update','upsert','delete'].includes(version.definition.operation))return
  const tableInfo=snapshot.value?.catalog.tables.find(x=>x.logicalName===version.definition.entityName)
  endpointName.value=t.name
  operation.value=version.definition.operation as Operation
  entity.value=version.definition.entityName
  const restoredFields=new Set<string>()
  const restoredRelations:Record<string,string>={}
  const restoredModes:Record<string,'name'|'guid'>={}
  const restoredMatchFields:Record<string,string>={}
  // Inputs are the original UI fields; OData navigation targets are NOT field names.
  for(const mapping of version.definition.mappings){
    const field=tableInfo?.columns.find(f=>f.logicalName===mapping.source)
      ??tableInfo?.columns.find(f=>f.logicalName===mapping.target)
    if(!field)continue
    restoredFields.add(field.logicalName)
    if(mapping.target.endsWith('@odata.bind')){
      const navigation=mapping.target.slice(0,-'@odata.bind'.length)
      const relationship=tableInfo?.relationships?.find(r=>
        r.kind==='ManyToOneRelationships'&&r.referencingNavigation===navigation&&
        r.referencingAttribute===field.logicalName)
      if(relationship)restoredRelations[field.logicalName]=navigation
      const named=mapping.steps?.find(step=>step.op==='lookup_name')
      restoredModes[field.logicalName]=named?'name':'guid'
      if(named?.argument)restoredMatchFields[field.logicalName]=named.argument
    }
  }
  selected.value=[...restoredFields]
  chosenRelations.value=restoredRelations
  relationModes.value=restoredModes
  lookupMatchFields.value=restoredMatchFields
  exampleOptions.value={}
  choiceError.value=''
  error.value=''
  success.value=''
  createdVersion.value=version.version
  step.value=4
  issued.value=null
  if(!tableInfo)error.value='La tabla de esta versión no está en el catálogo actual. Revisá Catálogo antes de guardar otra versión.'
  else if(!restoredFields.size&&version.definition.operation!=='delete')
    error.value='No se pudieron recuperar los campos de esta versión. Revisá Tabla y campos antes de guardar.'
}
watch(()=>props.connections, list=>{
  if(list.length&&!list.some(x=>x.code===connection.value))connection.value=list[0]!.code
},{immediate:true,deep:true})
watch(connection,()=>{createdVersion.value=null;issued.value=null;void refresh()})
watch(quoteTotalKeys, valid=>{
  if(!valid.some(key=>key.id===quoteTotalGrantKeyId.value))
    quoteTotalGrantKeyId.value=valid.length===1?valid[0]!.id:''
})
watch(()=>[connection.value,entity.value,selected.value.slice().sort().join(',')].join('|'),
  ()=>{void loadChoiceOptions()})
onMounted(refresh)
</script>

<template>
  <section class="crud-integration">
    <header class="crud-header">
      <div><p class="crud-eyebrow">DYNAMICS 365 · INTEGRACIONES EXTERNAS</p>
        <h2>Constructor de APIs CRUD</h2>
        <p>Creá comandos reutilizables para Pangolin o cualquier otro sistema. Se publican como una API; no se ejecutan al diseñarlos.</p></div>
      <button class="crud-secondary" type="button" :disabled="busy" @click="refresh"><RefreshCw :size="15"/> Recargar</button>
    </header>
    <label class="crud-field crud-connection">Conexión Dataverse
      <select v-model="connection"><option v-for="c in connections" :key="c.code" :value="c.code">{{ c.code }}</option></select>
    </label>
    <div class="crud-note"><ShieldCheck :size="18"/>
      <p>Las APIs requieren una clave única de Dhole, no un inicio de sesión del sistema externo. CREATE, UPDATE, UPSERT y DELETE siguen sujetos a los permisos aprobados y al bloqueo de escrituras de producción.</p>
    </div>
    <p v-if="!canManage" class="crud-error">Para administrar comandos necesitás dynamics.security.admin.</p>
    <template v-else>
      <nav class="crud-steps" aria-label="Pasos para crear una API CRUD">
        <button v-for="(title,index) in steps" :key="title" type="button"
          :class="{current:step===index+1,complete:step>index+1}"
          :disabled="index+1>step" @click="step=(index+1) as 1|2|3|4">
          <span>{{ index+1 }}</span>{{ title }}</button>
      </nav>
      <div class="crud-stage">
        <template v-if="step===1">
          <p class="crud-eyebrow">PASO 1 · OPERACIÓN</p><h3>¿Qué comando querés publicar?</h3>
          <div class="crud-operation-list">
            <button v-for="op in operations" :key="op.value" type="button"
              :class="{selected:operation===op.value}" @click="chooseOperation(op.value)">
              <strong>{{ op.name }}</strong><span>{{ op.description }}</span></button>
          </div>
          <div class="crud-two">
            <label class="crud-field">Tabla de Dataverse
              <select v-model="entity" @change="changeTable">
                <option v-for="t in tables" :key="t.logicalName" :value="t.logicalName">
                  {{ display(t.labels,t.logicalName) }} ({{ t.logicalName }})
                </option>
              </select>
            </label>
            <div class="crud-info"><Database :size="18"/>
              <span>{{ table ? 'Tabla: '+table.logicalName : 'No hay tablas habilitadas' }}.
                Solo se muestran tablas autorizadas en Catálogo.</span>
            </div>
          </div>
          <button v-if="!tables.length" class="crud-secondary" type="button"
            @click="emit('navigate','catalog')">Autorizar tablas y campos</button>
          <p class="crud-help">¿Querés consultar registros? Utilizá <button class="crud-link" type="button"
            @click="emit('navigate','query')">Query Builder</button> para publicar endpoints de lectura.</p>
        </template>
        <template v-else-if="step===2">
          <p class="crud-eyebrow">PASO 2 · CAMPOS PERMITIDOS</p>
          <h3>{{ operation==='delete'?'Confirmá qué tabla se podrá eliminar':'¿Qué campos podrá recibir esta API?' }}</h3>
          <template v-if="operation==='delete'">
            <div class="crud-info"><ShieldCheck :size="18"/>
              DELETE requiere el GUID del registro, su ETag y una confirmación con motivo.
              La política de borrado de la tabla y la aprobación independiente de producción siguen siendo obligatorias.</div>
          </template>
          <template v-else>
          <div v-if="entity==='quote'&&operation==='create'" class="crud-card">
            <h4>Preparar Oferta, Cliente, IDTRA y Línea de oferta</h4>
            <p class="crud-help">
              <strong>quotedetail</strong> es una tabla aparte de <strong>quote</strong>.
              Esta acción descubre las relaciones reales y habilita solo los permisos mínimos
              de lectura y creación para calcular el importe total. No crea ofertas.
            </p>
            <div v-if="quoteDetailTable" class="crud-quote-detail-panel">
              <h4>Línea de oferta (quotedetail) · {{ quoteDetailTable.columns.length }} campos descubiertos</h4>
              <p class="crud-help">Los campos de quotedetail no forman parte de quote. La integración
                crear_oferta crea la línea por separado para calcular totalamount;
                no tenés que añadir esos campos al comando de cabecera.</p>
              <div class="crud-quote-requirements">
                <div v-for="item in quoteDetailStatus" :key="item.name" class="crud-quote-requirement">
                  <code>{{ item.name }}</code>
                  <span :class="item.authorized?'crud-quote-enabled':'crud-quote-restricted'">
                    {{ item.authorized?'Creación autorizada':item.discovered?'Falta autorización':'No descubierto' }}
                  </span>
                </div>
              </div>
              <button class="crud-secondary" type="button" @click="showQuoteDetailFields=!showQuoteDetailFields">
                {{ showQuoteDetailFields?'Ocultar campos de quotedetail':'Ver todos los campos de quotedetail' }}
              </button>
              <div v-if="showQuoteDetailFields" class="crud-quote-detail-results">
                <label class="crud-field">Buscar campo en quotedetail
                  <input v-model.trim="quoteDetailSearch" placeholder="Nombre comercial o técnico"></label>
                <p class="crud-help">{{ filteredQuoteDetailFields.length }} campos encontrados en quotedetail.
                  Para crear una API de línea independiente seleccioná quotedetail en el paso Operación.
                  Los campos calculados de Dataverse son de solo lectura.</p>
                <div v-for="field in filteredQuoteDetailFields.slice(0,150)" :key="field.logicalName"
                  class="crud-quote-detail-row">
                  <span>{{ display(field.labels,field.logicalName) }} <code>{{ field.logicalName }}</code></span>
                  <small>{{ field.canCreate?'Admite creación':'Solo lectura / administrado' }}</small>
                </div>
                <p v-if="filteredQuoteDetailFields.length>150" class="crud-help">
                  Mostrando los primeros 150; filtrá por nombre para encontrar otro campo.</p>
              </div>
            </div>
            <p v-else class="crud-error">quotedetail aún no aparece en los metadatos.
              Ejecutá la preparación y recargá el catálogo de Dynamics.</p>
            <label class="crud-field">
              <input v-model="quoteSetupConfirm" type="checkbox">
              Confirmo habilitar los metadatos y permisos mínimos de Quote y Línea de oferta.
            </label>
            <button type="button" class="crud-primary"
              :disabled="!canManage||!quoteSetupConfirm||quoteSetupBusy"
              @click="prepareQuoteIntegration">
              {{ quoteSetupBusy?'Preparando...':'Preparar Oferta y Línea de oferta' }}
            </button>
            <p v-if="quoteSetupMessage" class="crud-info" role="status">{{ quoteSetupMessage }}</p>
            <p v-if="quoteSetupError" class="crud-error" role="alert">{{ quoteSetupError }}</p>
          </div>
            <div class="crud-two">
              <label class="crud-field">Buscar en todos los campos
                <input v-model="fieldSearch" placeholder="Nombre comercial o técnico, incluso no autorizados"></label>
              <div class="crud-info">{{ selectedFields.length }} / {{ MAX_COMMAND_FIELDS }} seleccionados por comando ·
                {{ fieldAvailability.length }} campos descubiertos en {{ entity }}</div>
            </div>
            <div class="crud-field-visibility" role="group" aria-label="Filtrar campos por disponibilidad">
              <button type="button" :class="{active:fieldVisibility==='all'}"
                @click="fieldVisibility='all'">Todos ({{ fieldAvailability.length }})</button>
              <button type="button" :class="{active:fieldVisibility==='selectable'}"
                @click="fieldVisibility='selectable'">Seleccionables ({{ eligibleFields.length }})</button>
              <button type="button" :class="{active:fieldVisibility==='restricted'}"
                @click="fieldVisibility='restricted'">No seleccionables ({{ restrictedCount }})</button>
            </div>
            <div class="crud-field-actions">
              <span class="crud-help">
                {{ requiresPermissionCount }} campos necesitan permisos en Catálogo.
                Se pueden elegir hasta {{ MAX_COMMAND_FIELDS }} campos por API; los demás seguirán visibles.
              </span>
              <button class="crud-secondary" type="button" @click="selectVisibleFields"
                :disabled="selected.length>=MAX_COMMAND_FIELDS || !filteredFields.some(item=>item.selectable&&!selected.includes(item.field.logicalName))">
                Seleccionar disponibles
              </button>
              <button class="crud-secondary" type="button" :disabled="selected.length===0"
                @click="clearSelectedFields">Limpiar selección</button>
              <button class="crud-secondary" type="button" @click="emit('navigate','catalog')">
                Revisar y habilitar permisos
              </button>
              <button class="crud-secondary" type="button" :disabled="busy"
                @click="refresh">Recargar campos</button>
            </div>
            <div class="crud-check-list">
              <label v-for="item in filteredFields" :key="item.field.logicalName"
                :class="{ 'crud-field-unavailable': !item.selectable }"
                :title="item.reason">
                <input v-model="selected" type="checkbox" :value="item.field.logicalName"
                  :disabled="!item.selectable || (!selected.includes(item.field.logicalName)&&selected.length>=MAX_COMMAND_FIELDS)">
                <span>
                  <strong>{{ display(item.field.labels,item.field.logicalName) }}</strong>
                  <small>{{ item.field.logicalName }} · {{ item.field.type }}</small>
                  <small :class="item.selectable ? 'crud-field-available-note' : 'crud-field-unavailable-note'">
                    {{ item.reason }}
                  </small>
                  <small v-if="item.selectable&&relationshipTypes.has(item.field.type)">
                    Relación con {{ lookupOptions(item.field).map(r=>r.referencedEntity).join(' / ') }} · búsqueda por nombre o GUID.
                  </small>
                </span>
              </label>
              <div v-if="!filteredFields.length" class="crud-info">
                Ningún campo coincide con esta búsqueda o filtro. Probá «Todos» o borrá la búsqueda.
              </div>
            </div>
            <p v-if="!eligibleFields.length" class="crud-info" role="status">
              Aún no hay campos habilitados para {{ operation.toUpperCase() }}.
              En Catálogo → Oferta → Habilitar todos, seleccioná «Lectura, creación y edición»
              y luego presioná «Recargar campos» aquí. Los atributos calculados y relaciones de solo
              lectura no se pueden activar para escritura directa.
            </p>
            <div v-if="selectedLookups.length" class="crud-options-panel">
              <h4>Relaciones con registros existentes en Dynamics</h4>
              <p>Ingresá el nombre del cliente y el número o título del IDTRA: Dhole buscará
                automáticamente el registro único, resolverá su GUID y creará el vínculo
                (<code>@odata.bind</code>). Si tenés el GUID también podés usarlo.
                El IDTRA textual se conserva en <code>new_idtraasignado</code>.</p>
              <div class="crud-options-grid">
                <label v-for="field in selectedLookups" :key="field.logicalName" class="crud-field">
                  <span>{{ display(field.labels,field.logicalName) }} · {{ field.logicalName }}</span>
                  <select :value="chosenLookup(field)?.referencingNavigation"
                    @change="chosenRelations={...chosenRelations,[field.logicalName]:($event.target as HTMLSelectElement).value}">
                    <option v-for="rel in lookupOptions(field)" :key="rel.referencingNavigation ?? ''"
                      :value="rel.referencingNavigation ?? ''">
                      {{ rel.referencedEntity }} · {{ rel.referencingNavigation }}
                    </option>
                  </select>
                  <span>Cómo identificar el registro</span>
                  <select :value="relationMode(field)"
                    @change="relationModes={...relationModes,[field.logicalName]:($event.target as HTMLSelectElement).value as 'name'|'guid'}">
                    <option value="name" :disabled="!readableNameFields(field).length">Nombre o número (búsqueda exacta automática)</option>
                    <option value="guid">GUID del sistema externo</option>
                  </select>
                  <template v-if="relationMode(field)==='name'">
                    <span>Campo de Dataverse utilizado para buscar</span>
                    <select :value="selectedNameField(field)"
                      @change="lookupMatchFields={...lookupMatchFields,[field.logicalName]:($event.target as HTMLSelectElement).value}">
                      <option v-for="candidate in readableNameFields(field)" :key="candidate.logicalName"
                        :value="candidate.logicalName">
                        {{ display(candidate.labels,candidate.logicalName) }} · {{ candidate.logicalName }}
                      </option>
                    </select>
                    <small>La búsqueda debe devolver exactamente un registro. Si falta o hay duplicados se rechaza la creación.</small>
                  </template>
                  <small v-else>Se requiere un GUID real del registro de {{ chosenLookup(field)?.referencedEntity }}.</small>
                </label>
              </div>
            </div>
            <div v-if="optionFields.length" class="crud-options-panel">
              <h4>Opciones reales de Dynamics — sin buscar IDs</h4>
              <p>Seleccioná la opción por su nombre. Dhole utiliza automáticamente el valor técnico al generar el ejemplo de solicitud.</p>
              <p v-if="choicesLoading" class="crud-help" role="status">Consultando opciones del campo en Dynamics...</p>
              <p v-if="choiceError" class="crud-error" role="alert">{{ choiceError }}</p>
              <div class="crud-options-grid">
                <label v-for="field in optionFields" :key="field.logicalName" class="crud-field">
                  <span>{{ display(field.labels,field.logicalName) }} · {{ field.type }}</span>
                  <select :value="chosenValue(field)" :disabled="choicesLoading||choicesFor(field).length===0"
                    @change="setExampleOption(field,($event.target as HTMLSelectElement).value)">
                    <option v-for="opt in choicesFor(field)" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                  <small v-if="field.type==='EntityName'">
                    Se envía el nombre lógico de la tabla, no un GUID de registro.
                  </small>
                  <small v-else-if="field.logicalName==='new_equipo'">
                    Se envía el nombre del equipo. El conector busca la opción exacta y utiliza
                    internamente su número de Picklist de Dataverse.
                  </small>
                  <small v-else>
                    Se envía el valor numérico de esta lista de opciones de Dataverse.
                    {{ choicesFor(field).length }} opciones descubiertas.
                  </small>
                </label>
              </div>
              <p v-if="metadataChoicesMissing.length && !choicesLoading && !choiceError" class="crud-error">
                No se encontraron opciones para {{ metadataChoicesMissing.map(f=>f.logicalName).join(', ') }}.
                Consultá las opciones de nuevo; no se publicará una API con valores inventados.
              </p>
            </div>
            <label v-if="operation==='upsert'" class="crud-field">Clave alternativa de Dataverse
              <select v-model="keyName"><option value="">Seleccionar clave</option>
                <option v-for="key in eligibleKeys" :key="key.logicalName" :value="key.logicalName">
                  {{ key.logicalName }} · {{ key.attributes.join(', ') }}
                </option></select>
            </label>
            <p v-if="operation==='upsert'&&!eligibleKeys.length" class="crud-error">
              Esta tabla aún no tiene claves alternativas descubiertas. El UP SERT no puede publicarse sin una clave válida.</p>
          </template>
        </template>
        <template v-else-if="step===3">
          <p class="crud-eyebrow">PASO 3 · CONFIGURAR ENDPOINT</p>
          <h3>Definí cómo identificar el comando</h3>
          <label class="crud-field">Nombre público del comando
            <input v-model.trim="endpointName" maxlength="80" placeholder="crear_oferta">
            <small>Ejemplo: crear_oferta. Se usa en la URL; no incluye contraseñas.</small></label>
          <div class="crud-info">Operación <strong>{{ operation.toUpperCase() }}</strong> ·
            Tabla <strong>{{ entity }}</strong> · {{ selectedFields.length }} campos de escritura.</div>
          <div v-if="optionFields.length" class="crud-info">
            Las Picklist tienen códigos propios por campo; EntityName utiliza nombres lógicos.
            Los ejemplos de abajo usan opciones reales del catálogo, nunca IDs inventados.
          </div>
          <details open class="crud-details">
            <summary>Ejemplo de JSON con las opciones que seleccionaste</summary>
            <pre>{{ JSON.stringify(exampleBody,null,2) }}</pre>
            <button type="button" class="crud-secondary" @click="copy(JSON.stringify(exampleBody,null,2))">
              <Copy :size="14"/> Copiar JSON
            </button>
          </details>
          <details class="crud-details">
            <summary>Ver definición técnica del comando</summary>
            <pre>{{ JSON.stringify(definition,null,2) }}</pre>
          </details>
          <div class="crud-note"><ShieldCheck :size="17"/>
            <p>Al guardar se crea una versión inactiva. No se ejecutan registros de Dataverse.
              Podés activarla expresamente en el siguiente paso.</p>
          </div>
        </template>
        <template v-else>
          <p class="crud-eyebrow">PASO 4 · PUBLICAR</p>
          <h3>Publicá tu comando para otras aplicaciones</h3>
          <div class="crud-info">Comando <strong>{{ endpointName }}</strong> ·
            {{ operation.toUpperCase() }} sobre {{ entity }} ·
            {{ selectedFields.length }} campos elegidos.</div>
          <div class="crud-actions">
            <button class="crud-primary" type="button" :disabled="busy"
              @click="saveDefinition">{{ selectedTemplate?'1. Guardar nueva versión':'1. Guardar primera versión' }}</button>
            <button class="crud-secondary" type="button" :disabled="busy||!hasCurrentVersion||active"
              @click="activate">{{ active?'Versión v'+createdVersion+' activa':
                hasCurrentVersion?'2. Activar versión v'+createdVersion:'2. Guardá una versión primero' }}</button>
          </div>
          <p v-if="hasCurrentVersion" class="crud-info" role="status">
            Versión guardada: v{{ createdVersion }} ·
            {{ active?'Activa': 'Borrador pendiente de activación' }}.
          </p>
          <div v-if="hasCurrentVersion&&unsavedChanges" class="crud-note" role="status">
            <ShieldCheck :size="17"/>
            <p>El formulario tiene diferencias respecto a la versión v{{ createdVersion }} guardada.
              El botón Activar publicará exactamente esa versión guardada, no los cambios
              sin guardar. Para publicar estos últimos, pulsá Guardar nueva versión primero.</p>
          </div>
          <div v-if="validationIssues.length" class="crud-card">
            <h4>Revisá estos requisitos antes de guardar otra versión</h4>
            <p v-for="issue in validationIssues" :key="issue" class="crud-error">{{ issue }}</p>
            <button class="crud-secondary" type="button" @click="step=2">Volver a Tabla y campos</button>
          </div>
          <div v-if="active" class="crud-card">
            <h4>3. Generar clave exclusiva para esta integración</h4>
            <div class="crud-two">
              <label class="crud-field">Nombre de aplicación
                <input v-model.trim="keyForm.label" maxlength="120" placeholder="Pangolin"></label>
              <label class="crud-field">Vencimiento (1 a 90 días)
                <input v-model.number="keyForm.expiresInDays" type="number" min="1" max="90"></label>
              <label class="crud-field">Solicitudes por minuto (1 a 120)
                <input v-model.number="keyForm.maxRequestsPerMinute" type="number" min="1" max="120"></label>
            </div>
            <button class="crud-primary" type="button"
              :disabled="busy||keyForm.label.trim().length<2||keyForm.expiresInDays<1||
                keyForm.expiresInDays>90||keyForm.maxRequestsPerMinute<1||keyForm.maxRequestsPerMinute>120"
              @click="issueKey"><KeyRound :size="15"/> Generar clave API</button>
          </div>
          <div v-if="issued" class="crud-card">
            <strong>Clave generada (se muestra una sola vez)</strong>
            <p>Guardala como secreto en el backend del sistema consumidor, nunca en el navegador ni dentro de la URL.</p>
            <code class="crud-secret">{{ issued.apiKey }}</code>
            <div class="crud-actions">
              <button class="crud-primary" type="button" @click="copy(issued.apiKey)"><Copy :size="14"/> Copiar clave</button>
              <button class="crud-secondary" type="button" @click="issued=null">Ya la guardé · ocultar</button>
            </div>
          </div>
          <div v-if="endpointName==='crear_oferta'&&entity==='quote'&&operation==='create'" class="crud-card">
            <h4>Importe total de Oferta calculado por Dataverse</h4>
            <p class="crud-help">
              La integración de Pricing crea la cabecera y una línea de venta (quotedetail)
              con cantidad 1 y el importe de venta como precio. Dataverse calcula
              <code>totalamount</code>. No se escribe <code>msdyn_invoicesetuptotals</code>.
            </p>
            <p class="crud-help">
              Prepará primero ambas tablas con el botón anterior. quotedetail nunca aparecerá
              como un campo de quote. Después verificá en Catálogo las capacidades de <strong>Oferta (quote)</strong>
              y <strong>Línea de oferta (quotedetail)</strong>. Para la línea se requieren:
              <code>quoteid</code>, <code>isproductoverridden</code>, <code>ispriceoverridden</code>,
              <code>productdescription</code>, <code>quotedetailname</code>, <code>quantity</code>
              y <code>priceperunit</code>; la cabecera requiere lectura de su identificador.
            </p>
            <div class="crud-actions">
              <button type="button" class="crud-secondary" @click="emit('navigate','catalog')">
                Abrir Catálogo para autorizar campos
              </button>
            </div>
            <label class="crud-field">Clave de integración de Pricing autorizada
              <select v-model="quoteTotalGrantKeyId">
                <option value="">Seleccionar clave activa de crear_oferta</option>
                <option v-for="key in quoteTotalKeys" :key="key.id" :value="key.id">
                  {{ key.label }} · v{{ key.templateVersion }} · {{ key.id }}
                </option>
              </select>
            </label>
            <p v-if="!quoteTotalKeys.length" class="crud-error">
              No hay una clave vigente para la versión activa
              {{ quoteTotalActiveVersion?'v'+quoteTotalActiveVersion:'(ninguna)' }} de crear_oferta.
              Generá una clave en esta versión y actualizá el secreto del backend de Pricing.
            </p>
            <p v-if="outdatedQuoteTotalKeys.length" class="crud-help">
              {{ outdatedQuoteTotalKeys.length }} clave(s) de versiones anteriores se ocultan:
              el conector no las acepta con la versión actual.
            </p>
            <label class="crud-field">
              <input v-model="quoteTotalGrantConfirm" type="checkbox">
              Confirmo que autorizo a esta clave a leer el identificador de Oferta y crear
              únicamente los campos de la línea necesarios para calcular la venta total.
            </label>
            <button type="button" class="crud-primary"
              :disabled="quoteTotalGrantBusy||!quoteTotalGrantConfirm||!quoteTotalGrantKeyId"
              @click="approveQuoteTotalGrant">
              {{ quoteTotalGrantBusy?'Autorizando...':'Autorizar creación de línea y total' }}
            </button>
            <p v-if="quoteTotalGrantError" class="crud-error" role="alert">{{ quoteTotalGrantError }}</p>
            <p v-if="quoteTotalGrantSuccess" class="crud-info" role="status">{{ quoteTotalGrantSuccess }}</p>
            <div class="crud-options-panel">
              <h4>Probar aceptación de tarifa con importe total</h4>
              <p>Al aceptar una tarifa con IDTRA, DholePricing usa esta API especial
                para crear la oferta y la línea quotedetail automáticamente.
                No agregués los campos de quotedetail dentro de inputs:
                enviá totalSaleAmount fuera de inputs y el GUID real de la tarifa.</p>
              <code class="crud-secret">{{ quoteTotalEndpoint }}</code>
              <div class="crud-actions">
                <button class="crud-secondary" type="button" @click="copy(quoteTotalEndpoint)">
                  <Copy :size="14"/> Copiar endpoint con total
                </button>
                <button class="crud-secondary" type="button" @click="copy(quoteTotalCurl)">
                  <Copy :size="14"/> Copiar cURL de ejemplo
                </button>
              </div>
              <p class="crud-help">El cURL es solo una plantilla: reemplazá el GUID,
                la revisión, los valores de ejemplo y la clave antes de usarlo.
                Reutilizá el mismo Idempotency-Key para los reintentos de una misma revisión.
                La API estándar /execute solo crea la cabecera y no su línea.</p>
              <details class="crud-details">
                <summary>Ver JSON de aceptación y ejemplo cURL</summary>
                <pre>{{ JSON.stringify(quoteTotalExample,null,2) }}</pre>
                <pre>{{ quoteTotalCurl }}</pre>
              </details>
            </div>
          </div>
          <div class="crud-card">
            <h4>URL HTTP para Pangolin o cualquier otra aplicación</h4>
            <code class="crud-secret">{{ endpoint }}</code>
            <button type="button" class="crud-secondary" @click="copy(endpoint)"><Copy :size="15"/> Copiar URL</button>
            <p>La API se consume mediante POST, enviando las cabeceras X-Dhole-Api-Key e Idempotency-Key.
              Los valores Picklist y EntityName del ejemplo se toman de los metadatos reales.</p>
            <div class="crud-options-panel">
              <h4>Consultar opciones desde otra aplicación</h4>
              <p>Pangolin u otro sistema puede obtener los nombres y los valores permitidos
                mediante este endpoint GET protegido con la misma clave, sin tener que conocer los IDs.</p>
              <code class="crud-secret">{{ schemaEndpoint }}</code>
              <div class="crud-actions">
                <button type="button" class="crud-secondary" @click="copy(schemaEndpoint)">
                  <Copy :size="14"/> Copiar URL de opciones
                </button>
                <button type="button" class="crud-secondary" @click="copy(schemaCurl)">
                  <Copy :size="14"/> Copiar cURL de opciones
                </button>
              </div>
            </div>
            <details class="crud-details">
              <summary>Ver y copiar ejemplo cURL (sin secretos reales)</summary>
              <pre>{{ sampleCurl }}</pre>
              <button type="button" class="crud-secondary" @click="copy(sampleCurl)">Copiar cURL</button>
            </details>
            <p v-if="operation==='update'||operation==='delete'">
              Para UPDATE y DELETE se obtiene el GUID y ETag actuales desde una consulta de lectura
              (Query Builder); no hay que adivinar el ID del registro.
              La API rechaza una versión desactualizada o un borrado sin motivo.
            </p>
          </div>
        </template>
      </div>
      <p v-if="error" class="crud-error" role="alert">{{ error }}</p>
      <p v-if="success" class="crud-success" role="status"><Check :size="15"/> {{ success }}</p>
      <footer class="crud-footer">
        <button type="button" class="crud-secondary" :disabled="step===1" @click="back"><ArrowLeft :size="15"/> Anterior</button>
        <span>Paso {{ step }} de 4</span>
        <button v-if="step<4" class="crud-primary" type="button" :disabled="busy" @click="forward">Siguiente <ArrowRight :size="15"/></button>
      </footer>
      <div class="crud-library">
        <h3>Comandos publicados y borradores</h3>
        <p>Seleccioná una plantilla existente para revisar su versión y generar una clave de acceso.</p>
        <div v-for="template in definitions.filter(t=>
          ['create','update','upsert','delete'].includes(t.history[0]?.definition.operation??''))"
          :key="template.id" class="crud-library-row">
          <span><strong>{{ template.name }}</strong>
            <small>{{ template.history[0]?.definition.operation.toUpperCase() }} ·
              {{ template.history[0]?.definition.entityName }} ·
              Última v{{ template.history[0]?.version }} ·
              {{ template.activeVersion?'Activa v'+template.activeVersion:'Sin versión activa' }}</small></span>
          <button class="crud-secondary" type="button" @click="inspect(template)">Abrir última versión</button>
        </div>
        <div v-if="!definitions.length" class="crud-info">Todavía no hay comandos configurados.</div>
        <h3>Claves de acceso emitidas</h3>
        <div v-for="key in keys" :key="key.id" class="crud-library-row">
          <span><strong>{{ key.label }}</strong><small>{{ key.templateName }} · {{ key.operation.toUpperCase() }} ·
            {{ key.enabled?'Habilitada':'Revocada' }} · Vence {{ new Date(key.expiresAt).toLocaleDateString('es-CR') }}</small></span>
          <button v-if="key.enabled" type="button" class="crud-secondary" :disabled="busy"
            @click="revoke(key.id)">Revocar</button>
        </div>
        <details class="crud-details"><summary>CRUD manual (administración avanzada)</summary>
          <p>Usá el editor de registros para mantenimiento puntual; no hace falta para crear las APIs.</p>
          <button class="crud-secondary" type="button" @click="emit('navigate','crud')">Abrir editor manual</button>
        </details>
      </div>
    </template>
  </section>
</template>

<style scoped>
.crud-integration{padding:22px;background:var(--dh-card);border:1px solid var(--dh-border);border-radius:16px;color:var(--dh-text);font-size:12px}
.crud-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
.crud-header h2{font-size:20px;font-weight:850;margin:4px 0 8px}.crud-header p{max-width:780px;margin:0;color:var(--dh-text-muted);line-height:1.6}
.crud-eyebrow{font-size:10px;letter-spacing:.07em;color:var(--dh-primary)!important;font-weight:850}
.crud-field{display:flex;flex-direction:column;gap:8px;font-weight:750;margin:12px 0}
.crud-field input,.crud-field select{padding:12px;width:100%;min-width:0;color:var(--dh-text);background:var(--dh-surface);border:1px solid var(--dh-border-strong);border-radius:10px;font-size:12px}
.crud-field small{color:var(--dh-text-muted);font-size:11px;font-weight:400}
.crud-quote-detail-panel{margin:14px 0;padding:14px;border:1px solid var(--dh-border);border-radius:12px;background:var(--dh-card)}
.crud-quote-detail-panel h4{margin:0 0 10px}
.crud-quote-requirements{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin:12px 0}
.crud-quote-requirement,.crud-quote-detail-row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:9px;border-bottom:1px solid var(--dh-border)}
.crud-quote-enabled{color:var(--dh-text)}
.crud-quote-restricted{color:var(--dh-text-muted)}
.crud-quote-detail-results{margin-top:12px;max-height:390px;overflow-y:auto}
.crud-quote-detail-row code{margin-left:8px}
.crud-quote-detail-row small{color:var(--dh-text-muted)}
.crud-connection{max-width:480px}.crud-note,.crud-info{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--dh-border);background:var(--dh-surface);border-radius:11px;color:var(--dh-text-soft);line-height:1.6;margin:15px 0}
.crud-note p{margin:0}.crud-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:18px 0}
.crud-steps button{display:flex;gap:9px;align-items:center;padding:11px;border:1px solid var(--dh-border);background:var(--dh-surface);color:var(--dh-text-muted);font-size:11px;font-weight:800;border-radius:11px}
.crud-steps button>span{width:23px;height:23px;display:grid;place-items:center;flex-shrink:0;border:1px solid var(--dh-border-strong);border-radius:50%}
.crud-steps button.current{border-color:var(--dh-primary);color:var(--dh-text)}.crud-steps button.current>span{background:var(--dh-primary);color:white}
.crud-steps button:disabled{opacity:.65}.crud-stage{background:var(--dh-surface);padding:22px;border:1px solid var(--dh-border);border-radius:14px}
.crud-stage h3{font-size:17px;margin:5px 0 14px}.crud-operation-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
.crud-operation-list button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:8px;min-height:95px;padding:17px;background:var(--dh-card);border:1px solid var(--dh-border);border-radius:12px;color:var(--dh-text)}
.crud-operation-list button.selected{border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 7%,var(--dh-card))}
.crud-field-visibility{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px}
.crud-field-visibility button{padding:9px 13px;border-radius:12px;border:1px solid var(--dh-border);color:var(--dh-text);font-size:12px;font-weight:750;background:var(--dh-card)}
.crud-field-visibility button.active{border-color:var(--dh-primary);color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 9%,var(--dh-card))}
.crud-field-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:14px}
.crud-field-actions .crud-help{flex:1 1 100%;font-size:12px}
.crud-check-list label.crud-field-unavailable{opacity:.76;border-style:dashed}
.crud-check-list label.crud-field-unavailable input{cursor:not-allowed}
.crud-check-list .crud-field-unavailable-note{color:var(--dh-text-muted);white-space:normal}
.crud-check-list .crud-field-available-note{color:var(--dh-primary);white-space:normal}

.crud-operation-list strong{font-size:14px}.crud-operation-list span,.crud-help{color:var(--dh-text-muted);line-height:1.5}
.crud-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}.crud-check-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:420px;overflow:auto}
.crud-check-list label{display:flex;gap:10px;align-items:flex-start;padding:12px;background:var(--dh-card);border:1px solid var(--dh-border);border-radius:10px;cursor:pointer}
.crud-check-list label:has(input:checked){border-color:var(--dh-primary)}.crud-check-list input{margin-top:3px}.crud-check-list small{display:block;color:var(--dh-text-muted);margin-top:4px}
.crud-options-panel{margin:16px 0;padding:16px;background:var(--dh-card);border:1px solid var(--dh-border);border-radius:11px}
.crud-options-panel h4{font-size:14px;margin:0 0 7px}
.crud-options-panel p{color:var(--dh-text-muted);line-height:1.6}
.crud-options-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media(max-width:700px){.crud-options-grid{grid-template-columns:1fr}}
.crud-primary,.crud-secondary{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 13px;border:1px solid var(--dh-border-strong);border-radius:10px;color:var(--dh-text);background:var(--dh-card);font-weight:750;font-size:11px}
.crud-primary{background:var(--dh-primary);border-color:var(--dh-primary);color:white}.crud-primary:disabled,.crud-secondary:disabled{opacity:.5;cursor:not-allowed}
.crud-link{border:0;background:transparent;text-decoration:underline;color:var(--dh-primary);cursor:pointer;font-weight:700}.crud-details{margin:13px 0;padding:14px;border:1px solid var(--dh-border);border-radius:10px}
.crud-details summary{font-weight:800;cursor:pointer}.crud-details pre{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dh-text-soft);background:var(--dh-card);border-radius:8px;padding:13px;max-height:360px;overflow:auto;font-size:11px}
.crud-footer,.crud-actions,.crud-library-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.crud-footer{margin-top:16px}.crud-footer>span{color:var(--dh-text-muted)}.crud-actions{justify-content:flex-start;margin:15px 0}
.crud-card{border:1px solid var(--dh-border);border-radius:12px;background:var(--dh-card);padding:16px;margin:14px 0}
.crud-card h4{font-size:14px;margin:0 0 10px}.crud-card p{line-height:1.6;color:var(--dh-text-muted)}
.crud-secret{display:block;font-size:11px;overflow-wrap:anywhere;background:var(--dh-surface);border:1px solid var(--dh-border);border-radius:8px;padding:12px;margin:10px 0}
.crud-error,.crud-success{display:flex;gap:7px;border-radius:8px;padding:12px;border:1px solid var(--dh-border-strong);margin:13px 0}
.crud-error{color:var(--dh-danger,#ef4444)}.crud-library{margin-top:30px}.crud-library>h3{margin:22px 0 6px;font-size:15px}.crud-library>p{color:var(--dh-text-muted)}
.crud-library-row{border:1px solid var(--dh-border);border-radius:10px;padding:11px;margin:7px 0}.crud-library-row small{display:block;color:var(--dh-text-muted);margin-top:5px}
@media(max-width:800px){.crud-steps,.crud-two,.crud-check-list,.crud-operation-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.crud-steps,.crud-two,.crud-check-list,.crud-operation-list{grid-template-columns:1fr}.crud-header{flex-direction:column}.crud-stage{padding:14px}}
</style>
