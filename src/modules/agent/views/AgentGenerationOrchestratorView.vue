<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Activity, ArrowRightLeft, RefreshCw, ShieldCheck, Settings2 } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'

type TriggerCode = 'manual' | 'scheduled' | 'technical_failure' | 'data_quality'
interface Rule {
  code: TriggerCode
  enabled: boolean
  threshold: number
  scheduleMinutes: number
}
interface Event {
  id: string
  targetGeneration: string
  trigger: TriggerCode
  status: string
  reason: string
  createdAtUtc: string
  completedAtUtc: string
  diagnosticCode: string
}
interface Snapshot {
  activeGeneration: string
  generations: Array<{ name: string; browserState: string; sharedDatabases: boolean }>
  rules: Rule[]
  events: Event[]
}

const auth = useAuthStore()
const toast = useToastStore()
const state = ref<Snapshot | null>(null)
const loading = ref(false)
const submitting = ref(false)
const savingRule = ref<string | null>(null)
const reason = ref('')
const target = ref('')
const newGeneration = ref('')
const registering = ref(false)
const validNewGeneration = computed(() => /^prod[1-9][0-9]*$/.test(newGeneration.value) && newGeneration.value.length <= 64)
const selectedTrigger = ref<TriggerCode>('manual')
const confirmation = ref('')
const canView = computed(() => auth.hasScope('agent.executions.view') && auth.hasScope('agent.browser-profiles.view'))
const canManage = computed(() => auth.hasScope('agent.browser-profiles.authenticate'))
const targetChoices = computed(() => (state.value?.generations ?? []).filter(item => item.name !== state.value?.activeGeneration))
const readyToSubmit = computed(() => canManage.value && reason.value.trim().length >= 12 &&
  reason.value.trim().length <= 500 && confirmation.value === 'SOLICITAR CAMBIO' &&
  target.value !== state.value?.activeGeneration && Boolean(targetChoices.value.find(x => x.name === target.value)))
const ruleLabels: Record<TriggerCode, string> = {
  manual: 'Manual',
  scheduled: 'Programado',
  technical_failure: 'Fallo técnico verificado',
  data_quality: 'Calidad de datos (revisión)',
}
let timer: ReturnType<typeof setInterval> | undefined

async function refresh(silent = false) {
  if (!canView.value || loading.value) return
  loading.value = true
  try {
    const response = await callEndpoint<unknown>({method:'GET', path:'/api/agents/runtime-generations/',headers:{Accept:'application/json'}})
    state.value = unwrapApiResponse<Snapshot>(response as never)
    if (!targetChoices.value.find(x => x.name === target.value)) target.value = targetChoices.value[0]?.name ?? ''
  } catch (error) {
    if (!silent) toast.backendError(error, 'No se pudo consultar el estado del orquestador.')
  } finally { loading.value = false }
}

async function registerGeneration() {
  if (!canManage.value || !validNewGeneration.value || registering.value) return
  registering.value = true
  try {
    const name = newGeneration.value
    await callEndpoint<unknown, { name:string }>({
      method:'POST', path:'/api/agents/runtime-generations/register',
      headers:{Accept:'application/json','Content-Type':'application/json'}
    }, {body:{name}})
    toast.success('Subentorno registrado', `${name} se agregó al inventario. No se crearon ni activaron contenedores.`)
    newGeneration.value = ''
    await refresh()
    target.value = name
  } catch (error) { toast.backendError(error, 'No se pudo registrar el subentorno.') }
  finally { registering.value = false }
}

async function saveRule(rule: Rule) {
  if (!canManage.value || savingRule.value) return
  savingRule.value = rule.code
  try {
    await callEndpoint<unknown, Rule>({
      method:'PUT', path:'/api/agents/runtime-generations/rules/{{code}}',
      headers:{Accept:'application/json','Content-Type':'application/json'}
    }, {params:{code:rule.code},body:rule})
    toast.success('Regla guardada', `Se actualizó la regla ${ruleLabels[rule.code]}.`)
    await refresh()
  } catch (error) { toast.backendError(error,'No se pudo guardar la regla.') }
  finally { savingRule.value = null }
}

