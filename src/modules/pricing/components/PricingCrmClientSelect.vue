<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, ChevronDown, Search, X } from 'lucide-vue-next'
import { crmError, crmPath, crmRequest } from '@/modules/crm/services/crmApi'

interface PricingCrmClient {
  kind?: 'account' | 'lead'
  id: string
  displayName: string
  legalName: string
  taxId?: string | null
  executiveUserId: string
  isCastroFallasExecutive: boolean
  executiveName: string
}
interface ClientPage {
  items: PricingCrmClient[]
  total: number
  page: number
  pageSize: number
}
const props = withDefaults(defineProps<{
  modelValue: string
  mode: 'request' | 'create'
  sellerUserId?: string
  initialName?: string
  disabled?: boolean
  error?: string
}>(), {sellerUserId:'',initialName:'',disabled:false,error:''})
const emit = defineEmits<{
  'update:modelValue': [id:string]
  selected: [client:PricingCrmClient|null]
}>()
const query = ref('')
const current = ref<PricingCrmClient|null>(null)
const items = ref<PricingCrmClient[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const failure = ref('')
const open = ref(false)
let requestId = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const canLoadMore = computed(() => items.value.length < total.value)
async function load(reset=true) {
  if(reset)page.value=1
  const seq=++requestId
  loading.value=true
  failure.value=''
  try{
    const params=new URLSearchParams({
      mode:props.mode, page:String(page.value),
      ...(props.sellerUserId?{sellerUserId:props.sellerUserId}:{}),
      ...(query.value.trim()?{q:query.value.trim()}:{}),
    })
    const result=await crmRequest<ClientPage>(crmPath('pricing-client-options')+'?'+params)
    if(seq!==requestId)return
    items.value=reset?result.items:[...items.value,...result.items.filter(x=>!items.value.some(y=>x.id===y.id))]
    total.value=result.total
  }catch(cause){
    if(seq!==requestId)return
    if(reset){items.value=[];total.value=0}
    failure.value=crmError(cause)
  }finally{
    if(seq===requestId)loading.value=false
  }
}
function debounceSearch(){
  if(searchTimer)clearTimeout(searchTimer)
  searchTimer=setTimeout(()=>{void load()},280)
}
function choose(client:PricingCrmClient){
  current.value=client
  query.value=client.displayName
  emit('update:modelValue',client.id)
  emit('selected',client)
  open.value=false
}
function clear(){
  current.value=null
  query.value=''
  emit('update:modelValue','')
  emit('selected',null)
  open.value=true
  void load()
}
function typeSearch(value:string){
  query.value=value
  if(current.value && value!==current.value.displayName){
    current.value=null
    emit('update:modelValue','')
    emit('selected',null)
  }
  open.value=true
  debounceSearch()
}
async function nextPage(){
  if(loading.value || !canLoadMore.value)return
  page.value++
  await load(false)
}
watch(()=>[props.mode,props.sellerUserId] as const,()=>{
  ++requestId
  if(searchTimer)clearTimeout(searchTimer)
  query.value=props.modelValue ? props.initialName : ''
  items.value=[]
  current.value=null
  void load()
},{immediate:true})
watch(() => [props.modelValue, props.initialName] as const, ([id, label]) => {
  if (id && current.value?.id !== id) query.value = label
  else if (!id && !current.value) query.value = ''
})
function onCrmCollectionChanged(event: Event) {
  const detail = (event as CustomEvent<{ endpoint?: string }>).detail
  if (!detail?.endpoint?.startsWith('/api/crm/accounts') &&
      !detail?.endpoint?.startsWith('/api/crm/leads')) return
  // Refresh only visible choices, never reset an already selected client.
  if (open.value) void load()
}
onMounted(() => window.addEventListener('dhole:data:changed', onCrmCollectionChanged))
onBeforeUnmount(() => {
  window.removeEventListener('dhole:data:changed', onCrmCollectionChanged)
  ++requestId
  if (searchTimer) clearTimeout(searchTimer)
})
</script>
<template>
  <div class="relative min-w-0">
    <label class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
      Cuenta o prospecto CRM *
    </label>
    <div class="relative">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-primary)]"/>
      <input type="search" :value="query" :disabled="disabled"
        :aria-invalid="!!error" autocomplete="off" placeholder="Buscar cuenta o prospecto por nombre o cédula…"
        class="h-11 w-full rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] pl-10 pr-10 text-sm font-semibold outline-none dh-focus-primary disabled:opacity-60"
        @input="typeSearch(($event.target as HTMLInputElement).value)"
        @focus="open=true;void load()" @keydown.escape="open=false"/>
      <button v-if="modelValue&&!disabled" type="button" aria-label="Quitar cliente"
        class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 hover:bg-[var(--dh-card-hover)]"
        @click="clear"><X class="h-4 w-4"/></button>
      <ChevronDown v-else class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-text-muted)]"/>
    </div>
    <p v-if="error" role="alert" class="mt-1 text-xs font-semibold text-red-500">{{error}}</p>
    <p v-if="failure" role="alert" class="mt-1 text-xs text-red-500">{{failure}}</p>
    <div v-if="open && !disabled" class="absolute z-[150] mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card-solid)] p-1.5 shadow-2xl">
      <button v-for="client in items" :key="client.id" type="button"
        class="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--dh-card-hover)]"
        @click="choose(client)">
        <span class="min-w-0">
          <span class="flex items-center gap-2">
            <span class="truncate text-sm font-bold">{{client.displayName}}</span>
            <span class="shrink-0 rounded-md border border-[var(--dh-border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--dh-text-muted)]">{{client.kind === 'lead' ? 'Prospecto' : 'Cuenta'}}</span>
          </span>
          <span class="block truncate text-xs text-[var(--dh-text-muted)]">
            {{client.taxId || client.legalName}} · {{client.executiveName}}
          </span>
        </span>
        <Check v-if="client.id===modelValue" class="h-4 w-4 shrink-0 text-[var(--dh-primary)]"/>
      </button>
      <p v-if="loading" class="p-3 text-center text-xs text-[var(--dh-text-muted)]">Buscando clientes…</p>
      <p v-else-if="!items.length && !failure" class="p-3 text-center text-xs text-[var(--dh-text-muted)]">No hay cuentas o prospectos disponibles para esta búsqueda.</p>
      <button v-if="canLoadMore && !loading" type="button"
        class="w-full rounded-lg px-3 py-2 text-xs font-bold text-[var(--dh-primary)] hover:bg-[var(--dh-card-hover)]"
        @click="nextPage">Ver más clientes ({{items.length}} de {{total}})</button>
    </div>
  </div>
</template>
