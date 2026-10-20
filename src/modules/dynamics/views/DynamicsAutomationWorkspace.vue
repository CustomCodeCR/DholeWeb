<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, CheckCircle2, GitBranch, Plus, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import { fetchClient } from '@/core/api/fetchConfig'
import { useAuthStore } from '@/core/stores/authStore'

type Conn = { code: string }
type FieldMapping = { inputName: string; pricingField: string }
type TemplateInput = { name: string; type: string; required: boolean }
type Template = {
  name: string; activeVersion: number | null
  history: Array<{ version: number; definition: {
    entityName: string; operation: string; inputs: TemplateInput[]
  } }>
}
type Automation = {
  id: string; name: string; triggerCode: string; templateName: string
  mappings: FieldMapping[]; enabled: boolean; createdAt: string; updatedAt: string
}
const props = defineProps<{ connections: Conn[] }>()
const emit = defineEmits<{ navigate: [section: 'catalog' | 'query' | 'crud' | 'security' | 'integrations'] }>()
const auth=useAuthStore()
const canManage=computed(()=>auth.hasScope('dynamics.security.admin'))
const code=ref('principal')
const busy=ref(false)
const error=ref('')
const info=ref('')
const step=ref<1|2|3|4>(1)
const name=ref('tarifa_aceptada_crear_quote')
const trigger=ref('pricing.rate.accepted_by_client')
const templateName=ref('CreateQuote')
const mapping=ref<Record<string,string>>({})
const existing=ref<Automation[]>([])
const templates=ref<Template[]>([])
const pricingFields=ref<Record<string,string>>({})
const steps=['Evento', 'Acción', 'Relacionar datos', 'Revisar y guardar'] as const

const choices=[
  { value:'pricing.rate.accepted_by_client',title:'Tarifa aceptada por el cliente',
    desc:'Cuando Pricing cambia el estado a AcceptedByClient. Recomendado para crear la Quote comercial.' },
  { value:'pricing.rate.margin_approved',title:'Margen aprobado internamente',
    desc:'Cuando se autoriza el margen bajo. No significa que el cliente haya aceptado la tarifa.' },
]
const quoteTemplates=computed(()=>templates.value.filter(t=>
  t.history.some(v=>v.definition.operation==='create'&&v.definition.entityName==='quote')))
const selectedTemplate=computed(()=>quoteTemplates.value.find(x=>x.name===templateName.value))
const selectedVersion=computed(()=>selectedTemplate.value?.history.find(x=>
  x.version===selectedTemplate.value?.activeVersion) ??
  selectedTemplate.value?.history[0])
const inputs=computed(()=>selectedVersion.value?.definition.inputs ?? [])
const availableFields=(input:TemplateInput)=>Object.entries(pricingFields.value)
  .filter(([,kind])=>kind===input.type)
  .sort(([a],[b])=>a.localeCompare(b))
const mappedFields=computed(()=>inputs.value.filter(i=>!!mapping.value[i.name]).length)
const unmappedRequired=computed(()=>inputs.value.filter(i=>i.required&&!mapping.value[i.name]))
const canSave=computed(()=>canManage.value&&!busy.value&&!!selectedTemplate.value&&
  name.value.length>0&&/^[a-z][a-z0-9_-]{0,79}$/.test(name.value)&&
  !unmappedRequired.value.length&&mappedFields.value>0)
