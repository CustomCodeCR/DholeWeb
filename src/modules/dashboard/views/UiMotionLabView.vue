<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight, CircleDot,
  FileText, Layers3, MousePointer2, Play, RotateCcw, Ship, ShieldCheck,
  Sparkles, Truck, WandSparkles, Zap,
} from 'lucide-vue-next'

type DemoTab = 'pricing' | 'operations'
type RateOption = 'A' | 'B'

const activeTab = ref<DemoTab>('pricing')
const selectedRate = ref<RateOption>('A')
const currentStep = ref(1)
const showNotification = ref(false)
const motionEnabled = ref(true)
const prefersReducedMotion = ref(false)

let motionQuery: MediaQueryList | undefined
const handleMotionPreference = (event: MediaQueryListEvent) => {
  prefersReducedMotion.value = event.matches
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', handleMotionPreference)
})

onBeforeUnmount(() => motionQuery?.removeEventListener('change', handleMotionPreference))

const canAnimate = computed(() => motionEnabled.value && !prefersReducedMotion.value)

const indicators = [
  { label: 'Cotizaciones generadas', value: '128', change: '+12,8 %', icon: FileText },
  { label: 'Trámites coordinados', value: '42', change: '+8,2 %', icon: Layers3 },
  { label: 'Nivel de cumplimiento', value: '98,4 %', change: '+2,1 %', icon: ShieldCheck },
]

const rates = {
  A: { carrier: 'Opción A · Marítimo', route: 'Shanghái → Caldera', price: 'US$ 2.480', days: '28–32 días', badge: 'Mejor tarifa' },
  B: { carrier: 'Opción B · Multimodal', route: 'Shanghái → San José', price: 'US$ 2.865', days: '24–27 días', badge: 'Menor tránsito' },
}
const rate = computed(() => rates[selectedRate.value])

const steps = [
  { title: 'Solicitud recibida', subtitle: 'Cotización registrada', icon: FileText },
  { title: 'Aprobación comercial', subtitle: 'Tarifa aceptada', icon: CheckCircle2 },
  { title: 'Coordinación de origen', subtitle: 'Documentos y reserva', icon: Ship },
  { title: 'Tránsito y entrega', subtitle: 'Seguimiento del embarque', icon: Truck },
]
const progress = computed(() => Math.round(((currentStep.value + 1) / steps.length) * 100))

function moveSpotlight(event: PointerEvent) {
  if (!canAnimate.value) return
  const element = event.currentTarget
  if (!(element instanceof HTMLElement)) return
  const rect = element.getBoundingClientRect()
  element.style.setProperty('--spot-x', String(event.clientX - rect.left) + 'px')
  element.style.setProperty('--spot-y', String(event.clientY - rect.top) + 'px')
}

function advanceStep() {
  currentStep.value = (currentStep.value + 1) % steps.length
}

function resetDemo() {
  selectedRate.value = 'A'
  currentStep.value = 1
  activeTab.value = 'pricing'
  showNotification.value = false
}
</script>

