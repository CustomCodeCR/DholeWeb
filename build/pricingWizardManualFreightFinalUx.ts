import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  let code = source

  const topButton = `                <DhButton type="button" variant="secondary" :loading="savingManualOceanFreight" :disabled="savingManualOceanFreight || form.freightCost <= 0" @click="saveManualOceanFreight">
                  Guardar flete marítimo
                </DhButton>`
  code = code.replace(topButton, '')

  code = code.replace('Guardar flete marítimo manual', 'Crear flete marítimo manual')
  code = code.replace(
    'Guarda este costo/venta como una tarifa marítima pre-aprobada para reutilizarla después en Pantalla 5.',
    'Complete todos los datos. Al crearla quedará preaprobada e identificada como creada manualmente en Pantalla 5.',
  )

  const transitAnchor = `            <DhInput v-model.number="form.transitDays" type="number" min="0" label="Días de tránsito" />`
  if (code.includes(transitAnchor) && !code.includes('Crear flete marítimo</DhButton>')) {
    code = code.replace(
      transitAnchor,
      `${transitAnchor}
            <div
              v-if="shipmentModeForApi === 'Fcl' && (form.modality === 'Maritime' || form.modality === 'Multimodal') && (form.manualRate || !form.selectedImportRateId)"
              class="flex flex-col gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 md:col-span-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p class="text-sm font-black">Crear tarifa de flete</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Complete agente, naviera, moneda, costo, venta, vigencia, comentarios, días libres y tránsito antes de crearla.</p>
                <p v-if="manualOceanFreightSavedId" class="mt-2 text-xs font-black text-emerald-600">Flete creado correctamente como tarifa preaprobada y manual.</p>
              </div>
              <DhButton
                type="button"
                variant="primary"
                class="w-full md:w-auto"
                :loading="savingManualOceanFreight"
                :disabled="savingManualOceanFreight || !form.agentId || !form.carrierId || !form.currencyId || number(form.freightCost) <= 0 || number(form.freightSale) <= 0 || !form.loadDate || !form.validTo || !manualOceanFreightComment.trim()"
                @click="saveManualOceanFreight"
              >
                Crear flete marítimo
              </DhButton>
            </div>`,
    )
  }

  const statusBadge = `<DhBadge :variant="bundle.preAuthorized ? 'warning' : 'success'">{{ bundle.preAuthorized ? 'Incluye preautorizada' : 'Preaprobada' }}</DhBadge>`
  if (code.includes(statusBadge) && !code.includes('Creada manualmente</DhBadge>')) {
    code = code.replace(
      statusBadge,
      `${statusBadge}
                    <DhBadge v-if="bundle.lines.some((line) => String(line.rate.sourceType) === 'Manual')" variant="primary">Creada manualmente</DhBadge>`,
    )
  }

  return code
}

export function pricingWizardManualFreightFinalUx(): Plugin {
  return {
    name: 'dhole-pricing-wizard-manual-freight-final-ux',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
