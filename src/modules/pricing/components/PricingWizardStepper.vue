<script setup lang="ts">
/**
 * Shared step navigation for Pricing and Operations.
 * Keep the steps, typography and action semantics consistent between both wizards.
 */
export interface PricingWizardStep {
  id: number
  label: string
  hint: string
}
defineProps<{
  steps: PricingWizardStep[]
  activeStep: number
  ariaLabel?: string
}>()
const emit = defineEmits<{ 'update:activeStep': [value: number] }>()
</script>

<template>
  <nav class="pricing-wizard-stepper" :aria-label="ariaLabel || 'Pasos del asistente'">
    <button
      v-for="step in steps"
      :key="step.id"
      type="button"
      class="pricing-wizard-step"
      :class="{
        'pricing-wizard-step--current': activeStep === step.id,
        'pricing-wizard-step--completed': activeStep > step.id,
      }"
      :aria-current="activeStep === step.id ? 'step' : undefined"
      @click="emit('update:activeStep', step.id)"
    >
      <span class="pricing-wizard-step__number">{{ String(step.id).padStart(2, '0') }}</span>
      <span class="pricing-wizard-step__copy">
        <strong>{{ step.label }}</strong>
        <small>{{ step.hint }}</small>
      </span>
    </button>
  </nav>
</template>

<style scoped>
.pricing-wizard-stepper {
  display: grid;
  grid-template-columns: repeat(var(--wizard-step-columns, 4), minmax(0, 1fr));
  gap: .55rem;
  margin-bottom: .9rem;
}
.pricing-wizard-step {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: .7rem;
  border: 1px solid var(--dh-border);
  border-radius: 20px;
  background: var(--dh-card);
  padding: .72rem .85rem;
  color: var(--dh-text-muted);
  text-align: left;
  transition: border-color 160ms ease, transform 160ms ease, color 160ms ease;
}
.pricing-wizard-step:hover { border-color: color-mix(in srgb,var(--dh-primary) 55%,var(--dh-border)); color: var(--dh-text); }
.pricing-wizard-step:focus-visible { outline: 2px solid var(--dh-primary); outline-offset: 2px; }
.pricing-wizard-step:active { transform: translateY(1px); }
.pricing-wizard-step--current,
.pricing-wizard-step--completed { border-color: color-mix(in srgb,var(--dh-primary) 55%,var(--dh-border)); }
.pricing-wizard-step--current { box-shadow: inset 0 0 0 1px color-mix(in srgb,var(--dh-primary) 18%,transparent); }
.pricing-wizard-step__number {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  flex: 0 0 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--dh-bg);
  color: var(--dh-text-muted);
  font-size: .7rem;
  font-weight: 950;
}
.pricing-wizard-step--current .pricing-wizard-step__number,
.pricing-wizard-step--completed .pricing-wizard-step__number { background: var(--dh-primary); color: white; }
.pricing-wizard-step__copy { display: flex; min-width: 0; flex-direction: column; }
.pricing-wizard-step__copy strong {
  overflow: hidden; color: var(--dh-text); font-size: .78rem; font-weight: 900;
  text-overflow: ellipsis; white-space: nowrap;
}
.pricing-wizard-step__copy small {
  display: -webkit-box; margin-top: .12rem; overflow: hidden; color: var(--dh-text-muted);
  font-size: .66rem; font-weight: 650; line-height: 1.25;
  -webkit-box-orient: vertical; -webkit-line-clamp: 2;
}
@media(max-width:1000px){.pricing-wizard-stepper{grid-template-columns:repeat(3,minmax(0,1fr));}}
@media(max-width:700px){.pricing-wizard-stepper{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:.4rem}.pricing-wizard-step{flex:0 0 min(72vw,240px);scroll-snap-align:start}.pricing-wizard-step__copy small{display:none}}
</style>
