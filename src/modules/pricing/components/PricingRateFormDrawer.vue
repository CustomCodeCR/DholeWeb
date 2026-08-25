<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { ImportRateDto, RateDto } from '@/core/interfaces/pricing'
import PricingRateFormDrawerLegacy from './PricingRateFormDrawerLegacy.vue'

type WizardStep = 1 | 2 | 3

const props = defineProps<{
  rate?: RateDto
  sourceImport?: ImportRateDto
  decisionInternationalLandFreight?: number | null
  onSaved?: (rateId?: string) => void | Promise<void>
}>()

const legacyRef = ref<InstanceType<typeof PricingRateFormDrawerLegacy> | null>(null)
const wizardRootRef = ref<HTMLElement | null>(null)
const activeStep = ref<WizardStep>(1)

const isManualWizard = computed(() => !props.rate && !props.sourceImport)

const steps: Array<{ id: WizardStep; label: string; hint: string }> = [
  { id: 1, label: 'Datos generales', hint: 'Vigencia, moneda y condiciones comerciales' },
  { id: 2, label: 'Ruta y equipo', hint: 'Modalidad, puertos, naviera y equipo' },
  { id: 3, label: 'Costos y margen', hint: 'Rubros, seguro, costo, venta y utilidad' },
]

const activeStepMeta = computed(() => steps.find((step) => step.id === activeStep.value) ?? steps[0]!)

function goToStep(step: WizardStep) {
  if (!isManualWizard.value) return
  activeStep.value = step
  requestAnimationFrame(() => wizardRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function previousStep() {
  if (activeStep.value > 1) goToStep((activeStep.value - 1) as WizardStep)
}

function nextStep() {
  if (activeStep.value < 3) goToStep((activeStep.value + 1) as WizardStep)
}

async function collapseCommercialConditionsByDefault() {
  if (!isManualWizard.value) return
  await nextTick()

  const legacyInstance = legacyRef.value as unknown as { $el?: HTMLElement } | null
  const formElement = legacyInstance?.$el
  if (!formElement) return

  const commercialSection = formElement.querySelector(':scope > section:nth-of-type(3)')
  const commercialHeader = commercialSection?.firstElementChild as HTMLElement | null
  commercialHeader?.click()
}

onMounted(collapseCommercialConditionsByDefault)
</script>

<template>
  <div
    ref="wizardRootRef"
    class="pricing-rate-wizard"
    :class="[
      isManualWizard ? 'pricing-rate-wizard--new' : 'pricing-rate-wizard--contextual',
      isManualWizard ? `pricing-rate-wizard--step-${activeStep}` : '',
    ]"
  >
    <div class="pricing-rate-wizard__inner">
      <nav v-if="isManualWizard" class="pricing-rate-stepper" aria-label="Flujo de creación de tarifa">
        <button
          v-for="step in steps"
          :key="step.id"
          type="button"
          class="pricing-rate-step"
          :class="{
            'pricing-rate-step--current': activeStep === step.id,
            'pricing-rate-step--completed': activeStep > step.id,
          }"
          :aria-current="activeStep === step.id ? 'step' : undefined"
          @click="goToStep(step.id)"
        >
          <span class="pricing-rate-step__number">{{ step.id }}</span>
          <span class="pricing-rate-step__label">{{ step.label }}</span>
        </button>
      </nav>

      <section class="pricing-rate-card">
        <header class="pricing-rate-card__header">
          <div>
            <div class="pricing-rate-card__title-row">
              <h2 class="pricing-rate-card__title">{{ props.rate ? 'Editar tarifa' : 'Nueva tarifa' }}</h2>
              <span class="pricing-rate-card__status">
                {{ props.rate ? 'Edición' : props.sourceImport ? 'Desde importación' : 'Borrador' }}
              </span>
            </div>
            <p v-if="isManualWizard" class="pricing-rate-card__subtitle">
              Paso {{ activeStep }} de 3 · {{ activeStepMeta.label }} — {{ activeStepMeta.hint }}
            </p>
            <p v-else class="pricing-rate-card__subtitle">Complete los datos operativos y comerciales de la tarifa.</p>
          </div>
        </header>

        <div class="pricing-rate-form">
          <PricingRateFormDrawerLegacy
            ref="legacyRef"
            :rate="props.rate"
            :source-import="props.sourceImport"
            :decision-international-land-freight="props.decisionInternationalLandFreight"
            :on-saved="props.onSaved"
          />
        </div>

        <footer v-if="isManualWizard" class="pricing-rate-navigation">
          <button
            type="button"
            class="pricing-rate-navigation__button pricing-rate-navigation__button--secondary"
            :disabled="activeStep === 1"
            @click="previousStep"
          >
            <ChevronLeft class="h-4 w-4" />
            Regresar
          </button>

          <div class="pricing-rate-navigation__progress">
            <span>{{ activeStepMeta.label }}</span>
            <small>{{ activeStep }}/3</small>
          </div>

          <button
            v-if="activeStep < 3"
            type="button"
            class="pricing-rate-navigation__button pricing-rate-navigation__button--primary"
            @click="nextStep"
          >
            Siguiente
            <ChevronRight class="h-4 w-4" />
          </button>
          <span v-else class="pricing-rate-navigation__finish-hint">
            La tarifa se crea desde el resumen inferior.
          </span>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pricing-rate-wizard {
  --rate-primary: var(--dh-primary);
  --rate-border: var(--dh-border);
  --rate-card: var(--dh-card);
  --rate-bg: var(--dh-bg);
  --rate-text: var(--dh-text);
  --rate-muted: var(--dh-text-muted);
  width: 100%;
  scroll-margin-top: 1rem;
}

