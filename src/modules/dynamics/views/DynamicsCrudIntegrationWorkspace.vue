<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, Copy, Database, KeyRound, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import { fetchClient } from '@/core/api/fetchConfig'
import { useAuthStore } from '@/core/stores/authStore'

type Connection = { code: string }
type Field = { logicalName: string; type: string; canRead: boolean; canCreate: boolean
  canUpdate: boolean; isCalculated: boolean; requiredLevel?: string | null
  labels: Record<string,string>; lookupTargets: string[] }
type Table = { logicalName: string; entitySetName: string; labels: Record<string,string>
  primaryIdAttribute: string; columns: Field[]
  alternateKeys?: Array<{ logicalName: string; attributes: string[] }> }
type Snapshot = { version: number; catalog: { tables: Table[] } }
type Policy = { entities: Array<{logicalName:string;enabled:boolean}>
  fields: Array<{entityName:string;fieldName:string;enabled:boolean;canCreate:boolean;canUpdate:boolean;canRead:boolean}> }
type Definition = {entityName:string;operation:string;
  inputs: Array<{name:string;type:string;required:boolean}>;
  mappings: Array<{target:string;source:string}>}
type Summary = {id:string;name:string;activeVersion:number|null;
  history:Array<{version:number;definition:Definition}>}
type KeyInfo = {id:string;templateName:string;operation:string;entityName:string;
  label:string;enabled:boolean;expiresAt:string;maxRequestsPerMinute:number;
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
const fieldSearch=ref('')
const keyName=ref('')
const endpointName=ref('crear_oferta')
const snapshot=ref<Snapshot|null>(null)
const policies=ref<Policy>({entities:[],fields:[]})
const definitions=ref<Summary[]>([])
const keys=ref<KeyInfo[]>([])
const issued=ref<Issued|null>(null)
const createdVersion=ref<number|null>(null)
const keyForm=ref({label:'Mi aplicación',expiresInDays:30,maxRequestsPerMinute:30})
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
  if(['Boolean'].includes(f.type))return 'boolean'
  if(['Integer','BigInt','Picklist','State','Status'].includes(f.type))return 'integer'
  if(['Money','Decimal','Double'].includes(f.type))return 'decimal'
  if(['DateTime'].includes(f.type))return 'datetime'
  if(['Uniqueidentifier'].includes(f.type))return 'guid'
  return 'string'
}
const tables=computed(()=>snapshot.value?.catalog.tables.filter(t=>
  policies.value.entities.some(p=>p.logicalName===t.logicalName&&p.enabled))??[])
const table=computed(()=>tables.value.find(t=>t.logicalName===entity.value))
const eligibleFields=computed(()=>table.value?.columns.filter(f=>{
  if(f.isCalculated||['Virtual','PartyList','ManagedProperty','Lookup','Customer','Owner'].includes(f.type))
    return false
  if(!['String','Memo','EntityName','Boolean','Integer','BigInt','Picklist',
    'State','Status','Money','Decimal','Double','DateTime','Uniqueidentifier'].includes(f.type))
    return false
  const rule=policies.value.fields.find(p=>p.entityName===entity.value&&p.fieldName===f.logicalName)
  if(!rule?.enabled)return false
  if(operation.value==='create')return rule.canCreate&&f.canCreate
  if(operation.value==='update')return rule.canUpdate&&f.canUpdate
  if(operation.value==='upsert')return rule.canCreate&&rule.canUpdate&&f.canCreate&&f.canUpdate
  return false
})??[])
const filteredFields=computed(()=>eligibleFields.value.filter(f=>
  (display(f.labels,f.logicalName)+' '+f.logicalName).toLowerCase().includes(fieldSearch.value.toLowerCase())))
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
    target:f.logicalName,source:f.logicalName
  }))
}))
const nameValid=computed(()=>/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(endpointName.value))
const configValid=computed(()=>!!table.value&&nameValid.value&&
  (operation.value==='delete'||selectedFields.value.length>0)&&
  (operation.value!=='upsert'||!!selectedKey.value))
const selectedTemplate=computed(()=>definitions.value.find(t=>t.name===endpointName.value))
const hasCurrentVersion=computed(()=>!!createdVersion.value&&selectedTemplate.value?.history.some(h=>
  h.version===createdVersion.value &&
  h.definition.entityName===definition.value.entityName &&
  h.definition.operation===definition.value.operation &&
  JSON.stringify(h.definition.inputs)===JSON.stringify(definition.value.inputs) &&
  JSON.stringify(h.definition.mappings)===JSON.stringify(definition.value.mappings)))
