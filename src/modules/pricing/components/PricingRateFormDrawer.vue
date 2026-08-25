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
    <div class="pricing-rate-wizard__inner">
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
              Complete los datos de la tarifa, la ruta, los equipos y los costos en una sola vista.
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
}

.pricing-rate-wizard--new {
  margin: -0.25rem;
  padding: 1.25rem;
  border-radius: 30px;
  background: color-mix(in srgb, var(--rate-bg) 88%, var(--rate-card));
}

.pricing-rate-wizard__inner {
  width: min(100%, 1500px);
  margin-inline: auto;
}

.pricing-rate-stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: min(100%, 860px);
  margin: 0 auto 1.35rem;
}

.pricing-rate-step {
  position: relative;
  z-index: 0;
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  color: color-mix(in srgb, var(--rate-muted) 72%, transparent);
  text-align: center;
}

.pricing-rate-step::after {
  position: absolute;
  top: 1.05rem;
  left: calc(50% + 1.2rem);
  z-index: -1;
  width: calc(100% - 2.4rem);
  height: 2px;
  content: '';
  background: color-mix(in srgb, var(--rate-border) 85%, transparent);
}

.pricing-rate-step:nth-child(-n + 2)::after {
  background: var(--rate-primary);
}

.pricing-rate-step:last-child::after {
  display: none;
}

.pricing-rate-step__number {
  display: inline-flex;
  width: 2.15rem;
  height: 2.15rem;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--rate-border);
  border-radius: 999px;
  background: var(--rate-card);
  color: var(--rate-muted);
  font-size: 0.75rem;
  font-weight: 900;
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--rate-bg) 88%, var(--rate-card));
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
  max-width: 10rem;
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1.2;
}

.pricing-rate-card {
  overflow: hidden;
  border: 1px solid var(--rate-border);
  border-radius: 28px;
  background: var(--rate-card);
  box-shadow: 0 18px 50px rgb(15 23 42 / 7%);
}

.pricing-rate-card__header {
  display: flex;
  min-height: 82px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--rate-border);
  padding: 1.2rem 1.6rem;
}

.pricing-rate-card__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
}

.pricing-rate-card__title {
  color: var(--rate-text);
  font-size: clamp(1.2rem, 1.8vw, 1.5rem);
  font-weight: 900;
  letter-spacing: -0.025em;
}

.pricing-rate-card__status {
  display: inline-flex;
  min-height: 1.7rem;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--rate-primary) 18%, var(--rate-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--rate-primary) 7%, var(--rate-card));
  padding: 0.2rem 0.7rem;
  color: var(--rate-primary);
  font-size: 0.72rem;
  font-weight: 850;
}

.pricing-rate-card__subtitle {
  margin-top: 0.3rem;
  color: var(--rate-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.pricing-rate-form {
  min-width: 0;
}

.pricing-rate-form :deep(form) {
  width: 100%;
}

/*
 * Nueva tarifa manual: el formulario real conserva toda su lógica, pero se presenta
 * como el mockup aprobado: un solo panel, secciones planas, datos arriba y costos abajo.
 */
.pricing-rate-wizard--new .pricing-rate-form :deep(form) {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  grid-template-areas:
    'general route'
    'commercial route'
    'costs costs'
    'summary summary';
  gap: 0 !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > * + *) {
  margin-top: 0 !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1)) {
  grid-area: route;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2)) {
  grid-area: general;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3)) {
  grid-area: commercial;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4)) {
  grid-area: costs;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5)) {
  grid-area: summary;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 5)) {
  margin: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1)),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2)),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3)),
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4)) {
  padding: 1.45rem 1.55rem !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1)) {
  border-left: 1px solid var(--rate-border) !important;
  border-bottom: 1px solid var(--rate-border) !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2)) {
  border-bottom: 1px solid var(--rate-border) !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3)) {
  border-bottom: 1px solid var(--rate-border) !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4)) {
  border-bottom: 1px solid var(--rate-border) !important;
  background: color-mix(in srgb, var(--rate-bg) 48%, transparent) !important;
}

/* Encabezados internos simples, sin las tarjetas/etapas originales. */
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 4) > div:first-child) {
  min-height: auto !important;
  margin-bottom: 1rem !important;
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

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 4) h3) {
  color: var(--rate-primary);
  font-size: 0 !important;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1) h3::after) {
  content: 'Ruta y equipo';
  font-size: 1rem;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2) h3::after) {
  content: 'Datos generales';
  font-size: 1rem;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3) h3::after) {
  content: 'Datos comerciales';
  font-size: 1rem;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) h3::after) {
  content: 'Costos y márgenes';
  font-size: 1rem;
}