.pricing-rate-wizard--new {
  margin: -0.25rem;
  padding: 1rem 1rem 12.5rem;
  border: 1px solid color-mix(in srgb, var(--rate-border) 72%, transparent);
  border-radius: 30px;
  background: color-mix(in srgb, var(--rate-bg) 64%, transparent);
  box-shadow: 0 22px 70px rgb(15 23 42 / 8%);
  backdrop-filter: blur(28px) saturate(145%);
  -webkit-backdrop-filter: blur(28px) saturate(145%);
}

.pricing-rate-wizard__inner {
  width: min(100%, 1480px);
  margin-inline: auto;
}

.pricing-rate-stepper {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: min(100%, 760px);
  margin: 0 auto 1rem;
  padding: 0.35rem 0.7rem;
}

.pricing-rate-step {
  position: relative;
  z-index: 0;
  display: flex;
  min-width: 0;
  cursor: pointer;
  flex-direction: column;
  align-items: center;
  gap: 0.42rem;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--rate-muted) 76%, transparent);
  text-align: center;
  transition: color 180ms ease, transform 180ms ease;
}

.pricing-rate-step:hover { color: var(--rate-text); }
.pricing-rate-step:active { transform: translateY(1px); }

.pricing-rate-step::after {
  position: absolute;
  top: 1.02rem;
  left: calc(50% + 1.2rem);
  z-index: -1;
  width: calc(100% - 2.4rem);
  height: 2px;
  content: '';
  background: color-mix(in srgb, var(--rate-border) 78%, transparent);
}

.pricing-rate-step:last-child::after { display: none; }
.pricing-rate-step--completed::after { background: var(--rate-primary); }

.pricing-rate-step__number {
  display: inline-flex;
  width: 2.1rem;
  height: 2.1rem;
  align-items: center;
  justify-content: center;
  border: 2px solid color-mix(in srgb, var(--rate-border) 92%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--rate-card) 78%, transparent);
  color: var(--rate-muted);
  font-size: 0.74rem;
  font-weight: 900;
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--rate-bg) 72%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.pricing-rate-step--current,
.pricing-rate-step--completed { color: var(--rate-primary); }

.pricing-rate-step--current .pricing-rate-step__number,
.pricing-rate-step--completed .pricing-rate-step__number {
  border-color: var(--rate-primary);
  background: color-mix(in srgb, var(--rate-primary) 92%, transparent);
  color: white;
  box-shadow:
    0 0 0 5px color-mix(in srgb, var(--rate-bg) 72%, transparent),
    0 7px 18px color-mix(in srgb, var(--rate-primary) 22%, transparent);
}

.pricing-rate-step--current .pricing-rate-step__number { transform: scale(1.08); }
.pricing-rate-step__label { max-width: 10rem; font-size: 0.78rem; font-weight: 850; line-height: 1.15; }

.pricing-rate-card {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--rate-border) 78%, transparent);
  border-radius: 28px;
  background: color-mix(in srgb, var(--rate-card) 78%, transparent);
  box-shadow: 0 20px 58px rgb(15 23 42 / 9%);
  backdrop-filter: blur(28px) saturate(150%);
  -webkit-backdrop-filter: blur(28px) saturate(150%);
}

.pricing-rate-card__header {
  display: flex;
  min-height: 76px;
  align-items: center;
  border-bottom: 1px solid color-mix(in srgb, var(--rate-border) 72%, transparent);
  background: color-mix(in srgb, var(--rate-card) 58%, transparent);
  padding: 1rem 1.4rem;
  backdrop-filter: blur(20px) saturate(135%);
  -webkit-backdrop-filter: blur(20px) saturate(135%);
}

