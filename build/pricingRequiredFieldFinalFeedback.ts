import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

/**
 * Apply validation after the legacy Pricing transforms rewrite next() and the
 * footer buttons. Source-only validation was being silently overwritten.
 */
export function pricingRequiredFieldFinalFeedback(): Plugin {
  return {
    name: 'dhole-pricing-required-field-final-feedback',
    // Normal phase, last in vite.config.ts, before Vue compilation.
    transform(source, id) {
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null

      let code = source
      function replaceOnce(needle: string, replacement: string, label: string) {
        const count = code.split(needle).length - 1
        if (count !== 1)
          throw new Error('[pricingRequiredFieldFinalFeedback] ' + label + ': found ' + count)
        code = code.replace(needle, replacement)
      }

      replaceOnce(
        'async function next() {',
        [
          'async function next() {',
          '  if (!props.viewOnly && !validateRequiredFields()) return',
          '  if (!props.viewOnly && !requirements20260908Ready.value) {',
          '    toastStore.warning(',
          "      'No se puede continuar',",
          "      step.value === 4 && form.dangerousCargo && !hasDangerousTechSheet.value",
          "        ? 'Adjunte la ficha técnica / MSDS de la carga peligrosa antes de continuar.'",
          "        : 'Revise la distribución de equipo y los campos obligatorios de esta pantalla.',",
          '    )',
          '    return',
          '  }',
          '  if (!props.viewOnly && !canNext.value) {',
          "    toastStore.warning('Faltan datos para continuar',",
          "      'Revise las selecciones y cantidades de esta pantalla. Los campos pendientes aparecen marcados en rojo.')",
          '    return',
          '  }',
        ].join('\n'),
        'navigation validation',
      )

      const multimodalNext = 'function continueSellerMultimodalStep3() {'
      if (code.includes(multimodalNext)) {
        code = code.replace(multimodalNext,
          multimodalNext + '\n  if (!validateRequiredFields()) return')
      }

      replaceOnce(
        'async function saveOpenRequest() {',
        'async function saveOpenRequest() {\n  if (!validateMaritimePodBeforeSaving() || !validateCargoBeforeSaving()) return\n  if (!validateRequiredFields()) return',
        'seller request validation',
      )

      // Preserve Anticipado / Redestino after legacy exact-string transforms.
      const sellerHandling = "    form.carrierHaulage = false\n    form.validTo = ''"
      if (code.includes(sellerHandling)) {
        code = code.replace(sellerHandling,
          "    form.carrierHaulage = false\n    form.portHandlingMode = sellerPortHandlingMode.value\n    form.validTo = ''")
      }

      const rateSave = 'async function saveRate() {'
      if (code.includes(rateSave)) {
        code = code.replace(rateSave,
          rateSave + '\n  if (!validateMaritimePodBeforeSaving() || !validateCargoBeforeSaving()) return\n  if (!validateRequiredFields()) return')
      }

      // Re-enable navigation to allow the click to explain missing fields.
      let continueButtons = 0
      code = code.replace(
        /<DhButton\b[^>]*>Continuar\s*<ChevronRight\b[^>]*\/>\s*<\/DhButton>/g,
        (tag) => {
          if (!tag.includes('@click=') || !tag.includes(':disabled=')) return tag
          continueButtons++
          return tag.replace(
            /:disabled="[^"]*"/,
            ':disabled="saving || (loadingRates && !sellerRequestMode && shipmentModeForApi === \'Fcl\')"',
          )
        },
      )
      if (!continueButtons) {
        throw new Error('[pricingRequiredFieldFinalFeedback] Continue button is missing in generated wizard.')
      }

      // Enviar solicitud must not be disabled just because fields are empty.
      code = code.replace(
        /<DhButton\b[^>]*@click="saveOpenRequest"[^>]*>/g,
        (tag) => tag.replace(/:disabled="[^"]*"/, ':disabled="saving"'),
      )

      // Inline summary complements the toast and focuses users on the errors.
      // Multiple old plugins insert conditional attributes before class.
      // Match the actual generated panel, not a literal opening tag.
      const panel = code.match(/<(?:section|div)\b[^>]*class="[^"]*\bcrystal-panel\b[^"]*"[^>]*>/)?.[0]
        ?? code.match(/<div\b[^>]*class="[^"]*\bcrystal-footer\b[^"]*"[^>]*>/)?.[0]
      const summary = [
        '    <div v-if="!viewOnly && validationAttempted && missingFields.length"',
        '      class="rounded-2xl border-2 border-red-500/60 bg-red-500/10 p-4 text-red-700 dark:text-red-300"',
        '      role="alert" aria-live="assertive" data-testid="pricing-missing-required-fields">',
        '      <p class="text-sm font-black">Complete los campos marcados en rojo para continuar</p>',
        '      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">',
        '        <li v-for="issue in missingFields" :key="issue.key">• {{ issue.label }}</li>',
        '      </ul>',
        '    </div>',
        '    ',
      ].join('\n')
      if (panel) code = code.replace(panel, summary + panel)

      // Cargo inputs are generated by older LCL/LTL and FCL/FTL plugins.
      // Check each physical line and show inline errors on its visible fields.
      const stepFiveAnchor = '  if (step.value === 5 && !props.rateId) {'
      if (!code.includes(stepFiveAnchor))
        throw new Error('[pricingRequiredFieldFinalFeedback] Missing step 4/5 boundary')
      code = code.replace(stepFiveAnchor, [
        '  if (step.value === 3 && (shipmentModeForApi.value === "Fcl" || shipmentModeForApi.value === "Ftl")) {',
        "    add(fclMissingUnitCount.value > 0, 'cargoWeightKg', 'Peso en kg de cada contenedor o furgón')",
        '  }',
        '  if (step.value === 4 && consolidatedCargoMode.value) {',
        '    consolidatedCargoLines.value.forEach((line, index) => {',
        "      const row = index + 1",
        "      add(!(Number(line.quantity) > 0), 'cargoLineQuantity', 'Cantidad en línea ' + row)",
        "      add(!(Number(line.weightKg) > 0), 'cargoWeightKg', 'Peso en línea ' + row)",
        "      add(!(Number(line.length) > 0), 'cargoLineLength', 'Largo en línea ' + row)",
        "      add(!(Number(line.width) > 0), 'cargoLineWidth', 'Ancho en línea ' + row)",
        "      add(!(Number(line.height) > 0), 'cargoLineHeight', 'Alto en línea ' + row)",
        '    })',
        '  }',
        stepFiveAnchor,
      ].join('\n'))

      // Guard the actual POST, including edits, restored drafts and shortcuts.
      const cargoSaveGuard = 'function validateCargoBeforeSaving() {'
      if (!code.includes(cargoSaveGuard))
        throw new Error('[pricingRequiredFieldFinalFeedback] Missing cargo save guard')
      code = code.replace(cargoSaveGuard, [
        cargoSaveGuard,
        '  if ((shipmentModeForApi.value === "Fcl" || shipmentModeForApi.value === "Ftl") && fclMissingUnitCount.value > 0) {',
        '    step.value = 3',
        '    void Promise.resolve().then(() => { validateRequiredFields() })',
        '    return false',
        '  }',
        '  if (consolidatedCargoMode.value && consolidatedCargoLines.value.some((line) =>',
        '    !(Number(line.quantity) > 0) || !(Number(line.weightKg) > 0)',
        '    || !(Number(line.length) > 0) || !(Number(line.width) > 0) || !(Number(line.height) > 0))) {',
        '    step.value = 4',
        '    void Promise.resolve().then(() => { validateRequiredFields() })',
        '    return false',
        '  }',
      ].join('\n'))

      const cargoLineInputs = [
        { model: 'line.quantity', key: 'cargoLineQuantity', message: 'Indique una cantidad mayor que cero' },
        { model: 'line.weightKg', key: 'cargoWeightKg', message: 'Indique el peso total de esta línea' },
        { model: 'line.length', key: 'cargoLineLength', message: 'Indique el largo' },
        { model: 'line.width', key: 'cargoLineWidth', message: 'Indique el ancho' },
        { model: 'line.height', key: 'cargoLineHeight', message: 'Indique el alto' },
      ]
      for (const { model, key, message } of cargoLineInputs) {
        const tag = '<DhInput v-model.number="' + model + '"'
        if (!code.includes(tag)) continue
        code = code.replace(tag, tag
          + ' data-required-field="' + key + '"'
          + ' :error="validationAttempted && !(Number(' + model + ') > 0) ? ' + "'" + message + "'" + ' : undefined"')
      }
      const cargoValueInput = '<DhInput v-model.number="form.cargoValue"'
      if (code.includes(cargoValueInput)) {
        code = code.replace(cargoValueInput,
          cargoValueInput + ' data-required-field="cargoValue" :error="fieldError(\'cargoValue\')"')
      }
      const cargoWeightInput = '<DhInput v-model.number="form.cargoWeightKg"'
      if (code.includes(cargoWeightInput)) {
        code = code.replace(cargoWeightInput,
          cargoWeightInput + ' data-required-field="cargoWeightKg" :error="fieldError(\'cargoWeightKg\')"')
      }
      // FCL/FTL weights use a physical-unit editor; highlight that input.
      code = code.replace(/<DhInput(?=[^>]*:model-value="(fclUnitWeight\([^"]+\))")/g,
        (_tag, expression: string) => '<DhInput data-required-field="cargoWeightKg"'
          + ' :error="validationAttempted && !(' + expression + ' > 0) ? \'Indique el peso de este contenedor\' : undefined"')

      // The FCL size/type picker is rendered by the distribution plugin.
      // Forward the required field error to the REAL visible selector rather
      // than the hidden legacy form.equipmentSize input.
      const fclPrimarySelector = /<PricingContainerSelector\s+v-model="form\.equipmentId"\s+transport="maritime"/
      if (fclPrimarySelector.test(code)) {
        code = code.replace(fclPrimarySelector,
          '<PricingContainerSelector v-model="form.equipmentId" transport="maritime" data-required-field="equipmentType" :error="fieldError(\'equipmentType\')"')
      }

      // Earlier build transforms rewrite the seller POD label and optionality.
      // Apply the requirement to the FINAL rendered location selector for
      // both maritime FCL and maritime LCL (quotes AND seller requests).
      const podSelectPattern = /<PricingLocationSearchSelect\b[^>]*\bv-model="form\.podId"[^>]*\/>/g
      const podSelectMatches = [...code.matchAll(podSelectPattern)]
      if (podSelectMatches.length !== 1) {
        throw new Error('[pricingRequiredFieldFinalFeedback] Expected one rendered POD selector, got ' + podSelectMatches.length)
      }
      code = code.replace(podSelectPattern, (tag) => {
        if (!/(?::label|label)="[^"]*"/.test(tag) || !tag.includes(':optional="')) {
          throw new Error('[pricingRequiredFieldFinalFeedback] POD label or optional binding missing')
        }
        return tag
          .replace(/(?::label|label)="[^"]*"/, ':label="maritimePodRequired ? \'POD requerido *\' : \'POD\'"')
          .replace(/:optional="[^"]*"/, ':optional="!maritimePodRequired"')
          .replace('<PricingLocationSearchSelect',
            '<PricingLocationSearchSelect data-required-field="podId" :error="fieldError(\'podId\')"')
      })

      return { code, map: null }
    },
  }
}
