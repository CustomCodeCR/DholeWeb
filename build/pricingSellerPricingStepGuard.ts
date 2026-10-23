import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

// Runs after the other wizard transformations, which also rewrite goToStep,
// the stepbar and its footer. Sales owns screens 1-4; Pricing owns 5-8.
function patchWizard(source: string): string {
  let code = source
  function replaceOne(anchor: string, replacement: string, label: string) {
    const count = code.split(anchor).length - 1
    if (count !== 1)
      throw new Error(`[pricingSellerPricingStepGuard] ${label}: ${count} coincidencias (esperada 1)`)
    code = code.replace(anchor, replacement)
  }

  replaceOne(
    'const step = ref(1)',
    `const step = ref(1)
const pricingSellerScreensLocked = computed(() =>
  !props.viewOnly && Boolean(props.rateRequestId || props.modificationRequestId),
)
watch([step, () => props.rateRequestId, () => props.modificationRequestId], () => {
  // Includes direct step assignments from other plugins, async hydration,
  // reloads and back navigation (not just clicks on the stepbar).
  if (pricingSellerScreensLocked.value && step.value < 5) step.value = 5
}, { immediate: true, flush: 'sync' })`,
    'request navigation state',
  )

  replaceOne(
    'function goToStep(target: number) {',
    `function goToStep(target: number) {
  if (pricingSellerScreensLocked.value && target < 5) return`,
    'stepbar navigation guard',
  )
  replaceOne(
    'function previous() {',
    `function previous() {
  if (pricingSellerScreensLocked.value && step.value <= 5) return`,
    'back navigation floor',
  )
  replaceOne(
    'async function next() {',
    `async function next() {
  if (pricingSellerScreensLocked.value && step.value < 5) { step.value = 5; return }`,
    'forward navigation floor',
  )

  // Four steps remain visible in Pricing. Avoid an eight-column grid with
  // empty cells after hiding the seller-owned tabs.
  // Visual-only grid optimisation: other compatibility plugins can rewrite the
  // grid class before this last transform. Never break production for styling.
  code = code.replace(
    /:class="viewOnly \? 'xl:grid-cols-9' : 'xl:grid-cols-8'"/,
    `:class="pricingSellerScreensLocked ? 'xl:grid-cols-4' : viewOnly ? 'xl:grid-cols-9' : 'xl:grid-cols-8'"`,
  )

  // Keep absolute 05-08 numbering; hide tabs 01-04 instead of reindexing
  // their IDs to 01-04 and accidentally opening the wrong steps.
  replaceOne(
    '@click="goToStep(index + 1)"',
    `v-show="!pricingSellerScreensLocked || index >= 4"
        :disabled="pricingSellerScreensLocked && index < 4"
        @click="goToStep(index + 1)"`,
    'hidden Sales step buttons',
  )

  const backButton = code.match(/<DhButton[^>]*@click="previous"[^>]*>/)
  if (!backButton || !backButton[0].includes(':disabled="'))
    throw new Error('[pricingSellerPricingStepGuard] Back button anchor not found')
  const updatedButton = backButton[0].replace(
    /:disabled="([^"]*)"/,
    (_whole, condition: string) =>
      `:disabled="(${condition}) || (pricingSellerScreensLocked && step <= 5)"`,
  )
  code = code.replace(backButton[0], updatedButton)

  const panel = '<section class="crystal-panel min-h-[470px] p-5 md:p-8"'
  replaceOne(panel, `<div v-if="props.modificationRequestId && !pricingModificationApplied"
      class="crystal-soft p-5 text-sm font-semibold" role="status">
      {{ pricingModificationLoading ? 'Cargando solicitud de modificación de Ventas…'
        : pricingModificationWorkItem && loadingExistingRate ? 'Preparando tarifa original…'
        : pricingModificationWorkItem ? 'Aplicando los cambios solicitados por Ventas…'
        : 'No se pudo cargar la modificación solicitada. Compruebe la conexión antes de continuar.' }}
    </div>
    <section v-if="!props.modificationRequestId || pricingModificationApplied"
      class="crystal-panel min-h-[470px] p-5 md:p-8"`, 'requested proposal readiness')

  return code
}

export function pricingSellerPricingStepGuard(): Plugin {
  return {
    name: 'dhole-pricing-seller-pricing-step-guard',
    // Keep NORMAL phase and register after all other wizard plugins, before vue().
    transform(source, id) {
      if (id.includes('?')) return null
      if (!id.replaceAll('\\', '/').endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