const preview=computed(()=>inputs.value.filter(i=>mapping.value[i.name]).map(i=>({
  input:i.name,type:i.type,from:mapping.value[i.name]
})))
function resetFrom(phase:1|2|3|4){step.value=phase;error.value=''}
function changeTemplate(){mapping.value={}}
const url=(route:string)=>'/api/dynamics-admin/connections/'+encodeURIComponent(code.value)+route
async function load(){
  if(!canManage.value)return
  busy.value=true;error.value=''
  try{
    const [rules,ts,fields]=await Promise.all([
      fetchClient<Automation[]>(url('/event-automations')),
      fetchClient<Template[]>(url('/templates')),
      fetchClient<Record<string,string>>(url('/event-automations/pricing-fields'))
    ])
    existing.value=rules;templates.value=ts;pricingFields.value=fields
    if(!quoteTemplates.value.some(t=>t.name===templateName.value)&&quoteTemplates.value.length)
      templateName.value=quoteTemplates.value[0]!.name
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo cargar la configuración.'}
  finally{busy.value=false}
}
async function save(){
  if(!canSave.value)return
  busy.value=true;error.value='';info.value=''
  try{
    await fetchClient<Automation>(url('/event-automations'),{
      method:'POST',
      body:{name:name.value,triggerCode:trigger.value,templateName:templateName.value,
        mappings:preview.value.map(v=>({inputName:v.input,pricingField:v.from}))}
    })
    existing.value=await fetchClient<Automation[]>(url('/event-automations'))
    info.value='Regla guardada como borrador. No se ha activado ni enviado ninguna escritura a Dynamics.'
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo guardar el borrador.'}
  finally{busy.value=false}
}
function edit(rule:Automation){
  name.value=rule.name;trigger.value=rule.triggerCode
  templateName.value=rule.templateName
  mapping.value=Object.fromEntries(rule.mappings.map(m=>[m.inputName,m.pricingField]))
  step.value=1;info.value=''
}
watch(()=>props.connections, list=>{
  if(list.length&&!list.some(c=>c.code===code.value))code.value=list[0]!.code
},{immediate:true,deep:true})
watch(code,()=>{mapping.value={};void load()})
onMounted(load)
</script>

<template>
  <section class="dynamics-automation-panel">
    <div class="dyn-auto-header">
      <div>
        <p class="dyn-auto-eyebrow">DYNAMICS 365 · INTEGRACIONES BASADAS EN EVENTOS</p>
        <h2>Automatizaciones de Dynamics</h2>
        <p>Configurá qué debe suceder en Dataverse cuando ocurra algo en Dhole. No necesitás crear registros manualmente.</p>
      </div>
      <button type="button" class="dyn-auto-secondary" :disabled="busy" @click="load"><RefreshCw :size="15"/> Recargar</button>
    </div>
    <div class="dyn-auto-selector">
      <label>Conexión Dataverse
        <select v-model="code"><option v-for="c in connections" :key="c.code" :value="c.code">{{ c.code }}</option></select>
      </label>
    </div>
    <div v-if="!canManage" class="dyn-auto-warning">Se requiere dynamics.security.admin para configurar reglas y mappings.</div>
    <template v-else>
      <div class="dyn-auto-note">
        <ShieldCheck :size="18"/>
        <p><strong>Primero configurar, después activar.</strong> Las reglas se guardan desactivadas. El disparador de eventos de Pricing todavía debe conectarse y validarse en staging, junto con los identificadores de cliente y moneda de Dynamics. Guardar una regla no modifica Dataverse.</p>
      </div>
      <nav class="dyn-auto-steps" aria-label="Pasos de automatización">
        <button v-for="(label,i) in steps" :key="label" type="button" :disabled="i+1>step"
          :class="{active:step===i+1,done:step>i+1}" @click="resetFrom((i+1) as 1|2|3|4)">
          <span>{{ i+1 }}</span>{{ label }}
        </button>
      </nav>
      <div class="dyn-auto-card">
        <template v-if="step===1">
          <p class="dyn-auto-eyebrow">PASO 1 · DISPARADOR</p>
          <h3>¿Cuándo querés que se ejecute?</h3>
          <p class="dyn-auto-help">Se utilizará el cambio de estado confirmado en Pricing, no una acción manual dentro de Dynamics.</p>
          <div class="dyn-auto-options">
            <button v-for="option in choices" :key="option.value" type="button"
              :class="{selected:trigger===option.value}" @click="trigger=option.value">
              <GitBranch :size="18"/>
              <strong>{{ option.title }}</strong>
              <small>{{ option.desc }}</small>
            </button>
          </div>
          <label class="dyn-auto-field">Nombre de la automatización
            <input v-model.trim="name" maxlength="80" placeholder="tarifa_aceptada_crear_quote">
            <small>Identificador único de la regla. Letras minúsculas, números, guiones o _.</small>
          </label>
        </template>
        <template v-else-if="step===2">
          <p class="dyn-auto-eyebrow">PASO 2 · ACCIÓN</p>
          <h3>¿Qué hará Dynamics?</h3>
          <div class="dyn-auto-selected"><CheckCircle2 :size="18"/> Crear una oferta (Quote) en Microsoft Dataverse</div>
          <p class="dyn-auto-help">La acción utiliza una plantilla de escritura versionada, con columnas y relaciones autorizadas. El conector ya cuenta con un mecanismo de idempotencia por tarifa para evitar Quotes duplicadas.</p>
          <label class="dyn-auto-field">Plantilla Create Quote
            <select v-model="templateName" @change="changeTemplate">
              <option v-for="t in quoteTemplates" :key="t.name" :value="t.name">
                {{ t.name }} {{ t.activeVersion ? '(versión '+t.activeVersion+' activa)' : '(sin versión activa)' }}
              </option>
            </select>
          </label>
          <div v-if="!quoteTemplates.length" class="dyn-auto-warning">
            No existe una plantilla para crear Quote. Primero habilitá los campos de quote en Catálogo y prepará una versión de la plantilla CreateQuote.
            <button class="dyn-auto-secondary" type="button" @click="emit('navigate','catalog')">Ir al catálogo</button>
          </div>
          <div v-else-if="!selectedTemplate?.activeVersion" class="dyn-auto-warning">
            La plantilla seleccionada todavía no está activa: podés preparar el borrador, pero no será ejecutable hasta que pase la validación del mapeo de campos.
          </div>
        </template>
        <template v-else-if="step===3">
          <p class="dyn-auto-eyebrow">PASO 3 · DATOS ENTRE SISTEMAS</p>
          <h3>¿De dónde saldrá cada dato de la Quote?</h3>
          <p class="dyn-auto-help">Elegí un dato de Pricing para cada entrada de la plantilla. Solo se ofrecen tipos compatibles. Los IDs de cliente y moneda de Dhole no son equivalentes a los GUID de Dynamics.</p>
          <div v-if="!inputs.length" class="dyn-auto-warning">Elegí una plantilla de creación con entradas definidas en el paso anterior.</div>
          <div v-for="item in inputs" :key="item.name" class="dyn-auto-mapping">
            <div><strong>{{ item.name }}</strong><small>{{ item.type }} · {{ item.required ? 'Obligatorio' : 'Opcional' }}</small></div>
            <label>
              Dato de origen
              <select v-model="mapping[item.name]">
                <option value="">— Sin asignar —</option>
                <option v-for="[field] in availableFields(item)" :key="field" :value="field">{{ field }}</option>
              </select>
            </label>
          </div>
          <p v-if="unmappedRequired.length" class="dyn-auto-warning">Faltan {{ unmappedRequired.length }} entradas obligatorias: {{ unmappedRequired.map(i=>i.name).join(', ') }}. Requieren relacionar entidades o ajustar la plantilla antes de ejecutar automáticamente.</p>
        </template>
        <template v-else>
          <p class="dyn-auto-eyebrow">PASO 4 · REVISIÓN</p>
          <h3>Revisá la automatización</h3>
          <div class="dyn-auto-review">
            <div><strong>Disparador</strong><span>{{ choices.find(c=>c.value===trigger)?.title }}</span></div>
            <div><strong>Acción</strong><span>Crear Quote en {{ code }}</span></div>
            <div><strong>Plantilla</strong><span>{{ templateName }}</span></div>
            <div><strong>Entradas mapeadas</strong><span>{{ mappedFields }} de {{ inputs.length }}</span></div>
          </div>
          <div class="dyn-auto-map-preview">
            <div v-for="entry in preview" :key="entry.input"><code>{{ entry.input }}</code><ArrowRight :size="14"/><code>Pricing.{{ entry.from }}</code></div>
            <p v-if="!preview.length">Todavía no hay datos relacionados.</p>
          </div>
          <div v-if="unmappedRequired.length" class="dyn-auto-warning">No podés guardar todavía: faltan datos obligatorios.</div>
          <div class="dyn-auto-note"><ShieldCheck :size="17"/>
            <p>Esta acción se guardará en estado <strong>Borrador · Inactiva</strong>. Nunca se ejecutará una escritura por guardar o avanzar en el asistente. La activación automática requiere completar la conexión de eventos, autorizaciones y pruebas en staging.</p>
          </div>
          <button class="dyn-auto-primary" type="button" :disabled="!canSave" @click="save"><Plus :size="16"/> Guardar automatización como borrador</button>
        </template>
      </div>
      <div v-if="error" class="dyn-auto-warning" role="alert">{{ error }}</div>
      <div v-if="info" class="dyn-auto-success" role="status">{{ info }}</div>
      <div class="dyn-auto-footer">
        <button type="button" class="dyn-auto-secondary" :disabled="step===1" @click="resetFrom((step-1) as 1|2|3|4)"><ArrowLeft :size="16"/> Anterior</button>
        <span>Paso {{ step }} de 4</span>
        <button v-if="step<4" type="button" class="dyn-auto-primary"
          :disabled="busy||(step===2&&!selectedTemplate)" @click="step=(step+1) as 1|2|3|4">
          Siguiente <ArrowRight :size="16"/>
        </button>
      </div>
      <div class="dyn-auto-existing">
        <h3>Automatizaciones configuradas</h3>
        <p class="dyn-auto-help">Podés revisar o modificar los borradores antes de que el sistema tenga habilitado el ejecutor de eventos.</p>
        <div v-for="rule in existing" :key="rule.id" class="dyn-auto-saved">
          <div><strong>{{ rule.name }}</strong><small>{{ rule.triggerCode }} → {{ rule.templateName }} · Inactiva</small></div>
          <button type="button" class="dyn-auto-secondary" @click="edit(rule)">Editar</button>
        </div>
        <p v-if="!existing.length" class="dyn-auto-help">No se han configurado automatizaciones para esta conexión.</p>
      </div>
      <details class="dyn-auto-advanced">
        <summary>Operaciones manuales de Dataverse (herramientas avanzadas)</summary>
        <p>Para pruebas supervisadas o mantenimiento puntual podés abrir el editor CRUD manual. No se utiliza como disparador de automatizaciones.</p>
        <button type="button" class="dyn-auto-secondary" @click="emit('navigate','crud')">Abrir CRUD manual</button>
      </details>
    </template>
  </section>
</template>

<style scoped>
.dynamics-automation-panel{padding:22px;color:var(--dh-text);background:var(--dh-card);border:1px solid var(--dh-border);border-radius:16px;font-size:13px}
.dyn-auto-header,.dyn-auto-footer,.dyn-auto-saved{display:flex;align-items:center;justify-content:space-between;gap:12px}.dyn-auto-header h2{font-size:18px;margin:5px 0}.dyn-auto-header p{color:var(--dh-text-muted);margin:5px 0;line-height:1.55}
.dyn-auto-eyebrow{font-size:10px;letter-spacing:.08em;color:var(--dh-primary)!important;font-weight:850}
.dyn-auto-selector{margin:16px 0}.dyn-auto-selector label,.dyn-auto-field,.dyn-auto-mapping label{display:flex;flex-direction:column;gap:8px;font-size:11px;font-weight:700}
.dyn-auto-selector select,.dyn-auto-field input,.dyn-auto-field select,.dyn-auto-mapping select{width:100%;max-width:520px;background:var(--dh-surface);border:1px solid var(--dh-border-strong);border-radius:9px;color:var(--dh-text);padding:10px;font-size:12px}
.dyn-auto-field{margin-top:18px}.dyn-auto-field small,.dyn-auto-mapping small{font-size:11px;color:var(--dh-text-muted);font-weight:400}
.dyn-auto-note,.dyn-auto-warning,.dyn-auto-success{display:flex;align-items:flex-start;gap:12px;margin:12px 0;padding:13px;border:1px solid var(--dh-border);border-radius:10px;background:var(--dh-surface);color:var(--dh-text-soft)}
.dyn-auto-note p{margin:0;line-height:1.65}.dyn-auto-warning{border-color:var(--dh-warning,var(--dh-border-strong));display:block;line-height:1.5}
.dyn-auto-success{color:var(--dh-text)}.dyn-auto-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:18px 0}
.dyn-auto-steps button{display:flex;align-items:center;gap:9px;padding:12px;border:1px solid var(--dh-border);border-radius:10px;background:var(--dh-surface);color:var(--dh-text-soft);font-size:11px;font-weight:800;text-align:left}
.dyn-auto-steps button span{display:grid;place-items:center;border:1px solid var(--dh-border-strong);border-radius:50%;width:24px;height:24px;flex-shrink:0}
.dyn-auto-steps button.active{border-color:var(--dh-primary);color:var(--dh-text)}.dyn-auto-steps button.active span{background:var(--dh-primary);color:white}
.dyn-auto-steps button:disabled{opacity:.6}.dyn-auto-card{padding:20px;border-radius:12px;border:1px solid var(--dh-border);background:var(--dh-surface)}
.dyn-auto-card h3,.dyn-auto-existing h3{font-size:16px;font-weight:800;margin:8px 0}.dyn-auto-help{font-size:12px;color:var(--dh-text-muted);line-height:1.6}
.dyn-auto-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}
.dyn-auto-options button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:9px;padding:17px;border:1px solid var(--dh-border);border-radius:12px;color:var(--dh-text);background:var(--dh-card)}
.dyn-auto-options button.selected{border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 8%,var(--dh-card))}
.dyn-auto-options small{line-height:1.5;color:var(--dh-text-muted)}.dyn-auto-secondary,.dyn-auto-primary{display:inline-flex;gap:8px;align-items:center;justify-content:center;border:1px solid var(--dh-border-strong);border-radius:10px;padding:11px 14px;color:var(--dh-text);background:var(--dh-card);font-size:11px;font-weight:800}
.dyn-auto-primary{background:var(--dh-primary);color:white;border-color:var(--dh-primary)}.dyn-auto-primary:disabled,.dyn-auto-secondary:disabled{opacity:.45;cursor:not-allowed}
.dyn-auto-mapping{display:grid;grid-template-columns:minmax(170px,1fr) minmax(200px,2fr);align-items:center;gap:16px;border-bottom:1px solid var(--dh-border);padding:13px 0}.dyn-auto-mapping small{display:block;margin-top:5px}
.dyn-auto-review{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:16px 0}.dyn-auto-review>div{display:flex;flex-direction:column;gap:9px;padding:14px;background:var(--dh-card);border:1px solid var(--dh-border);border-radius:10px}.dyn-auto-review strong{font-size:10px}.dyn-auto-review span{overflow-wrap:anywhere}
.dyn-auto-map-preview{margin:14px 0;padding:10px;border:1px solid var(--dh-border);border-radius:10px}.dyn-auto-map-preview>div{display:flex;align-items:center;gap:12px;padding:8px;flex-wrap:wrap}.dyn-auto-map-preview code{overflow-wrap:anywhere}
.dyn-auto-footer{margin-top:15px}.dyn-auto-footer span{font-size:11px;color:var(--dh-text-muted)}.dyn-auto-existing{margin-top:24px}.dyn-auto-saved{border:1px solid var(--dh-border);padding:12px;border-radius:10px;margin-top:8px}.dyn-auto-saved small{display:block;color:var(--dh-text-muted);margin-top:5px}
.dyn-auto-advanced{margin-top:20px;padding:12px;border:1px solid var(--dh-border);border-radius:11px}.dyn-auto-advanced summary{cursor:pointer;font-weight:800}.dyn-auto-advanced p{color:var(--dh-text-muted)}
@media(max-width:780px){.dyn-auto-steps,.dyn-auto-review,.dyn-auto-options{grid-template-columns:repeat(2,minmax(0,1fr))}.dyn-auto-mapping{grid-template-columns:1fr}}
@media(max-width:520px){.dyn-auto-steps,.dyn-auto-review,.dyn-auto-options{grid-template-columns:1fr}.dyn-auto-header{align-items:flex-start;flex-direction:column}}
</style>