<template>
  <main class="dh-motion-lab" :class="{ 'motion-disabled': !canAnimate }">
    <div class="lab-ambient lab-ambient-one" aria-hidden="true"></div>
    <div class="lab-ambient lab-ambient-two" aria-hidden="true"></div>

    <header class="lab-header">
      <div class="lab-heading">
        <div class="lab-eyebrow"><span class="lab-pulse" aria-hidden="true"></span> DHOLE ERP / LABORATORIO VISUAL</div>
        <h1>Una interfaz que <span>cobra vida.</span></h1>
        <p>Prototipo de microinteracciones para Pricing, Operaciones y dashboards. Esta pantalla utiliza únicamente datos de demostración y no realiza operaciones en el sistema.</p>
      </div>
      <div class="lab-actions">
        <button class="lab-ghost-action" type="button" @click="resetDemo"><RotateCcw :size="16" /> Restablecer</button>
        <button class="lab-motion-action" type="button" :aria-pressed="!motionEnabled" @click="motionEnabled = !motionEnabled">
          <Zap :size="16" /> {{ motionEnabled ? 'Desactivar movimiento' : 'Activar movimiento' }}
        </button>
      </div>
    </header>

    <div class="lab-accessibility" v-if="prefersReducedMotion" role="status">
      Tu sistema tiene activada la preferencia de movimiento reducido. Las animaciones se mantienen desactivadas.
    </div>

    <section class="lab-section" aria-label="Indicadores interactivos">
      <div class="lab-section-label"><Sparkles :size="15" /> 01 / TARJETAS CON SPOTLIGHT Y ENTRADA PROGRESIVA</div>
      <div class="lab-kpis">
        <article v-for="(indicator, index) in indicators" :key="indicator.label"
          class="lab-kpi lab-spotlight" :style="{ '--index': String(index) }" @pointermove="moveSpotlight">
          <div class="lab-kpi-top"><div class="lab-icon"><component :is="indicator.icon" :size="20" /></div><ArrowUpRight :size="19" class="lab-muted-icon" /></div>
          <p class="lab-kpi-label">{{ indicator.label }}</p>
          <div class="lab-kpi-bottom"><strong>{{ indicator.value }}</strong><span class="lab-trend">{{ indicator.change }}</span></div>
          <div class="lab-kpi-foot">Datos ilustrativos para evaluar el diseño</div>
        </article>
      </div>
    </section>

    <section class="lab-section" aria-label="Demostración de módulos">
      <div class="lab-section-label"><MousePointer2 :size="15" /> 02 / INTERACCIONES Y TRANSICIONES CONTEXTUALES</div>
      <div class="lab-showcase lab-spotlight" @pointermove="moveSpotlight">
        <div class="lab-showcase-head">
          <div>
            <div class="lab-showcase-kicker">VISTA PREVIA · SIN CONEXIÓN A DATOS REALES</div>
            <h2>Componentes en contexto</h2>
          </div>
          <div class="lab-tabs" role="tablist" aria-label="Elegir módulo de demostración">
            <button type="button" role="tab" :aria-selected="activeTab === 'pricing'" :class="{ selected: activeTab === 'pricing' }" @click="activeTab = 'pricing'">Pricing</button>
            <button type="button" role="tab" :aria-selected="activeTab === 'operations'" :class="{ selected: activeTab === 'operations' }" @click="activeTab = 'operations'">Operaciones</button>
          </div>
        </div>

        <Transition name="lab-switch" mode="out-in">
          <div v-if="activeTab === 'pricing'" key="pricing" class="lab-demo">
            <div class="lab-demo-description">
              <div class="lab-mini-tag"><CircleDot :size="14" /> Selección interactiva</div>
              <h3>Alternativas de cotización</h3>
              <p>Al cambiar una opción, el resumen, el precio y el tránsito se actualizan con una transición suave, sin parpadeos ni recargas.</p>
              <div class="lab-choice-group" aria-label="Elegir alternativa">
                <button v-for="option in (['A', 'B'] as RateOption[])" :key="option" type="button"
                  :class="{ selected: selectedRate === option }" :aria-pressed="selectedRate === option"
                  @click="selectedRate = option">
                  <span>Alternativa {{ option }}</span><CheckCircle2 v-if="selectedRate === option" :size="17" />
                </button>
              </div>
            </div>
            <div class="lab-quote-frame">
              <div class="lab-quote-head"><div><span class="lab-dot"></span> PROPUESTA DE TRANSPORTE</div><span class="lab-quote-number">QUO · DEMO</span></div>
              <Transition name="lab-rate" mode="out-in">
                <div :key="selectedRate" class="lab-quote-content">
                  <span class="lab-rate-badge">{{ rate.badge }}</span>
                  <p class="lab-quote-carrier">{{ rate.carrier }}</p>
                  <h4>{{ rate.route }}</h4>
                  <div class="lab-quote-meta"><Ship :size="17" /> <span>Tránsito estimado: {{ rate.days }}</span></div>
                  <div class="lab-quote-divider"></div>
                  <div class="lab-quote-total"><div><span>Tarifa de venta</span><strong>{{ rate.price }}</strong></div><ArrowUpRight :size="22" /></div>
                </div>
              </Transition>
            </div>
          </div>
          <div v-else key="operations" class="lab-demo">
            <div class="lab-demo-description">
              <div class="lab-mini-tag"><CircleDot :size="14" /> Flujo de seguimiento</div>
              <h3>Un trámite que avanza</h3>
              <p>Un timeline claro comunica los cambios de estado sin desplazar el contenido ni bloquear la interacción. Avanza manualmente para ver el efecto.</p>
              <button class="lab-primary-action" type="button" @click="advanceStep"><Play :size="16" /> Simular siguiente evento <ChevronRight :size="16" /></button>
            </div>
            <div class="lab-operations-frame">
              <div class="lab-operations-top"><span>TRÁMITE · DEMO</span><span>{{ progress }} % de etapas</span></div>
              <div class="lab-progress"><div :style="{ width: progress + '%' }"></div></div>
              <ol class="lab-timeline">
                <li v-for="(step, index) in steps" :key="step.title" :class="{ reached: index <= currentStep, current: index === currentStep }">
                  <div class="lab-timeline-marker"><CheckCircle2 v-if="index < currentStep" :size="16" /><component v-else :is="step.icon" :size="16" /></div>
                  <div><strong>{{ step.title }}</strong><span>{{ step.subtitle }}</span></div>
                  <span v-if="index === currentStep" class="lab-current-tag">Actual</span>
                </li>
              </ol>
            </div>
          </div>
        </Transition>
      </div>
    </section>

    <section class="lab-section" aria-label="Ejemplo de notificación">
      <div class="lab-section-label"><WandSparkles :size="15" /> 03 / FEEDBACK CON TRANSICIONES DISCRETAS</div>
      <div class="lab-feedback">
        <div class="lab-feedback-copy">
          <h2>Notificaciones que se sienten naturales.</h2>
          <p>Los avisos pueden aparecer y desaparecer suavemente, sin perder contraste ni accesibilidad.</p>
          <button class="lab-primary-action" type="button" @click="showNotification = !showNotification">
            {{ showNotification ? 'Ocultar ejemplo' : 'Mostrar ejemplo' }} <ArrowRight :size="17" />
          </button>
        </div>
        <div class="lab-notice-slot">
          <Transition name="lab-notice">
            <div v-if="showNotification" class="lab-notification" role="status">
              <div class="lab-notice-icon"><CheckCircle2 :size="21" /></div>
              <div><strong>Actualización completada</strong><span>El estado de demostración se actualizó correctamente.</span></div>
            </div>
          </Transition>
          <span v-if="!showNotification" class="lab-notice-hint">Presiona el botón para activar una notificación</span>
        </div>
      </div>
    </section>

    <footer class="lab-footer"><span><span class="lab-footer-dot"></span> Experimento aislado · Solo en develop</span><span>Vue 3 + CSS · Sin nuevas dependencias · Sin escritura en APIs</span></footer>
  </main>