/* Hacer la zona de datos generales compacta como en el mockup. */
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2) > div:last-child) {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3) > div:nth-child(2)) {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

/* Ruta: menos espacio visual, sin paneles flotantes. */
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1) > div:nth-child(2)) {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1) div[class*='rounded-[22px]']) {
  margin-top: 1rem !important;
  border: 1px solid var(--rate-border) !important;
  border-radius: 18px !important;
  background: color-mix(in srgb, var(--rate-bg) 54%, var(--rate-card)) !important;
  padding: 1rem !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1) div[class*='rounded-2xl']) {
  border-radius: 14px !important;
  box-shadow: none !important;
}

/* Condiciones comerciales: que se sientan parte del mismo panel. */
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3) div[class*='rounded-2xl']) {
  border-radius: 14px !important;
  box-shadow: none !important;
}

/* Costos: apariencia tabular, sin tarjetas grandes por rubro. */
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) > div:nth-child(2)) {
  gap: 0.75rem !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) section) {
  overflow: hidden;
  border: 1px solid var(--rate-border) !important;
  border-radius: 16px !important;
  background: var(--rate-card) !important;
  box-shadow: none !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) section > header) {
  min-height: 44px;
  background: color-mix(in srgb, var(--rate-bg) 66%, var(--rate-card)) !important;
  padding: 0.7rem 0.9rem !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) section > header p) {
  display: none;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) article) {
  padding: 0.8rem 0.9rem !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) article > div:first-child) {
  grid-template-columns: minmax(220px, 1.5fr) minmax(130px, 0.75fr) minmax(120px, 0.65fr) minmax(120px, 0.65fr) auto !important;
  gap: 0.75rem !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) article p[class*='rounded-xl']) {
  margin-top: 0.45rem !important;
  border-radius: 10px !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) div[class*='rounded-[22px]']) {
  border-radius: 16px !important;
  box-shadow: none !important;
}

/* Botón de rubro manual y opcionales pegados a la tabla, no como bloques separados. */
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) > div[class*='border-t']) {
  margin-top: 1rem !important;
  padding-top: 1rem !important;
}

/* Resumen: franja inferior compacta como el resumen lateral/inferior del mockup. */
.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5)) {
  position: relative !important;
  bottom: auto !important;
  z-index: 1 !important;
  padding: 1rem 1.55rem 1.15rem !important;
  border-top: 0 !important;
  background: color-mix(in srgb, var(--rate-primary) 4%, var(--rate-card)) !important;
  backdrop-filter: none !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child) {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div) {
  padding: 0.25rem 1rem;
  border-right: 1px solid var(--rate-border);
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div:first-child) {
  padding-left: 0;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div:last-child) {
  border-right: 0;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:last-child) {
  margin-top: 1rem !important;
  justify-content: flex-end !important;
}

.pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:last-child > *) {
  min-width: 150px;
}

/* Edición/importación: conservar toda la información funcional, solo dentro del contenedor limpio. */
.pricing-rate-wizard--contextual .pricing-rate-form :deep(form) {
  padding: 1rem;
}

@media (max-width: 1279px) {
  .pricing-rate-wizard--new .pricing-rate-form :deep(form) {
    display: block;
  }

  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(-n + 5)) {
    border-right: 0 !important;
    border-left: 0 !important;
    border-bottom: 1px solid var(--rate-border) !important;
  }

  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4) article > div:first-child) {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 760px) {
  .pricing-rate-wizard--new {
    margin: 0;
    padding: 0.5rem;
    border-radius: 20px;
  }

  .pricing-rate-stepper {
    margin-bottom: 0.9rem;
  }

  .pricing-rate-step__number {
    width: 1.85rem;
    height: 1.85rem;
  }

  .pricing-rate-step::after {
    top: 0.9rem;
    left: calc(50% + 1rem);
    width: calc(100% - 2rem);
  }

  .pricing-rate-step__label {
    max-width: 5rem;
    font-size: 0.64rem;
  }

  .pricing-rate-card {
    border-radius: 20px;
  }

  .pricing-rate-card__header {
    min-height: 70px;
    padding: 1rem;
  }

  .pricing-rate-card__subtitle {
    display: none;
  }

  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1)),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2)),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3)),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(4)),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5)) {
    padding: 1rem !important;
  }

  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(1) > div:nth-child(2)),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(2) > div:last-child),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(3) > div:nth-child(2)),
  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child) {
    grid-template-columns: 1fr !important;
  }

  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div) {
    padding: 0.65rem 0;
    border-right: 0;
    border-bottom: 1px solid var(--rate-border);
  }

  .pricing-rate-wizard--new .pricing-rate-form :deep(form > section:nth-of-type(5) > div:first-child > div:last-child) {
    border-bottom: 0;
  }
}
</style>