async function requestChange() {
  if (!readyToSubmit.value || submitting.value) return
  submitting.value = true
  try {
    await callEndpoint<unknown, { targetGeneration:string;trigger:TriggerCode;reason:string }>({
      method:'POST', path:'/api/agents/runtime-generations/requests',
      headers:{Accept:'application/json','Content-Type':'application/json'}
    }, {body:{targetGeneration:target.value,trigger:selectedTrigger.value,reason:reason.value.trim()}})
    reason.value = ''
    confirmation.value = ''
    toast.success('Solicitud registrada', 'La transición quedó pendiente de las verificaciones del ejecutor; aún no se cambió el entorno.')
    await refresh()
  } catch (error) { toast.backendError(error,'No se pudo registrar la solicitud.') }
  finally { submitting.value = false }
}
onMounted(() => {
  void refresh()
  timer = setInterval(() => { if (!document.hidden) void refresh(true) },15000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <section class="grid gap-5 sm:gap-6 min-w-0">
    <DhPageHeader title="Orquestador de entornos" subtitle="Generaciones independientes de Hermes y Chromium, con bases de datos compartidas" :icon="Settings2">
      <template #actions><DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :loading="loading" @click="refresh()" /></template>
    </DhPageHeader>
    <div v-if="!canView" class="rounded-2xl border border-[var(--dh-border)] p-5">
      No tienes permisos para consultar los entornos del Agent.
    </div>
    <template v-else-if="state">
      <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-5">
        <div class="flex flex-wrap justify-between items-center gap-3">
          <div>
            <p class="text-sm text-[var(--dh-text-muted)]">Generación activa registrada</p>
            <p class="text-3xl font-black text-[var(--dh-text)]">{{ state.activeGeneration }}</p>
            <p class="mt-1 text-sm text-[var(--dh-text-muted)]">El estado se registra en PostgreSQL; no se infiere de la sesión del navegador.</p>
          </div>
          <Activity class="h-8 w-8 text-[var(--dh-primary)]" />
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div v-for="item in state.generations" :key="item.name" class="rounded-xl border border-[var(--dh-border)] p-4">
            <div class="flex justify-between">
              <strong class="text-[var(--dh-text)]">{{ item.name }}</strong>
              <span class="text-sm font-semibold" :class="item.name === state.activeGeneration ? 'text-emerald-500' : 'text-[var(--dh-text-muted)]'">
                {{ item.name === state.activeGeneration ? 'Registrado como activo' : 'Alternativo' }}
              </span>
            </div>
            <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Perfil Chromium propio, persistente y no compartido. No se copia ni se elimina en una transición.</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">MongoDB · PostgreSQL · Redis: datos compartidos</p>
          </div>
        </div>
      </section>

      <section v-if="canManage" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-5 space-y-3">
        <h2 class="font-bold">Registrar nuevo subentorno</h2>
        <p class="text-sm text-[var(--dh-text-muted)]">Registra cualquier generación positiva: prod1, prod2, prod3... Cada una debe provisionarse con volúmenes propios de navegador, Hermes y Worker. El registro no inicia sesiones.</p>
        <div class="flex flex-wrap gap-3 items-end">
          <label class="min-w-52 flex-1 text-sm font-semibold">Nombre
            <input v-model="newGeneration" maxlength="64" type="text" autocomplete="off" placeholder="prod2" class="mt-1 block w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3" />
          </label>
          <DhButton label="Registrar subentorno" variant="secondary" :disabled="!validNewGeneration || registering" :loading="registering" @click="registerGeneration"/>
        </div>
      </section>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-5 space-y-4">
          <div class="flex gap-2 items-center"><ArrowRightLeft class="h-5 w-5" /><h2 class="font-bold">Solicitar cambio manual</h2></div>
          <p class="text-sm text-[var(--dh-text-muted)]">La solicitud requiere comprobación de destino, ausencia de trabajos activos y validación del circuito. No cambia inmediatamente los contenedores.</p>
          <label class="block text-sm font-semibold">Generación de destino
            <select v-model="target" class="mt-1 block w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
              <option v-for="item in targetChoices" :key="item.name" :value="item.name">{{ item.name }}</option>
            </select>
          </label>
          <label class="block text-sm font-semibold">Tipo de evento
            <select v-model="selectedTrigger" class="mt-1 block w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
              <option v-for="rule in state.rules.filter(r => r.enabled)" :key="rule.code" :value="rule.code">{{ ruleLabels[rule.code] }}</option>
            </select>
          </label>
          <label class="block text-sm font-semibold">Motivo (12–500 caracteres)
            <textarea v-model="reason" maxlength="500" rows="3" class="mt-1 block w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3" placeholder="Explica el cambio y la evidencia operativa" />
          </label>
          <label class="block text-sm font-semibold">Confirmación
            <input v-model="confirmation" type="text" autocomplete="off" placeholder="SOLICITAR CAMBIO" class="mt-1 block w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3" />
          </label>
          <DhButton label="Registrar solicitud" :icon="ArrowRightLeft" :disabled="!readyToSubmit || submitting" :loading="submitting" @click="requestChange" />
          <p v-if="!canManage" class="text-xs text-amber-500">Requiere permiso agent.browser-profiles.authenticate.</p>
        </section>
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-5">
          <div class="flex gap-2 items-center mb-4"><ShieldCheck class="h-5 w-5" /><h2 class="font-bold">Disparadores configurables</h2></div>
          <div v-for="rule in state.rules" :key="rule.code" class="py-3 border-b border-[var(--dh-border)] last:border-0">
            <div class="flex justify-between gap-3">
              <label class="font-semibold text-sm">{{ ruleLabels[rule.code] }}</label>
              <input v-model="rule.enabled" type="checkbox" :disabled="!canManage" class="h-5 w-5" />
            </div>
            <div class="grid grid-cols-2 gap-3 mt-3">
              <label class="text-xs text-[var(--dh-text-muted)]">Umbral
                <input v-model.number="rule.threshold" type="number" min="1" max="50" :disabled="!canManage" class="mt-1 block w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] p-2" />
              </label>
              <label class="text-xs text-[var(--dh-text-muted)]">Intervalo (min)
                <input v-model.number="rule.scheduleMinutes" type="number" min="15" max="10080" :disabled="!canManage" class="mt-1 block w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] p-2" />
              </label>
            </div>
            <DhButton v-if="canManage" class="mt-3" label="Guardar regla" size="sm" variant="secondary" :disabled="Boolean(savingRule)" :loading="savingRule === rule.code" @click="saveRule(rule)" />
          </div>
          <p class="mt-4 text-xs text-[var(--dh-text-muted)]">Las reglas de error técnico y datos incorrectos requieren evidencia verificable en el ejecutor; los bloqueos de autenticación permanecen protegidos por el circuit breaker.</p>
        </section>
      </div>

      <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-5">
        <h2 class="font-bold mb-4">Historial y solicitudes pendientes</h2>
        <p v-if="!state.events.length" class="text-sm text-[var(--dh-text-muted)]">No hay solicitudes registradas.</p>
        <div v-for="item in state.events" :key="item.id" class="py-3 border-b border-[var(--dh-border)] last:border-0 flex flex-wrap justify-between gap-3">
          <div><strong>{{ item.targetGeneration }}</strong> · {{ ruleLabels[item.trigger] ?? item.trigger }}
            <p class="text-sm text-[var(--dh-text-muted)]">{{ item.reason }}</p>
            <p class="text-xs text-[var(--dh-text-muted)]">{{ item.createdAtUtc }}</p>
          </div>
          <span class="font-bold text-sm">{{ item.status }}</span>
        </div>
      </section>
    </template>
  </section>
</template>