</template>

<style scoped>
.dh-motion-lab{--lab-border:rgba(187,207,245,.14);position:relative;isolation:isolate;min-height:100%;padding:clamp(20px,3.5vw,48px);overflow:hidden;color:#f4f7ff;background:radial-gradient(circle at 80% -18%,#1e2b50 0,transparent 38%),linear-gradient(145deg,#0b1120,#111b2b 72%,#0b1322);border:1px solid var(--lab-border);border-radius:24px;font-family:inherit}
.dh-motion-lab:before{content:"";position:absolute;inset:0;z-index:-1;opacity:.18;pointer-events:none;background-image:linear-gradient(rgba(131,154,206,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(131,154,206,.16) 1px,transparent 1px);background-size:52px 52px;mask-image:linear-gradient(to bottom,#000,transparent 48%)}
.lab-ambient{position:absolute;z-index:-1;width:360px;height:360px;border-radius:50%;filter:blur(80px);pointer-events:none;opacity:.23}
.lab-ambient-one{top:-180px;right:10%;background:#4f72f8;animation:lab-float 9s ease-in-out infinite alternate}
.lab-ambient-two{bottom:-240px;left:15%;background:#0bb5b9;animation:lab-float 12s ease-in-out infinite alternate-reverse}
.lab-header{position:relative;display:flex;justify-content:space-between;align-items:flex-end;gap:32px;padding:7px 0 37px}
.lab-heading{max-width:760px}
.lab-eyebrow,.lab-section-label,.lab-showcase-kicker{display:flex;align-items:center;gap:9px;color:#8da9c8;font-size:11px;font-weight:750;letter-spacing:.14em}
.lab-eyebrow{color:#80d9e4}
.lab-pulse,.lab-footer-dot{width:8px;height:8px;background:#50d8c6;border-radius:50%;box-shadow:0 0 0 4px rgba(80,216,198,.12)}
.lab-pulse{animation:lab-pulse 2s ease-in-out infinite}
.lab-header h1{font-size:clamp(30px,4vw,52px);font-weight:780;letter-spacing:-.045em;line-height:1.13;margin:19px 0 13px}
.lab-header h1 span{color:#89b8ff}
.lab-header p{font-size:14px;line-height:1.8;max-width:680px;margin:0;color:#aabbd3}
.lab-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.lab-actions button,.lab-primary-action{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:39px;padding:9px 14px;border-radius:11px;font-size:12px;font-weight:650;cursor:pointer;transition:transform .2s ease,background .2s ease,border-color .2s ease}
.lab-actions button:hover,.lab-primary-action:hover{transform:translateY(-2px)}
.lab-ghost-action{color:#bed1e6;background:rgba(255,255,255,.045);border:1px solid var(--lab-border)}
.lab-motion-action,.lab-primary-action{color:#08111b;background:linear-gradient(120deg,#8fd9f1,#9baeff);border:1px solid rgba(194,230,255,.72)}
.lab-accessibility{margin:-12px 0 24px;padding:10px 14px;border:1px solid #4b6d82;border-radius:10px;background:#172d3e;color:#cae9f4;font-size:13px}
.lab-section{position:relative;margin-bottom:35px}
.lab-section-label{margin-bottom:15px}
.lab-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}
.lab-spotlight{position:relative;overflow:hidden;--spot-x:50%;--spot-y:50%}
.lab-spotlight:before{content:"";position:absolute;z-index:0;inset:0;pointer-events:none;background:radial-gradient(280px circle at var(--spot-x) var(--spot-y),rgba(119,177,255,.19),transparent 72%);opacity:0;transition:opacity .25s ease}
.lab-spotlight:hover:before{opacity:1}
.lab-kpi{min-width:0;min-height:190px;padding:21px;border:1px solid var(--lab-border);border-radius:18px;background:linear-gradient(145deg,rgba(30,43,65,.94),rgba(18,29,48,.96));transition:transform .24s ease,border-color .24s ease;animation:lab-rise .55s both;animation-delay:calc(var(--index)*85ms)}
.lab-kpi:hover{transform:translateY(-4px);border-color:rgba(142,199,255,.4)}
.lab-kpi>*{position:relative;z-index:1}
.lab-kpi-top,.lab-kpi-bottom{display:flex;align-items:center;justify-content:space-between;gap:14px}
.lab-icon{display:grid;place-items:center;width:39px;height:39px;border:1px solid rgba(137,188,255,.2);border-radius:12px;color:#96baff;background:rgba(113,156,244,.11)}
.lab-muted-icon{color:#617994}
.lab-kpi-label{color:#b7c7dc;font-size:12px;margin:19px 0 9px}
.lab-kpi-bottom strong{font-size:clamp(26px,3vw,34px);letter-spacing:-.035em}
.lab-trend{font-size:11px;color:#62e0c2;padding:5px 8px;border-radius:20px;background:rgba(44,192,153,.12)}
.lab-kpi-foot{margin-top:10px;color:#778aa3;font-size:10px}
.lab-showcase{padding:24px;border:1px solid var(--lab-border);border-radius:22px;background:linear-gradient(135deg,rgba(26,39,61,.96),rgba(13,25,42,.97))}
.lab-showcase>*{position:relative;z-index:1}
.lab-showcase-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:22px}
.lab-showcase-head h2{font-size:19px;letter-spacing:-.025em;margin:9px 0 0}
.lab-tabs{display:flex;gap:4px;padding:5px;border:1px solid var(--lab-border);background:rgba(5,13,25,.46);border-radius:11px}
.lab-tabs button{padding:9px 16px;border:0;border-radius:8px;background:transparent;color:#a5b8d3;font-weight:650;font-size:12px;cursor:pointer;transition:background .2s ease,color .2s ease}
.lab-tabs button.selected{color:#eaf4ff;background:#344d71;box-shadow:0 3px 8px rgba(0,0,0,.2)}
.lab-demo{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,5vw,75px);align-items:center;min-height:310px}
.lab-demo-description{max-width:440px}
.lab-mini-tag{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid rgba(108,208,193,.25);border-radius:8px;background:rgba(59,196,176,.1);color:#87e8d6;font-size:11px;font-weight:700}
.lab-demo-description h3{margin:18px 0 10px;font-size:clamp(22px,3vw,30px);letter-spacing:-.04em}
.lab-demo-description p,.lab-feedback p{color:#aabbd3;font-size:13px;line-height:1.85}
.lab-choice-group{display:flex;gap:10px;margin-top:25px}
.lab-choice-group button{display:flex;justify-content:space-between;align-items:center;gap:8px;min-width:135px;padding:12px;border:1px solid var(--lab-border);border-radius:10px;color:#b5c7de;background:rgba(8,19,34,.55);font-size:12px;cursor:pointer;transition:border-color .2s ease,background .2s ease,transform .2s ease}
.lab-choice-group button:hover{transform:translateY(-2px)}
.lab-choice-group button.selected{color:#ebf7ff;border-color:#7cadff;background:rgba(103,149,226,.2)}
.lab-choice-group button svg{color:#8ee4d2}
.lab-quote-frame,.lab-operations-frame{border:1px solid rgba(164,192,235,.22);border-radius:16px;background:linear-gradient(155deg,rgba(34,52,79,.98),rgba(20,35,55,.97));box-shadow:0 24px 60px rgba(0,0,0,.18);overflow:hidden}
.lab-quote-head,.lab-operations-top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 21px;border-bottom:1px solid rgba(183,205,233,.13);color:#a0b8d3;font-size:10px;font-weight:750;letter-spacing:.09em}
.lab-quote-head>div{display:flex;align-items:center;gap:8px}
.lab-dot{width:7px;height:7px;border-radius:50%;background:#69dbcd}
.lab-quote-number{color:#7593af}
.lab-quote-content{padding:23px}
.lab-rate-badge{display:inline-block;padding:6px 9px;border-radius:7px;background:rgba(80,221,182,.13);color:#8cebd1;font-size:11px;font-weight:650}
.lab-quote-carrier{font-size:12px;color:#a4bbd5;margin:17px 0 5px}
.lab-quote-content h4{margin:0;font-size:23px;letter-spacing:-.04em}
.lab-quote-meta{display:flex;align-items:center;gap:9px;color:#a5bed7;font-size:12px;margin:20px 0 0}
.lab-quote-divider{height:1px;background:rgba(182,208,237,.14);margin:24px 0 18px}
.lab-quote-total{display:flex;align-items:center;justify-content:space-between;color:#9ab9db}
.lab-quote-total>div{display:flex;flex-direction:column;gap:4px}
.lab-quote-total span{font-size:11px}
.lab-quote-total strong{font-size:25px;color:#f7fbff;letter-spacing:-.04em}
.lab-primary-action{margin-top:16px}
.lab-operations-frame{padding-bottom:5px}
.lab-operations-top{padding-bottom:12px;border:0}
.lab-progress{height:5px;margin:0 21px 12px;border-radius:9px;overflow:hidden;background:#334660}
.lab-progress>div{height:100%;border-radius:9px;background:linear-gradient(90deg,#46c8b6,#8ebaff);transition:width .45s cubic-bezier(.2,.85,.2,1)}
.lab-timeline{list-style:none;margin:0;padding:4px 21px 16px}
.lab-timeline li{display:flex;align-items:center;gap:13px;position:relative;min-height:58px;color:#7188a5}
.lab-timeline li:not(:last-child):before{content:"";position:absolute;left:15px;top:43px;height:22px;width:1px;background:#3b5068}
.lab-timeline li.reached:not(:last-child):before{background:#61bfbf}
.lab-timeline-marker{flex:0 0 32px;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;border:1px solid #445877;background:#1e324d}
.lab-timeline li.reached .lab-timeline-marker{color:#9be6dc;background:#20465a;border-color:#3d9fa1}
.lab-timeline li.current .lab-timeline-marker{box-shadow:0 0 0 5px rgba(98,203,189,.1)}
.lab-timeline li>div:nth-child(2){display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}
.lab-timeline strong{color:#d7e2f0;font-size:12px}
.lab-timeline li:not(.reached) strong{color:#899cb4}
.lab-timeline li span{font-size:10px}
.lab-current-tag{color:#96eee0;background:rgba(66,188,168,.13);padding:5px 7px;border-radius:7px}
.lab-feedback{display:flex;align-items:center;justify-content:space-between;gap:25px;padding:26px;border:1px solid var(--lab-border);border-radius:18px;background:rgba(22,37,58,.85)}
.lab-feedback-copy{max-width:430px}
.lab-feedback h2{font-size:20px;letter-spacing:-.03em;margin:0 0 6px}
.lab-feedback p{margin:0 0 6px}
.lab-notice-slot{display:grid;place-items:center;min-height:118px;flex:1}
.lab-notification{display:flex;align-items:center;gap:13px;max-width:350px;width:100%;padding:17px;border:1px solid rgba(111,217,186,.37);border-radius:13px;background:linear-gradient(120deg,#1e514f,#1f3852);box-shadow:0 18px 34px rgba(0,0,0,.24)}
.lab-notice-icon{display:grid;place-items:center;flex:0 0 39px;width:39px;height:39px;border-radius:11px;color:#a3f9e0;background:rgba(124,225,193,.13)}
.lab-notification>div:last-child{display:flex;flex-direction:column;gap:5px}
.lab-notification strong{font-size:12px}
.lab-notification span{font-size:11px;line-height:1.5;color:#bbd4dc}
.lab-notice-hint{font-size:12px;color:#8299b7;text-align:center}
.lab-footer{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;padding-top:8px;color:#849ab5;font-size:11px}
.lab-footer>span:first-child{display:flex;align-items:center;gap:9px}
.lab-footer-dot{width:6px;height:6px}
.lab-switch-enter-active,.lab-switch-leave-active,.lab-rate-enter-active,.lab-rate-leave-active,.lab-notice-enter-active,.lab-notice-leave-active{transition:opacity .23s ease,transform .23s ease}
.lab-switch-enter-from,.lab-rate-enter-from,.lab-notice-enter-from{opacity:0;transform:translateY(10px)}
.lab-switch-leave-to,.lab-rate-leave-to,.lab-notice-leave-to{opacity:0;transform:translateY(-7px)}
.dh-motion-lab :is(button):focus-visible{outline:2px solid #a3e9f0;outline-offset:3px}
.motion-disabled *,.motion-disabled *:before,.motion-disabled *:after{animation:none!important;transition:none!important}
.motion-disabled .lab-spotlight:before{display:none}
@keyframes lab-float{from{transform:translate(-24px,4px)}to{transform:translate(30px,-17px)}}
@keyframes lab-pulse{0%,100%{box-shadow:0 0 0 3px rgba(80,216,198,.13)}50%{box-shadow:0 0 0 9px rgba(80,216,198,.025)}}
@keyframes lab-rise{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:1000px){.lab-header{align-items:flex-start;flex-direction:column}.lab-demo{gap:22px}}
@media(max-width:760px){.dh-motion-lab{padding:22px 15px;border-radius:16px}.lab-kpis{grid-template-columns:1fr}.lab-kpi{min-height:150px}.lab-demo{grid-template-columns:1fr}.lab-showcase-head{align-items:flex-start;flex-direction:column}.lab-feedback{flex-direction:column;align-items:stretch}.lab-feedback-copy{max-width:none}.lab-choice-group{flex-wrap:wrap}.lab-quote-content h4{font-size:20px}.lab-header h1{font-size:31px}}
@media(prefers-reduced-motion:reduce){.dh-motion-lab *,.dh-motion-lab *:before,.dh-motion-lab *:after{animation:none!important;transition:none!important}}
</style>
