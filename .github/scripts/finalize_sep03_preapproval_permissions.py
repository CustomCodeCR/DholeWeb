from pathlib import Path

p = Path('src/modules/pricing/views/PricingImportsView.vue')
text = p.read_text(encoding='utf-8')

text = text.replace(
    "import { PricingService } from '@/core/services/pricingService'\n",
    "import { PricingService } from '@/core/services/pricingService'\nimport { PRICING_SCOPES } from '@/core/auth/scopes'\nimport { useAuthStore } from '@/core/stores/authStore'\n",
    1,
)
text = text.replace(
    "const toastStore = useToastStore()\nconst catalogs = usePricingCatalogs()",
    "const toastStore = useToastStore()\nconst authStore = useAuthStore()\nconst catalogs = usePricingCatalogs()",
    1,
)
anchor = "const containerFilterOptions = computed(() => [\n  { label: 'Todos los contenedores', value: '' },\n  ...catalogs.containerOptions.value,\n])\n"
insert = anchor + "\nconst isPricingAdmin = computed(() =>\n  authStore.hasRole('Administrador') || authStore.hasRole('Admin') || authStore.hasRole('Administrator'),\n)\nconst canPreApprove = computed(() =>\n  isPricingAdmin.value || authStore.hasScope(PRICING_SCOPES.importFclRates.approve),\n)\nconst canRejectImported = computed(() =>\n  isPricingAdmin.value || authStore.hasScope(PRICING_SCOPES.importFclRates.reject),\n)\n"
if anchor not in text:
    raise SystemExit('containerFilterOptions anchor not found')
text = text.replace(anchor, insert, 1)

text = text.replace(
    "async function approve(ids: string[]) {\n  const pending =",
    "async function approve(ids: string[]) {\n  if (!canPreApprove.value) {\n    toastStore.warning('Permiso requerido', 'Necesita permiso para preaprobar tarifas importadas.')\n    return\n  }\n  const pending =",
    1,
)
text = text.replace(
    "function reject(ids: string[]) {\n  const pending =",
    "function reject(ids: string[]) {\n  if (!canRejectImported.value) {\n    toastStore.warning('Permiso requerido', 'Necesita permiso para rechazar tarifas importadas.')\n    return\n  }\n  const pending =",
    1,
)
text = text.replace(
    "canApprove: ['Pending', 'PreAuthorized'].includes(row.status),",
    "canApprove: canPreApprove.value && ['Pending', 'PreAuthorized'].includes(row.status),",
    1,
)

text = text.replace(
    'description="Revise tarifas de correo o cargue Excel/PDF manualmente para enviarlos al mismo flujo de extracción y aprobación."',
    'description="Revise tarifas de correo o cargue Excel/PDF manualmente para enviarlos al flujo de extracción, preautorización y preaprobación."',
    1,
)
text = text.replace(
    'v-if="selectedPendingIds.length"',
    'v-if="selectedPendingIds.length && (canPreApprove || canRejectImported)"',
    1,
)
text = text.replace(
    '{{ selectedPendingIds.length }} pendientes seleccionadas',
    '{{ selectedPendingIds.length }} tarifas preautorizadas seleccionadas',
    1,
)
text = text.replace(
    'Aprobación y rechazo por batch.',
    'Preaprobación y rechazo por batch.',
    1,
)
text = text.replace(
    '<DhButton variant="danger" :disabled="processing" @click="reject(selectedPendingIds)">',
    '<DhButton v-if="canRejectImported" variant="danger" :disabled="processing" @click="reject(selectedPendingIds)">',
    1,
)
text = text.replace(
    '<DhButton :disabled="processing" @click="approve(selectedPendingIds)">\n          <Check class="h-4 w-4" /> Aprobar',
    '<DhButton v-if="canPreApprove" :disabled="processing" @click="approve(selectedPendingIds)">\n          <Check class="h-4 w-4" /> Preaprobar',
    1,
)
text = text.replace(
    '<DhButton v-if="[\'Pending\', \'PreAuthorized\'].includes(row.status)" size="sm" :disabled="processing" @click="approve([row.id])">\n                    <Check class="h-4 w-4" /> Aprobar',
    '<DhButton v-if="canPreApprove && [\'Pending\', \'PreAuthorized\'].includes(row.status)" size="sm" :disabled="processing" @click="approve([row.id])">\n                    <Check class="h-4 w-4" /> Preaprobar',
    1,
)

p.write_text(text, encoding='utf-8')
print('Finalized preapproval permission UI')
