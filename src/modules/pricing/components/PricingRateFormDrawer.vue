<script setup lang="ts">
import type { ImportRateDto, RateDto } from '@/core/interfaces/pricing'
import PricingRateFormDrawerLegacy from './PricingRateFormDrawerLegacy.vue'

const props = defineProps<{
  rate?: RateDto
  sourceImport?: ImportRateDto
  decisionInternationalLandFreight?: number | null
  onSaved?: (rateId?: string) => void | Promise<void>
}>()
</script>

<template>
  <div
    class="pricing-rate-wizard"
    :class="{
      'pricing-rate-wizard--new': !props.rate && !props.sourceImport,
      'pricing-rate-wizard--contextual': Boolean(props.rate || props.sourceImport),
    }"
  >
    <nav class="pricing-rate-stepper" aria-label="Flujo de creación de tarifa">
      <div class="pricing-rate-step pricing-rate-step--active">
        <span class="pricing-rate-step__number">1</span>
        <span class="pricing-rate-step__label">Datos generales</span>
      </div>
      <div class="pricing-rate-step pricing-rate-step--active">
        <span class="pricing-rate-step__number">2</span>
        <span class="pricing-rate-step__label">Ruta</span>
      </div>
      <div class="pricing-rate-step pricing-rate-step--active">
        <span class="pricing-rate-step__number">3</span>
        <span class="pricing-rate-step__label">Equipos y costos</span>
      </div>
      <div class="pricing-rate-step">
        <span class="pricing-rate-step__number">4</span>
        <span class="pricing-rate-step__label">Confirmación</span>
      </div>
    </nav>

    <section class="pricing-rate-card">
      <header class="pricing-rate-card__header">
        <div>
          <div class="pricing-rate-card__title-row">
            <h2 class="pricing-rate-card__title">
              {{ props.rate ? 'Editar tarifa' : 'Nueva tarifa' }}
            </h2>
            <span class="pricing-rate-card__status">
              {{ props.rate ? 'Edición' : props.sourceImport ? 'Desde importación' : 'Borrador' }}
            </span>
          </div>
          <p class="pricing-rate-card__subtitle">
            Complete la información operativa y comercial. Dhole mantiene los catálogos, reglas,
            costos, margen y borrador sin conexión del flujo actual.
          </p>
        </div>
      </header>

      <div class="pricing-rate-form">
        <PricingRateFormDrawerLegacy
          :rate="props.rate"
          :source-import="props.sourceImport"
          :decision-international-land-freight="props.decisionInternationalLandFreight"
          :on-saved="props.onSaved"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.pricing-rate-wizard {
  --rate-primary: var(--dh-primary);
  --rate-border: var(--dh-border);
  --rate-card: var(--dh-card);
  --rate-text: var(--dh-text);
  --rate-muted: var(--dh-text-muted);

  width: 100%;
  padding: 0.25rem 0.25rem 1rem;
}

.pricing-rate-stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  max-width: 920px;
  margin: 0 auto 1.25rem;
}

.pricing-rate-step {
  position: relative;
  z-index: 0;
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  color: color-mix(in srgb, var(--rate-muted) 78%, transparent);
  text-align: center;
}

.pricing-rate-step::after {
  position: absolute;
  top: 1rem;
  left: calc(50% + 1.1rem);
  z-index: -1;
  width: calc(100% - 2.2rem);
  height: 2px;
  content: '';
  background: var(--rate-border);
}

.pricing-rate-step:nth-child(-n + 2)::after {
  background: var(--rate-primary);
}

.pricing-rate-step:last-child::after {
  display: none;
}

.pricing-rate-step__number {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--rate-border);
  border-radius: 999px;
  background: var(--rate-card);
  color: var(--rate-muted);
  font-size: 0.75rem;
  font-weight: 900;
  box-shadow: 0 0 0 4px var(--rate-card);
}

.pricing-rate-step--active {
  color: var(--rate-primary);
}

.pricing-rate-step--active .pricing-rate-step__number {
  border-color: var(--rate-primary);
  background: var(--rate-primary);
  color: white;
}

.pricing-rate-step__label {
  max-width: 9rem;
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1.2;
}

.pricing-rate-card {
  overflow: hidden;
  border: 1px solid var(--rate-border);
  border-radius: 28px;
  background: var(--rate-card);
  box-shadow: 0 18px 52px rgb(15 23 42 / 8%);
}

.pricing-rate-card__header {
  display: flex;
  min-height: 78px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--rate-border);
  padding: 1.1rem 1.4rem;
}

.pricing-rate-card__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
}

