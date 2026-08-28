<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { ImportRateDto, RateDto } from '@/core/interfaces/pricing'
import PricingRateFormDrawerLegacy from './PricingRateFormDrawerLegacy.vue'

type WizardStep = 1 | 2 | 3 | 4

const props = defineProps<{
  rate?: RateDto
  sourceImport?: ImportRateDto
  decisionInternationalLandFreight?: number | null
  onSaved?: (rateId?: string) => void | Promise<void>
}>()

const wizardRootRef = ref<HTMLElement | null>(null)
const activeStep = ref<WizardStep>(1)

const isWizardFlow = computed(() => !props.sourceImport)

const steps: Array<{ id: WizardStep; label: string; hint: string }> = [
  { id: 1, label: 'Ruta y equipo', hint: 'Modalidad, proveedor, puertos y distribución del equipo' },
  { id: 2, label: 'Vigencia', hint: 'Moneda, Incoterm, días libres y fechas' },
  { id: 3, label: 'Datos comerciales', hint: 'Cliente, QUO, IDTRA y condiciones comerciales' },
  { id: 4, label: 'Líneas y margen', hint: 'Rubros, seguro, costo, venta, utilidad y guardado' },
]

const activeStepMeta = computed(() => steps.find((item) => item.id === activeStep.value) ?? steps[0]!)

function goToStep(step: WizardStep) {
  if (!isWizardFlow.value) return
  activeStep.value = step
  requestAnimationFrame(() => wizardRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function previousStep() {
  if (activeStep.value > 1) goToStep((activeStep.value - 1) as WizardStep)
}

function nextStep() {
  if (activeStep.value < 4) goToStep((activeStep.value + 1) as WizardStep)
}
</script>

<template>
  <div
    ref="wizardRootRef"
    class="pricing-edit-wizard"
    :class="[
      isWizardFlow ? 'pricing-edit-wizard--guided' : 'pricing-edit-wizard--contextual',
      isWizardFlow ? `pricing-edit-wizard--step-${activeStep}` : '',
    ]"
  >
    <div class="pricing-edit-wizard__shell">
      <header v-if="isWizardFlow" class="pricing-edit-wizard__hero">
        <div>
          <p class="pricing-edit-wizard__eyebrow">Edición guiada</p>
          <div class="pricing-edit-wizard__title-row">
            <h2>{{ props.rate ? 'Editar tarifa' : 'Nueva tarifa' }}</h2>
            <span>{{ props.rate ? 'Edición' : 'Borrador' }}</span>
          </div>
          <p>
            Mantiene el mismo lenguaje visual del wizard de Pricing y muestra una sola etapa a la vez.
          </p>
        </div>
      </header>

      <nav v-if="isWizardFlow" class="pricing-edit-stepper" aria-label="Edición de tarifa por pasos">
        <button
          v-for="item in steps"
          :key="item.id"
          type="button"
          class="pricing-edit-step"
          :class="{
            'pricing-edit-step--current': activeStep === item.id,
            'pricing-edit-step--completed': activeStep > item.id,
          }"
          :aria-current="activeStep === item.id ? 'step' : undefined"
          @click="goToStep(item.id)"
        >
          <span class="pricing-edit-step__number">{{ String(item.id).padStart(2, '0') }}</span>
          <span class="pricing-edit-step__copy">
            <strong>{{ item.label }}</strong>
            <small>{{ item.hint }}</small>
          </span>
        </button>
      </nav>

      <section class="pricing-edit-card">
        <header v-if="isWizardFlow" class="pricing-edit-card__header">
          <div>
            <p>PASO {{ activeStep }} DE 4</p>
            <h3>{{ activeStepMeta.label }}</h3>
            <span>{{ activeStepMeta.hint }}</span>
          </div>
        </header>

        <div class="pricing-edit-form">
          <PricingRateFormDrawerLegacy
            :rate="props.rate"
            :source-import="props.sourceImport"
            :decision-international-land-freight="props.decisionInternationalLandFreight"
            :on-saved="props.onSaved"
          />
        </div>

        <footer v-if="isWizardFlow" class="pricing-edit-navigation">
          <button
            type="button"
            class="pricing-edit-navigation__button pricing-edit-navigation__button--secondary"
            :disabled="activeStep === 1"
            @click="previousStep"
          >
            <ChevronLeft class="h-4 w-4" />
            Regresar
          </button>

          <div class="pricing-edit-navigation__progress">
            <span>{{ activeStepMeta.label }}</span>
            <small>{{ activeStep }}/4</small>
          </div>

          <button
            v-if="activeStep < 4"
            type="button"
            class="pricing-edit-navigation__button pricing-edit-navigation__button--primary"
            @click="nextStep"
          >
            Siguiente
            <ChevronRight class="h-4 w-4" />
          </button>
          <span v-else class="pricing-edit-navigation__finish">
            Revise el resumen y use “Guardar cambios”.
          </span>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pricing-edit-wizard {
  --edit-primary: var(--dh-primary);
  --edit-border: var(--dh-border);
  --edit-card: var(--dh-card);
  --edit-bg: var(--dh-bg);
  --edit-text: var(--dh-text);
  --edit-muted: var(--dh-text-muted);
  width: 100%;
  min-width: 0;
  color: var(--edit-text);
  scroll-margin-top: 1rem;
}

