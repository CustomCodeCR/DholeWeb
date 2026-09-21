import type { Plugin } from 'vite'

const RATES_VIEW_PATH = '/src/modules/pricing/views/PricingRatesView.vue'
const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const DETAIL_DRAWER_PATH = '/src/modules/pricing/components/PricingRateDetailDrawer.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricing-approval-workflow-stable] Expected one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchRatesView(source: string) {
  return source
}

function patchWizard(source: string) {
  let code = source

  // pricingSellerOwnershipUi normally injects the auth store before this plugin.
  // Keep this transform self-contained as a fallback without declaring it twice.
  if (!code.includes("import { useAuthStore } from '@/core/stores/authStore'")) {
    code = replaceOne(
      code,
      "import { useModalStore } from '@/core/stores/modalStore'",
      "import { useModalStore } from '@/core/stores/modalStore'\nimport { useAuthStore } from '@/core/stores/authStore'",
      'wizard auth import fallback',
    )
  }

  if (!code.includes('const authStore = useAuthStore()')) {
    code = replaceOne(
      code,
      'const modalStore = useModalStore()',
      'const modalStore = useModalStore()\nconst authStore = useAuthStore()',
      'wizard auth store fallback',
    )
  }

  code = replaceOne(
    code,
    "const commercialStatusSaving = ref(false)\nconst commercialActionError = ref('')\nconst downloadingQuote = ref(false)",
    "const commercialStatusSaving = ref(false)\nconst approvalSaving = ref(false)\nconst commercialActionError = ref('')\nconst downloadingQuote = ref(false)",
    'wizard approval state',
  )

  if (!code.includes('const canApproveLowMargin = computed(')) {
    code = replaceOne(
      code,
      "const currentCommercialStatus = computed(() => editingRate.value?.status ?? '')",
      "const currentCommercialStatus = computed(() => editingRate.value?.status ?? '')\nconst canApproveLowMargin = computed(() => authStore.hasScope('pricing.rate.approve-low-margin'))\nconst canUpdateRateStatus = computed(() => authStore.hasScope('pricing.rate.update'))\nconst canApproveCurrentRate = computed(() =>\n  canApproveLowMargin.value &&\n  editingRate.value?.status === 'PendingApproval' &&\n  Boolean(editingRate.value?.requiredApproval),\n)\nconst canOpenApprovedRate = computed(() =>\n  canUpdateRateStatus.value && currentCommercialStatus.value === 'ApprovedByManagement',\n)\nconst canDownloadCurrentQuote = computed(() => {\n  const rate = editingRate.value\n  return Boolean(\n    rate &&\n    !rate.requiredApproval &&\n    !['PendingApproval', 'RejectedByManagement'].includes(rate.status),\n  )\n})",
      'wizard approval computed state',
    )
  }

  code = replaceOne(
    code,
    "async function markCurrentRateSent() {",
    "async function approveCurrentRate() {\n  if (!editingRate.value || !canApproveCurrentRate.value || approvalSaving.value) return\n  try {\n    approvalSaving.value = true\n    await PricingService.approveRateMargin(editingRate.value.id)\n    toastStore.success('Margen aprobado', 'La tarifa quedó aprobada por gerencia.')\n    await hydrateExistingRate()\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudo aprobar el margen de la tarifa.')\n  } finally {\n    approvalSaving.value = false\n  }\n}\n\nasync function openApprovedRate() {\n  if (!editingRate.value || !canOpenApprovedRate.value || commercialStatusSaving.value) return\n  try {\n    commercialStatusSaving.value = true\n    await PricingService.setRateStatus(editingRate.value.id, { status: 'Open' })\n    toastStore.success('Tarifa abierta', 'La tarifa aprobada ya está disponible para el flujo comercial.')\n    await hydrateExistingRate()\n  } catch (error) {\n    toastStore.backendError(error, 'No se pudo poner la tarifa en estado Abierta.')\n  } finally {\n    commercialStatusSaving.value = false\n  }\n}\n\nasync function markCurrentRateSent() {",
    'wizard approval actions',
  )

  code = replaceOne(
    code,
    "async function downloadCurrentQuote() {\n  if (!editingRate.value || downloadingQuote.value) return\n  try {",
    "async function downloadCurrentQuote() {\n  if (!editingRate.value || downloadingQuote.value) return\n  if (!canDownloadCurrentQuote.value) {\n    toastStore.warning('Aprobación requerida', 'La cotización PDF estará disponible únicamente después de aprobar la tarifa.')\n    return\n  }\n  try {",
    'wizard pdf guard',
  )

  code = replaceOne(
    code,
    '<DhBadge :label="editingRate.status" :variant="editingRate.status === \'AcceptedByClient\' ? \'success\' : \'neutral\'" />',
    '<DhBadge :label="commercialStatusLabel(editingRate.status)" :variant="editingRate.status === \'AcceptedByClient\' ? \'success\' : editingRate.status === \'PendingApproval\' ? \'warning\' : \'neutral\'" />',
    'wizard header status label',
  )

  code = replaceOne(
    code,
    "            <DhButton variant=\"secondary\" :loading=\"downloadingQuote\" :disabled=\"downloadingQuote\" @click=\"downloadCurrentQuote\">\n              Descargar cotización PDF\n            </DhButton>",
    "            <DhButton variant=\"secondary\" :loading=\"downloadingQuote\" :disabled=\"downloadingQuote || !canDownloadCurrentQuote\" @click=\"downloadCurrentQuote\">\n              {{ canDownloadCurrentQuote ? 'Descargar cotización PDF' : 'PDF disponible después de aprobación' }}\n            </DhButton>",
    'wizard pdf button',
  )

  const compactMasterAwareCommercialActions =
    "              <div class=\"flex flex-wrap items-center gap-2\">\n                <template v-if=\"isMasterTariff\">\n                  <DhButton size=\"sm\" @click=\"applyMasterTariff\">Aplicar a cliente</DhButton>\n                  <span class=\"rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-[11px] font-bold text-[var(--dh-text-muted)]\">\n                    El maestro no se acepta ni se rechaza.\n                  </span>\n                </template>\n                <template v-else>\n                  <DhButton size=\"sm\" variant=\"secondary\" :disabled=\"!canMarkSent || commercialStatusSaving\" @click=\"markCurrentRateSent\">Enviada</DhButton>\n                  <DhButton size=\"sm\" :disabled=\"!canAcceptOrReject || commercialStatusSaving\" @click=\"startCommercialDecision('accept')\">Aceptada</DhButton>\n                  <DhButton size=\"sm\" variant=\"danger\" :disabled=\"!canAcceptOrReject || commercialStatusSaving\" @click=\"startCommercialDecision('reject')\">Rechazada</DhButton>\n                </template>\n              </div>"
  const compactApprovalCommercialActions =
    "              <div class=\"flex flex-wrap items-center gap-2\">\n                <template v-if=\"isMasterTariff\">\n                  <DhButton size=\"sm\" @click=\"applyMasterTariff\">Aplicar a cliente</DhButton>\n                  <span class=\"rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-[11px] font-bold text-[var(--dh-text-muted)]\">\n                    El maestro no se acepta ni se rechaza.\n                  </span>\n                </template>\n                <template v-else>\n                  <DhButton\n                    v-if=\"editingRate.status === 'PendingApproval' && canApproveLowMargin\"\n                    size=\"sm\"\n                    :loading=\"approvalSaving\"\n                    :disabled=\"!canApproveCurrentRate || approvalSaving\"\n                    @click=\"approveCurrentRate\"\n                  >Aprobar margen</DhButton>\n                  <DhButton\n                    v-if=\"editingRate.status === 'ApprovedByManagement' && canUpdateRateStatus\"\n                    size=\"sm\"\n                    :disabled=\"!canOpenApprovedRate || commercialStatusSaving\"\n                    @click=\"openApprovedRate\"\n                  >Poner en abierta</DhButton>\n                  <DhButton size=\"sm\" variant=\"secondary\" :disabled=\"!canMarkSent || commercialStatusSaving\" @click=\"markCurrentRateSent\">Enviada</DhButton>\n                  <DhButton size=\"sm\" :disabled=\"!canAcceptOrReject || commercialStatusSaving\" @click=\"startCommercialDecision('accept')\">Aceptada</DhButton>\n                  <DhButton size=\"sm\" variant=\"danger\" :disabled=\"!canAcceptOrReject || commercialStatusSaving\" @click=\"startCommercialDecision('reject')\">Rechazada</DhButton>\n                </template>\n              </div>"

  const masterAwareCommercialActions =
    "              <div class=\"flex flex-wrap gap-2\">\n                <DhButton v-if=\"isMasterTariff\" @click=\"applyMasterTariff\">Aplicar a cliente</DhButton>\n                <template v-else>\n                  <DhButton variant=\"secondary\" :disabled=\"!canMarkSent || commercialStatusSaving\" @click=\"markCurrentRateSent\">Enviada</DhButton>\n                  <DhButton :disabled=\"!canAcceptOrReject || commercialStatusSaving\" @click=\"startCommercialDecision('accept')\">Aceptada</DhButton>\n                  <DhButton variant=\"danger\" :disabled=\"!canAcceptOrReject || commercialStatusSaving\" @click=\"startCommercialDecision('reject')\">Rechazada</DhButton>\n                </template>\n              </div>"
  const legacyCommercialActions =
    "              <div class=\"flex flex-wrap gap-2\">\n                <DhButton variant=\"secondary\" :disabled=\"!canMarkSent || commercialStatusSaving\" @click=\"markCurrentRateSent\">Enviada</DhButton>\n                <DhButton :disabled=\"!canAcceptOrReject || commercialStatusSaving\" @click=\"startCommercialDecision('accept')\">Aceptada</DhButton>\n                <DhButton variant=\"danger\" :disabled=\"!canAcceptOrReject || commercialStatusSaving\" @click=\"startCommercialDecision('reject')\">Rechazada</DhButton>\n              </div>"
  const approvalCommercialActions =
    "              <div class=\"flex flex-wrap gap-2\">\n                <DhButton v-if=\"isMasterTariff\" @click=\"applyMasterTariff\">Aplicar a cliente</DhButton>\n                <template v-else>\n                  <DhButton\n                    v-if=\"editingRate.status === 'PendingApproval' && canApproveLowMargin\"\n                    :loading=\"approvalSaving\"\n                    :disabled=\"!canApproveCurrentRate || approvalSaving\"\n                    @click=\"approveCurrentRate\"\n                  >Aprobar margen</DhButton>\n                  <DhButton\n                    v-if=\"editingRate.status === 'ApprovedByManagement' && canUpdateRateStatus\"\n                    :disabled=\"!canOpenApprovedRate || commercialStatusSaving\"\n                    @click=\"openApprovedRate\"\n                  >Poner en abierta</DhButton>\n                  <DhButton variant=\"secondary\" :disabled=\"!canMarkSent || commercialStatusSaving\" @click=\"markCurrentRateSent\">Enviada</DhButton>\n                  <DhButton :disabled=\"!canAcceptOrReject || commercialStatusSaving\" @click=\"startCommercialDecision('accept')\">Aceptada</DhButton>\n                  <DhButton variant=\"danger\" :disabled=\"!canAcceptOrReject || commercialStatusSaving\" @click=\"startCommercialDecision('reject')\">Rechazada</DhButton>\n                </template>\n              </div>"

  if (code.includes(compactMasterAwareCommercialActions)) {
    code = code.replace(compactMasterAwareCommercialActions, compactApprovalCommercialActions)
  } else if (code.includes(masterAwareCommercialActions)) {
    code = code.replace(masterAwareCommercialActions, approvalCommercialActions)
  } else {
    code = replaceOne(
      code,
      legacyCommercialActions,
      approvalCommercialActions.replace(
        '                <DhButton v-if=\"isMasterTariff\" @click=\"applyMasterTariff\">Aplicar a cliente</DhButton>\n                <template v-else>\n',
        '',
      ).replace('                </template>\n', ''),
      'wizard commercial action buttons',
    )
  }

  return code
}