.pricing-rate-card__title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.7rem; }
.pricing-rate-card__title { color: var(--rate-text); font-size: clamp(1.2rem, 1.7vw, 1.45rem); font-weight: 900; letter-spacing: -0.025em; }
.pricing-rate-card__status { display: inline-flex; min-height: 1.7rem; align-items: center; border: 1px solid color-mix(in srgb, var(--rate-primary) 22%, var(--rate-border)); border-radius: 999px; background: color-mix(in srgb, var(--rate-primary) 8%, transparent); padding: 0.18rem 0.68rem; color: var(--rate-primary); font-size: 0.7rem; font-weight: 850; backdrop-filter: blur(12px); }
.pricing-rate-card__subtitle { margin-top: 0.28rem; color: var(--rate-muted); font-size: 0.78rem; font-weight: 650; }

.pricing-rate-form { min-width: 0; padding: 0.9rem; }
.pricing-rate-form :deep(form) { width: 100%; }

.pricing-rate-wizard--new .pricing-rate-form :deep(form) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > * + *) { margin-top: 0 !important; }

/* Las cuatro secciones editables siguen montadas, pero el wizard muestra solo las del paso actual. */
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 4)) {
  display: none !important;
  margin: 0 !important;
}

.pricing-rate-wizard--step-1 .pricing-rate-form :deep(form > section:nth-of-type(2)),
.pricing-rate-wizard--step-1 .pricing-rate-form :deep(form > section:nth-of-type(3)) {
  display: block !important;
}

.pricing-rate-wizard--step-2 .pricing-rate-form :deep(form > section:nth-of-type(1)) {
  display: block !important;
  grid-column: 1 / -1;
}

.pricing-rate-wizard--step-3 .pricing-rate-form :deep(form > section:nth-of-type(4)) {
  display: block !important;
  grid-column: 1 / -1;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 4)) {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--rate-border) 78%, transparent) !important;
  border-radius: 21px !important;
  background: color-mix(in srgb, var(--rate-card) 68%, transparent) !important;
  padding: 0.8rem !important;
  box-shadow: 0 10px 28px rgb(15 23 42 / 5%) !important;
  backdrop-filter: blur(20px) saturate(135%);
  -webkit-backdrop-filter: blur(20px) saturate(135%);
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 4) > div:first-child) {
  min-height: 46px !important;
  margin: -0.15rem -0.15rem 0.7rem !important;
  cursor: pointer !important;
  border: 1px solid color-mix(in srgb, var(--rate-border) 54%, transparent);
  border-radius: 15px;
  background: color-mix(in srgb, var(--rate-bg) 48%, transparent);
  padding: 0.5rem 0.6rem;
  backdrop-filter: blur(18px) saturate(135%);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 4) > div:first-child > button) {
  display: inline-flex !important;
}

.pricing-rate-wizard--step-1 .pricing-rate-form :deep(form > section:nth-of-type(2) > div:last-child),
.pricing-rate-wizard--step-1 .pricing-rate-form :deep(form > section:nth-of-type(3) > div:nth-child(2)) {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 0.7rem !important;
}

.pricing-rate-wizard--step-2 .pricing-rate-form :deep(form > section:nth-of-type(1) > div:nth-child(2)) {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 0.7rem !important;
}

.pricing-rate-wizard--step-3 .pricing-rate-form :deep(form > section:nth-of-type(4) section) {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--rate-border) 75%, transparent) !important;
  border-radius: 15px !important;
  background: color-mix(in srgb, var(--rate-card) 72%, transparent) !important;
  box-shadow: none !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

/* Resumen real: costo, venta, utilidad, margen, alerta y acciones siempre visibles. */
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5)) {
  position: fixed !important;
  right: 1rem !important;
  bottom: 1rem !important;
  left: 1rem !important;
  z-index: 110 !important;
  display: block !important;
  width: auto !important;
  max-width: none !important;
  margin: 0 !important;
  border: 1px solid color-mix(in srgb, var(--rate-primary) 24%, var(--rate-border)) !important;
  border-radius: 22px !important;
  background: color-mix(in srgb, var(--dh-shell-strong) 78%, transparent) !important;
  padding: 0.9rem 1.05rem !important;
  box-shadow: 0 24px 70px rgb(0 0 0 / 24%) !important;
  backdrop-filter: blur(30px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(30px) saturate(160%) !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child) {
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 0 !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div) {
  padding: 0.15rem 1rem !important;
  border-right: 1px solid color-mix(in srgb, var(--rate-border) 72%, transparent);
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div:first-child) { padding-left: 0 !important; }
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div:last-child) { border-right: 0; }
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:last-child) { margin-top: 0.7rem !important; justify-content: flex-end !important; }