.pricing-edit-wizard--guided {
  padding: 0.75rem 0.75rem 1.25rem;
}

.pricing-edit-wizard__shell {
  width: min(100%, 1500px);
  min-width: 0;
  margin: 0 auto;
}

.pricing-edit-wizard__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
  border: 1px solid var(--edit-border);
  border-radius: 28px;
  background: var(--edit-card);
  padding: 1.15rem 1.3rem;
}

.pricing-edit-wizard__eyebrow,
.pricing-edit-card__header p {
  color: var(--edit-primary);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.pricing-edit-wizard__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.25rem;
}

.pricing-edit-wizard__title-row h2 {
  font-size: clamp(1.45rem, 2vw, 2rem);
  font-weight: 950;
  letter-spacing: -0.035em;
}

.pricing-edit-wizard__title-row span {
  border: 1px solid color-mix(in srgb, var(--edit-primary) 35%, var(--edit-border));
  border-radius: 999px;
  padding: 0.28rem 0.65rem;
  color: var(--edit-primary);
  font-size: 0.72rem;
  font-weight: 900;
}

.pricing-edit-wizard__hero > div > p:last-child {
  margin-top: 0.28rem;
  color: var(--edit-muted);
  font-size: 0.82rem;
  font-weight: 650;
}

.pricing-edit-stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
  margin-bottom: 0.9rem;
}

.pricing-edit-step {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.7rem;
  border: 1px solid var(--edit-border);
  border-radius: 20px;
  background: var(--edit-card);
  padding: 0.72rem 0.85rem;
  color: var(--edit-muted);
  text-align: left;
  transition: border-color 160ms ease, transform 160ms ease, color 160ms ease;
}

.pricing-edit-step:hover {
  border-color: color-mix(in srgb, var(--edit-primary) 55%, var(--edit-border));
  color: var(--edit-text);
}

.pricing-edit-step:active { transform: translateY(1px); }

.pricing-edit-step--current,
.pricing-edit-step--completed {
  border-color: color-mix(in srgb, var(--edit-primary) 55%, var(--edit-border));
}

.pricing-edit-step--current {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--edit-primary) 18%, transparent);
}

.pricing-edit-step__number {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  flex: 0 0 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--edit-bg);
  color: var(--edit-muted);
  font-size: 0.7rem;
  font-weight: 950;
}

.pricing-edit-step--current .pricing-edit-step__number,
.pricing-edit-step--completed .pricing-edit-step__number {
  background: var(--edit-primary);
  color: white;
}