.pricing-rate-card__title {
  color: var(--rate-text);
  font-size: clamp(1.15rem, 1.7vw, 1.45rem);
  font-weight: 900;
  letter-spacing: -0.025em;
}

.pricing-rate-card__status {
  display: inline-flex;
  align-items: center;
  min-height: 1.75rem;
  border: 1px solid color-mix(in srgb, var(--rate-primary) 15%, var(--rate-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--rate-primary) 7%, var(--rate-card));
  padding: 0.2rem 0.65rem;
  color: var(--rate-muted);
  font-size: 0.72rem;
  font-weight: 800;
}

.pricing-rate-card__subtitle {
  max-width: 780px;
  margin-top: 0.3rem;
  color: var(--rate-muted);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.45;
}

.pricing-rate-form {
  min-width: 0;
}

/* Mantener el flujo funcional actual, pero quitar el aspecto de tarjetas flotantes repetidas. */
.pricing-rate-form :deep(form) {
  width: 100%;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form) {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0 !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > * + *) {
  margin-top: 0 !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1)),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2)),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3)),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4)),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5)) {
  margin: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1)) {
  grid-column: 7 / 13;
  grid-row: 1;
  border-left: 1px solid var(--rate-border) !important;
  border-bottom: 1px solid var(--rate-border) !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2)) {
  grid-column: 1 / 7;
  grid-row: 1;
  border-bottom: 1px solid var(--rate-border) !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3)) {
  grid-column: 1 / -1;
  grid-row: 2;
  border-bottom: 1px solid var(--rate-border) !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4)) {
  grid-column: 1 / 10;
  grid-row: 3;
  border-right: 1px solid var(--rate-border) !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5)) {
  position: relative !important;
  bottom: auto !important;
  z-index: 1 !important;
  grid-column: 10 / 13;
  grid-row: 3;
  align-self: start;
  padding: 1.25rem !important;
  backdrop-filter: none !important;
}

/* Encabezados más limpios: el stepper ya comunica la secuencia. */
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 4) > div:first-child) {
  pointer-events: none;
  cursor: default !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 4) > div:first-child > span:first-child),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 4) > div:first-child > button) {
  display: none !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 4) > div:first-child p) {
  display: none !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1) h3),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2) h3),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3) h3),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) h3) {
  color: var(--rate-primary);
  font-size: 0 !important;
  font-weight: 900;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1) h3::after) {
  content: '2. Ruta y equipo';
  font-size: 0.98rem;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2) h3::after) {
  content: '1. Datos generales';
  font-size: 0.98rem;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3) h3::after) {
  content: 'Datos comerciales';
  font-size: 0.98rem;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) h3::after) {
  content: '3. Costos y márgenes';
  font-size: 0.98rem;
}

/* Menos volumen visual en las tarjetas internas, manteniendo todos los controles existentes. */
.pricing-rate-wizard--new .pricing-rate-form :deep(section section[class*='rounded-[24px]']),
.pricing-rate-wizard--new .pricing-rate-form :deep(div[class*='rounded-[22px]']) {
  border-radius: 16px !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(article) {
  padding-top: 0.8rem !important;
  padding-bottom: 0.8rem !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child) {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div) {
  border-bottom: 1px solid var(--rate-border);
  padding-bottom: 0.75rem;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div:last-child) {
  border-bottom: 0;
  padding-bottom: 0;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:last-child) {
  justify-content: stretch !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:last-child > *) {
  flex: 1 1 auto;
}

.pricing-rate-wizard--contextual .pricing-rate-form :deep(form) {
  padding: 1rem;
}

@media (max-width: 1279px) {
  .pricing-rate-wizard--new .pricing-rate-form :deep(form) {
    display: block;
  }

  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1)),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2)),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3)),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4)),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5)) {
    border-bottom: 1px solid var(--rate-border) !important;
    border-left: 0 !important;
    border-right: 0 !important;
  }
}

@media (max-width: 720px) {
  .pricing-rate-wizard {
    padding-inline: 0;
  }

  .pricing-rate-stepper {
    margin-bottom: 0.9rem;
  }

  .pricing-rate-step__label {
    max-width: 4.7rem;
    font-size: 0.65rem;
  }

  .pricing-rate-step::after {
    left: calc(50% + 0.9rem);
    width: calc(100% - 1.8rem);
  }

  .pricing-rate-card {
    border-radius: 20px;
  }

  .pricing-rate-card__header {
    padding: 1rem;
  }

  .pricing-rate-card__subtitle {
    display: none;
  }
}
</style>