.pricing-rate-navigation {
  display: grid;
  grid-template-columns: minmax(130px, auto) 1fr minmax(130px, auto);
  align-items: center;
  gap: 0.8rem;
  border-top: 1px solid color-mix(in srgb, var(--rate-border) 72%, transparent);
  background: color-mix(in srgb, var(--rate-card) 60%, transparent);
  padding: 0.75rem 1rem;
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
}

.pricing-rate-navigation__button {
  display: inline-flex;
  min-height: 2.5rem;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: 14px;
  padding: 0.5rem 0.9rem;
  font-size: 0.78rem;
  font-weight: 850;
}

.pricing-rate-navigation__button:disabled { cursor: not-allowed; opacity: 0.38; }
.pricing-rate-navigation__button--secondary { border: 1px solid color-mix(in srgb, var(--rate-border) 90%, transparent); background: color-mix(in srgb, var(--rate-card) 66%, transparent); color: var(--rate-text); }
.pricing-rate-navigation__button--primary { border: 1px solid color-mix(in srgb, var(--rate-primary) 84%, transparent); background: var(--rate-primary); color: white; box-shadow: 0 8px 18px color-mix(in srgb, var(--rate-primary) 18%, transparent); }
.pricing-rate-navigation__progress { display: flex; align-items: baseline; justify-content: center; gap: 0.45rem; color: var(--rate-muted); text-align: center; }
.pricing-rate-navigation__progress span { color: var(--rate-text); font-size: 0.76rem; font-weight: 800; }
.pricing-rate-navigation__progress small { font-size: 0.68rem; font-weight: 800; }
.pricing-rate-navigation__finish-hint { justify-self: end; color: var(--rate-muted); font-size: 0.72rem; font-weight: 650; text-align: right; }

.pricing-rate-wizard--contextual .pricing-rate-form { padding: 1rem; }

@media (max-width: 1279px) {
  .pricing-rate-wizard--new .pricing-rate-form :deep(form) { grid-template-columns: 1fr; }

  .pricing-rate-wizard--step-1 .pricing-rate-form :deep(form > section:nth-of-type(2)),
  .pricing-rate-wizard--step-1 .pricing-rate-form :deep(form > section:nth-of-type(3)) {
    grid-column: 1;
  }

  .pricing-rate-wizard--step-2 .pricing-rate-form :deep(form > section:nth-of-type(1) > div:nth-child(2)) {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 760px) {
  .pricing-rate-wizard--new { margin: 0; padding: 0.45rem 0.45rem 15rem; border-radius: 20px; }
  .pricing-rate-stepper { width: 100%; margin-bottom: 0.7rem; padding-inline: 0.1rem; }
  .pricing-rate-step__number { width: 1.82rem; height: 1.82rem; box-shadow: 0 0 0 3px color-mix(in srgb, var(--rate-bg) 72%, transparent); }
  .pricing-rate-step::after { top: 0.88rem; left: calc(50% + 0.95rem); width: calc(100% - 1.9rem); }
  .pricing-rate-step__label { max-width: 6rem; font-size: 0.62rem; }
  .pricing-rate-card { border-radius: 20px; }
  .pricing-rate-card__header { min-height: 66px; padding: 0.85rem 1rem; }
  .pricing-rate-card__subtitle { font-size: 0.68rem; }
  .pricing-rate-form { padding: 0.6rem; }

  .pricing-rate-wizard--step-1 .pricing-rate-form :deep(form > section:nth-of-type(2) > div:last-child),
  .pricing-rate-wizard--step-1 .pricing-rate-form :deep(form > section:nth-of-type(3) > div:nth-child(2)),
  .pricing-rate-wizard--step-2 .pricing-rate-form :deep(form > section:nth-of-type(1) > div:nth-child(2)) {
    grid-template-columns: 1fr !important;
  }

  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5)) {
    right: 0.5rem !important;
    bottom: 0.5rem !important;
    left: 0.5rem !important;
    border-radius: 18px !important;
    padding: 0.7rem !important;
  }

  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child) {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 0.45rem !important;
  }

  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div) {
    padding: 0.35rem 0.55rem !important;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--rate-border) 55%, transparent);
  }

  .pricing-rate-navigation { grid-template-columns: 1fr 1fr; padding: 0.65rem; }
  .pricing-rate-navigation__progress { display: none; }
  .pricing-rate-navigation__finish-hint { grid-column: 2; }
}
</style>