.pricing-edit-step__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.pricing-edit-step__copy strong {
  overflow: hidden;
  color: var(--edit-text);
  font-size: 0.78rem;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pricing-edit-step__copy small {
  display: -webkit-box;
  margin-top: 0.12rem;
  overflow: hidden;
  color: var(--edit-muted);
  font-size: 0.66rem;
  font-weight: 650;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.pricing-edit-card {
  overflow: hidden;
  border: 1px solid var(--edit-border);
  border-radius: 28px;
  background: var(--edit-card);
}

.pricing-edit-card__header {
  border-bottom: 1px solid var(--edit-border);
  background: var(--edit-card);
  padding: 1rem 1.25rem;
}

.pricing-edit-card__header h3 {
  margin-top: 0.22rem;
  font-size: 1.3rem;
  font-weight: 950;
  letter-spacing: -0.025em;
}

.pricing-edit-card__header span {
  display: block;
  margin-top: 0.18rem;
  color: var(--edit-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.pricing-edit-form {
  min-width: 0;
  background: var(--edit-bg);
  padding: 1rem;
}

.pricing-edit-form :deep(form) {
  display: block !important;
  width: 100%;
  min-width: 0;
}

.pricing-edit-form :deep(form > * + *) {
  margin-top: 0.9rem !important;
}

.pricing-edit-form :deep(input),
.pricing-edit-form :deep(select),
.pricing-edit-form :deep(textarea) {
  max-width: 100%;
}

/* La edición usa marcadores explícitos: nunca vuelve a depender de nth-of-type. */
.pricing-edit-wizard--guided .pricing-edit-form :deep(.pricing-edit-stage),
.pricing-edit-wizard--guided .pricing-edit-form :deep(.pricing-edit-summary) {
  display: none !important;
}

.pricing-edit-wizard--step-1 .pricing-edit-form :deep(.pricing-edit-stage--route),
.pricing-edit-wizard--step-2 .pricing-edit-form :deep(.pricing-edit-stage--validity),
.pricing-edit-wizard--step-3 .pricing-edit-form :deep(.pricing-edit-stage--commercial),
.pricing-edit-wizard--step-4 .pricing-edit-form :deep(.pricing-edit-stage--lines),
.pricing-edit-wizard--step-4 .pricing-edit-form :deep(.pricing-edit-summary) {
  display: block !important;
}

.pricing-edit-wizard--guided .pricing-edit-form :deep(.pricing-edit-stage),
.pricing-edit-wizard--guided .pricing-edit-form :deep(.pricing-edit-summary),
.pricing-edit-wizard--guided .pricing-edit-form :deep(form > section:first-child) {
  width: 100%;
  min-width: 0;
  border-radius: 24px !important;
  background: var(--edit-card) !important;
  box-shadow: none !important;
}

/* El resumen deja de flotar sobre los campos: forma parte de la última pantalla. */
.pricing-edit-form :deep(.pricing-edit-summary) {
  position: static !important;
  inset: auto !important;
  z-index: auto !important;
  margin-top: 1rem !important;
  background: var(--edit-card) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.pricing-edit-navigation {
  display: grid;
  grid-template-columns: minmax(150px, auto) 1fr minmax(150px, auto);
  align-items: center;
  gap: 0.75rem;
  border-top: 1px solid var(--edit-border);
  background: var(--edit-card);
  padding: 0.9rem 1rem;
}

.pricing-edit-navigation__button {
  display: inline-flex;
  min-height: 2.7rem;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 16px;
  padding: 0.62rem 1rem;
  font-size: 0.78rem;
  font-weight: 900;
  transition: transform 160ms ease, opacity 160ms ease;
}

.pricing-edit-navigation__button:not(:disabled):active { transform: translateY(1px); }
.pricing-edit-navigation__button:disabled { cursor: not-allowed; opacity: 0.4; }

.pricing-edit-navigation__button--secondary {
  border: 1px solid var(--edit-border);
  background: var(--edit-bg);
  color: var(--edit-text);
}

.pricing-edit-navigation__button--primary {
  border: 1px solid var(--edit-primary);
  background: var(--edit-primary);
  color: white;
}

.pricing-edit-navigation__progress {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--edit-muted);
  font-size: 0.72rem;
  font-weight: 800;
}

.pricing-edit-navigation__progress span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pricing-edit-navigation__progress small,
.pricing-edit-navigation__finish {
  color: var(--edit-muted);
  font-size: 0.7rem;
  font-weight: 800;
}

.pricing-edit-navigation__finish {
  justify-self: end;
  text-align: right;
}

@media (max-width: 1024px) {
  .pricing-edit-stepper { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .pricing-edit-wizard--guided { padding: 0.35rem; }
  .pricing-edit-stepper { grid-template-columns: 1fr; }
  .pricing-edit-step__copy small { display: none; }
  .pricing-edit-navigation {
    grid-template-columns: 1fr 1fr;
  }
  .pricing-edit-navigation__progress { display: none; }
  .pricing-edit-navigation__finish {
    grid-column: 1 / -1;
    justify-self: stretch;
    text-align: center;
  }
}
</style>