const active=computed(()=>hasCurrentVersion.value&&selectedTemplate.value?.activeVersion===createdVersion.value)
const exampleBody=computed(()=>{
  const inputs:Record<string,unknown>={}
  for(const f of selectedFields.value) {
    const kind=fieldType(f)
    inputs[f.logicalName]=kind==='integer'||kind==='decimal'?0:
      kind==='boolean'?false:kind==='guid'?'00000000-0000-0000-0000-000000000001':
      kind==='datetime'?'2026-10-20T12:00:00Z':'VALOR'
  }
  const body:Record<string,unknown>={connectionCode:connection.value,inputs}
  if(operation.value==='update'||operation.value==='delete'){
    body.recordId='00000000-0000-0000-0000-000000000001'
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
const sampleCurl=computed(()=>[
  'curl -X POST '+JSON.stringify(endpoint.value),
  "  -H 'X-Dhole-Api-Key: <CLAVE_GENERADA_EN_DHOLE>'",
  "  -H 'Idempotency-Key: <IDENTIFICADOR_UNICO_POR_OPERACION>'",
  "  -H 'Content-Type: application/json'",
  "  --data '"+JSON.stringify(exampleBody.value)+"'"
].join(' \\\n'))
async function copy(value:string){await navigator.clipboard.writeText(value);success.value='Copiado al portapapeles.'}
function chooseOperation(op:Operation){
  if(operation.value!==op){operation.value=op;selected.value=[];keyName.value='';createdVersion.value=null}
}
function changeTable(){selected.value=[];keyName.value='';createdVersion.value=null}
function back(){if(step.value>1)step.value=(step.value-1) as 1|2|3|4}
function forward(){
  error.value=''
  if(step.value===1&&!table.value){error.value='Primero seleccioná una tabla habilitada en Catálogo.';return}
  if(step.value===2&&operation.value!=='delete'&&selectedFields.value.length===0){
    error.value='Elegí al menos un campo autorizado.';return
  }
  if(step.value===2&&operation.value==='upsert'&&!selectedKey.value){
    error.value='Seleccioná una clave alternativa descubierta en Dataverse.';return
  }
  if(step.value===3&&!configValid.value){error.value='Revisá el nombre y los campos del comando.';return}
  if(step.value<4)step.value=(step.value+1) as 1|2|3|4
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
    if(!tables.value.some(t=>t.logicalName===entity.value))entity.value=tables.value[0]?.logicalName??''
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo cargar el catálogo.'}
  finally{busy.value=false}
}
async function reloadDefinitions(){
  definitions.value=await fetchClient<Summary[]>(api('templates'),{method:'GET'})
}
async function saveDefinition(){
  if(!canManage.value||!configValid.value)return
  busy.value=true;error.value='';success.value=''
  try{
    const response=await fetchClient<Summary>(
      api('templates/'+encodeURIComponent(endpointName.value)+'/versions'),
      {method:'POST',body:definition.value})
    createdVersion.value=response.history[0]?.version??null
    await reloadDefinitions()
    success.value='Versión guardada como borrador; todavía no se puede ejecutar.'
  }catch(e){error.value=e instanceof Error?e.message:'Error guardando el comando.'}
  finally{busy.value=false}
}
async function activate(){
  if(!hasCurrentVersion.value)return
  busy.value=true;error.value='';success.value=''
  try{
    await fetchClient<Summary>(api('templates/'+encodeURIComponent(endpointName.value)+'/active'),
      {method:'PUT',body:{version:createdVersion.value}})
    await reloadDefinitions()
    success.value='Plantilla activada. Las escrituras de producción siguen sujetas a aprobación.'
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo activar.'}
  finally{busy.value=false}
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
    success.value='Clave creada. Copiala ahora; no se mostrará nuevamente.'
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo crear la clave.'}
  finally{busy.value=false}
}
async function revoke(id:string){
  busy.value=true;error.value=''
  try{
    await fetchClient(api('crud-keys/'+encodeURIComponent(id)),{method:'DELETE'})
    if(issued.value?.key.id===id)issued.value=null
    keys.value=await fetchClient<KeyInfo[]>(api('crud-keys'),{method:'GET'})
    success.value='Acceso revocado.'
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo revocar.'}
  finally{busy.value=false}
}
function inspect(t:Summary){
  const version=t.history.find(h=>h.version===t.activeVersion)??t.history[0]
  if(!version||!['create','update','upsert','delete'].includes(version.definition.operation))return
  endpointName.value=t.name;operation.value=version.definition.operation as Operation
  entity.value=version.definition.entityName
  selected.value=version.definition.mappings.map(m=>m.target)
  createdVersion.value=version.version
  step.value=4;issued.value=null
}
watch(()=>props.connections, list=>{
  if(list.length&&!list.some(x=>x.code===connection.value))connection.value=list[0]!.code
},{immediate:true,deep:true})
watch(connection,()=>{createdVersion.value=null;issued.value=null;void refresh()})
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
            <div class="crud-two">
              <label class="crud-field">Buscar campo
                <input v-model="fieldSearch" placeholder="Nombre comercial o técnico"></label>
              <div class="crud-info">{{ selectedFields.length }} de 30 campos seleccionados</div>
            </div>
            <div class="crud-check-list">
              <label v-for="field in filteredFields" :key="field.logicalName">
                <input v-model="selected" type="checkbox" :value="field.logicalName"
                  :disabled="!selected.includes(field.logicalName)&&selected.length>=30">
                <span><strong>{{ display(field.labels,field.logicalName) }}</strong>
                  <small>{{ field.logicalName }} · {{ field.type }}</small></span>
              </label>
              <div v-if="!eligibleFields.length" class="crud-info">No existen campos autorizados y compatibles con esta operación.
                Revisá sus permisos CREATE/UPDATE en Catálogo.</div>
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
          <details open class="crud-details">
            <summary>Esquema de entradas que recibirá la aplicación externa</summary>
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
            <button class="crud-primary" type="button" :disabled="busy||!configValid"
              @click="saveDefinition">1. Guardar versión</button>
            <button class="crud-secondary" type="button" :disabled="busy||!hasCurrentVersion||active"
              @click="activate">{{ active?'Versión activa':'2. Activar versión' }}</button>
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
          <div class="crud-card">
            <h4>URL HTTP para Pangolin o cualquier otra aplicación</h4>
            <code class="crud-secret">{{ endpoint }}</code>
            <button type="button" class="crud-secondary" @click="copy(endpoint)"><Copy :size="15"/> Copiar URL</button>
            <p>La API se consume mediante POST, enviando las cabeceras X-Dhole-Api-Key e Idempotency-Key.</p>
            <details class="crud-details">
              <summary>Ver y copiar ejemplo cURL (sin secretos reales)</summary>
              <pre>{{ sampleCurl }}</pre>
              <button type="button" class="crud-secondary" @click="copy(sampleCurl)">Copiar cURL</button>
            </details>
            <p v-if="operation==='update'||operation==='delete'">
              El consumidor debe obtener primero el GUID y ETag actuales del registro.
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
              {{ template.activeVersion?'Activa · v'+template.activeVersion:'Borrador' }}</small></span>
          <button class="crud-secondary" type="button" @click="inspect(template)">Abrir</button>
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
.crud-connection{max-width:480px}.crud-note,.crud-info{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--dh-border);background:var(--dh-surface);border-radius:11px;color:var(--dh-text-soft);line-height:1.6;margin:15px 0}
.crud-note p{margin:0}.crud-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:18px 0}
.crud-steps button{display:flex;gap:9px;align-items:center;padding:11px;border:1px solid var(--dh-border);background:var(--dh-surface);color:var(--dh-text-muted);font-size:11px;font-weight:800;border-radius:11px}
.crud-steps button>span{width:23px;height:23px;display:grid;place-items:center;flex-shrink:0;border:1px solid var(--dh-border-strong);border-radius:50%}
.crud-steps button.current{border-color:var(--dh-primary);color:var(--dh-text)}.crud-steps button.current>span{background:var(--dh-primary);color:white}
.crud-steps button:disabled{opacity:.65}.crud-stage{background:var(--dh-surface);padding:22px;border:1px solid var(--dh-border);border-radius:14px}
.crud-stage h3{font-size:17px;margin:5px 0 14px}.crud-operation-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
.crud-operation-list button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:8px;min-height:95px;padding:17px;background:var(--dh-card);border:1px solid var(--dh-border);border-radius:12px;color:var(--dh-text)}
.crud-operation-list button.selected{border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 7%,var(--dh-card))}
.crud-operation-list strong{font-size:14px}.crud-operation-list span,.crud-help{color:var(--dh-text-muted);line-height:1.5}
.crud-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}.crud-check-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:420px;overflow:auto}
.crud-check-list label{display:flex;gap:10px;align-items:flex-start;padding:12px;background:var(--dh-card);border:1px solid var(--dh-border);border-radius:10px;cursor:pointer}
.crud-check-list label:has(input:checked){border-color:var(--dh-primary)}.crud-check-list input{margin-top:3px}.crud-check-list small{display:block;color:var(--dh-text-muted);margin-top:4px}
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
