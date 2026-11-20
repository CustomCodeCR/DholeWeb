<script setup lang="ts">
import { computed } from 'vue'
import type { RateOperationType } from '@/core/interfaces/pricing'
import {
  incotermModeIsRecommended, recommendedIncotermPayer, resolveIncoterm2020,
  INCOTERM_WEB_EXPLANATION, type ChargeCategory, type IncotermParty,
} from '@/modules/pricing/utils/pricingIncoterm2020'

const props=defineProps<{code:string;operationType:RateOperationType;modality:string;namedPlace?:string|null}>()
const rule=computed(()=>resolveIncoterm2020(props.code))
const modalWarning=computed(()=>!incotermModeIsRecommended(props.code,props.modality))
const labels:Record<IncotermParty,string>={
  Exporter:'Exportador / vendedor',Importer:'Importador / comprador',ByAgreement:'Según lugar y contrato',
}
const charges:{label:string;category:ChargeCategory}[]=[
  {label:'Recolección',category:'pickup'},
  {label:'Aduana de exportación',category:'exportCustoms'},
  {label:'Flete internacional',category:'mainFreight'},
  {label:'Seguro de carga',category:'insurance'},
  {label:'Cargos de terminal/destino',category:'destinationHandling'},
  {label:'Aduana de importación',category:'importCustoms'},
  {label:'Impuestos de importación',category:'importTaxes'},
  {label:'Transporte local/entrega',category:'delivery'},
  {label:'Descarga final',category:'unloading'},
  {label:'Demurrage/detention',category:'demurrageDetention'},
]
function payer(category:ChargeCategory){return labels[recommendedIncotermPayer(props.code,category)]}
</script>
<template>
  <section v-if="rule" data-testid="incoterm-2020-guide" class="space-y-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
    <div class="flex flex-wrap justify-between gap-2">
      <p class="text-xs font-black text-[var(--dh-text)]">Incoterms® 2020 — {{rule.code}} · vigente en 2026</p>
      <p class="text-xs text-[var(--dh-text-muted)]">{{operationType==='Import'?'Cotización al importador':operationType==='Export'?'Cotización al exportador':'Tránsito / doméstico'}}</p>
    </div>
    <p class="text-xs text-[var(--dh-text-muted)]">Lugar de referencia en ruta: <strong>{{namedPlace||'No seleccionado'}}</strong>. Confirme en el contrato el lugar exacto acordado para este Incoterm: el punto de la ruta no reemplaza el lugar pactado.</p>
    <p class="text-xs text-[var(--dh-text-muted)]"><strong>Exportador:</strong> {{rule.sellerScope}}</p>
    <p class="text-xs text-[var(--dh-text-muted)]"><strong>Importador:</strong> {{rule.buyerScope}}</p>
    <p class="text-xs text-[var(--dh-text-muted)]"><strong>Transferencia del riesgo:</strong> {{rule.riskTransfer}}</p>
    <p v-if="modalWarning" role="alert" class="text-xs font-semibold text-amber-600">{{rule.code}} aplica exclusivamente a transporte marítimo/fluvial. Para contenedores entregados antes del embarque, considere FCA/CPT/CIP.</p>
    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <div v-for="charge in charges" :key="charge.category" class="rounded-lg border border-[var(--dh-border)] p-2 text-xs">
        <p class="font-bold text-[var(--dh-text)]">{{charge.label}}</p>
        <p class="text-[var(--dh-text-muted)]">{{payer(charge.category)}}</p>
      </div>
    </div>
    <p v-if="rule.code==='DDP'" class="text-xs font-semibold text-amber-600">DDP: verifique que el vendedor pueda despachar como importador ante aduana.</p>
    <p class="text-xs text-[var(--dh-text-muted)]">{{INCOTERM_WEB_EXPLANATION}} Los servicios adicionales pueden cotizarse con cualquier Incoterm. Documente cambios de pagador, evite doble cobro de flete, seguro o terminal, y analice cargos extraordinarios según contrato.</p>
    <p class="text-[11px] text-[var(--dh-text-muted)]">Referencia: Cámara de Comercio Internacional (ICC), Incoterms® 2020.</p>
  </section>
</template>