function patchDetailDrawer(source: string) {
  let code = source

  code = code
    .replace("        PendingApproval: 'Abierta',", "        PendingApproval: 'Pendiente de aprobación',")
    .replace("        ApprovedByManagement: 'Abierta',", "        ApprovedByManagement: 'Aprobada por gerencia',")
    .replace("        RejectedByManagement: 'Abierta',", "        RejectedByManagement: 'Rechazada por gerencia',")
    .replace("        RequestedByClient: 'Abierta',", "        RequestedByClient: 'Solicitada por cliente',")

  code = replaceOne(
    code,
    "const canApprove = computed(() => authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin))",
    "const canApprove = computed(() => authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin))\nconst canPrintRate = computed(() =>\n  !current.value.requiredApproval &&\n  !['PendingApproval', 'RejectedByManagement'].includes(current.value.status),\n)",
    'drawer pdf computed guard',
  )

  code = replaceOne(
    code,
    "async function printRate() {\n  if (printing.value) return\n\n  try {",
    "async function printRate() {\n  if (printing.value) return\n  if (!canPrintRate.value) {\n    toastStore.warning('Aprobación requerida', 'La cotización PDF estará disponible únicamente después de aprobar la tarifa.')\n    return\n  }\n\n  try {",
    'drawer pdf action guard',
  )

  code = replaceOne(
    code,
    '            :disabled="printing"\n            @click="printRate"',
    '            :disabled="printing || !canPrintRate"\n            @click="printRate"',
    'drawer pdf button guard',
  )

  return code
}

export function pricingApprovalWorkflowStable(): Plugin {
  return {
    name: 'dhole-pricing-approval-workflow-stable',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const path = id.replaceAll('\\', '/').split('?')[0]
      if (path.endsWith(RATES_VIEW_PATH)) return patchRatesView(source)
      if (path.endsWith(WIZARD_PATH)) return patchWizard(source)
      if (path.endsWith(DETAIL_DRAWER_PATH)) return patchDetailDrawer(source)
      return null
    },
  }
}
