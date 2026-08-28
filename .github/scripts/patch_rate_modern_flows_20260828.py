from pathlib import Path

# 1) Set-rate-status contract accepts IDTRA during client acceptance.
path = Path('src/core/interfaces/pricing.ts')
text = path.read_text(encoding='utf-8')
old = '''export interface SetRateStatusRequest extends Record<string, unknown> {
  status: Extract<
    RateStatus,
    'Open' | 'Sent' | 'RequestedByClient' | 'AcceptedByClient' | 'RejectedByClient' | 'Closed'
  >
  reason?: string | null
}
'''
new = '''export interface SetRateStatusRequest extends Record<string, unknown> {
  status: Extract<
    RateStatus,
    'Open' | 'Sent' | 'RequestedByClient' | 'AcceptedByClient' | 'RejectedByClient' | 'Closed'
  >
  reason?: string | null
  idtraNumber?: string | null
}
'''
if old not in text:
    raise SystemExit('SetRateStatusRequest anchor not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# 2) Existing rate editing uses the staged wizard shell instead of the old all-at-once layout.
path = Path('src/modules/pricing/components/PricingRateFormDrawer.vue')
text = path.read_text(encoding='utf-8')
if 'const isManualWizard = computed(() => !props.rate && !props.sourceImport)' not in text:
    raise SystemExit('isManualWizard anchor not found')
text = text.replace(
    'const isManualWizard = computed(() => !props.rate && !props.sourceImport)',
    'const isWizardFlow = computed(() => !props.sourceImport)',
    1,
)
text = text.replace('isManualWizard', 'isWizardFlow')
text = text.replace(
    "{ id: 1, label: 'Datos generales', hint: 'Vigencia, moneda y condiciones comerciales' },",
    "{ id: 1, label: 'Datos y vigencia', hint: 'Vigencia, moneda y condiciones comerciales' },",
    1,
)
text = text.replace(
    "{ id: 3, label: 'Costos y margen', hint: 'Rubros, seguro, costo, venta y utilidad' },",
    "{ id: 3, label: 'Líneas y margen', hint: 'Rubros, seguro, costo, venta y utilidad' },",
    1,
)
text = text.replace(
    '<span v-else class="pricing-rate-navigation__finish-hint">\n            La tarifa se crea desde el resumen inferior.\n          </span>',
    '<span v-else class="pricing-rate-navigation__finish-hint">\n            {{ props.rate ? \'Guarde los cambios desde el resumen inferior.\' : \'La tarifa se crea desde el resumen inferior.\' }}\n          </span>',
    1,
)
path.write_text(text, encoding='utf-8')

# 3) Official rate actions: acceptance modal + duplicate-then-review wizard.
path = Path('src/modules/pricing/components/PricingRateDetailDrawer.vue')
text = path.read_text(encoding='utf-8')
old = "import PricingRateFormDrawer from './PricingRateFormDrawer.vue'\n"
new = old + "import PricingAcceptRateModal from './PricingAcceptRateModal.vue'\n"
if old not in text:
    raise SystemExit('RateDetail import anchor not found')
text = text.replace(old, new, 1)

old = '''function duplicate() {
  modalStore.open({
    title: 'Duplicar tarifa',
    component: PricingDuplicateRateModal,
    props: { rate: current.value, onSaved: props.onSaved },
  })
}
'''
new = '''function duplicate() {
  modalStore.open({
    title: 'Duplicar tarifa',
    component: PricingDuplicateRateModal,
    size: 'lg',
    props: {
      rate: current.value,
      onDuplicated: async (duplicatedRateId: string) => {
        const duplicatedRate = await PricingService.getRate(duplicatedRateId)
        drawerStore.open({
          title: 'Revisar tarifa duplicada',
          component: PricingRateFormDrawer,
          size: 'full',
          props: {
            rate: duplicatedRate,
            onSaved: async () => {
              await props.onSaved?.()
            },
          },
        })
        await props.onSaved?.()
      },
    },
  })
}
'''
if old not in text:
    raise SystemExit('duplicate function anchor not found')
text = text.replace(old, new, 1)

old = '''async function setCommercialStatus(status: SetRateStatusRequest['status']) {
  if (status === 'AcceptedByClient' && !current.value.idtraNumber?.trim()) {
    toastStore.warning('IDTRA requerido', 'Registre el IDTRA en Editar antes de marcar la tarifa como Aceptada.')
    edit()
    return
  }
  try {
'''
new = '''function acceptByClient() {
  modalStore.open({
    title: 'Aceptar tarifa por cliente',
    component: PricingAcceptRateModal,
    size: 'md',
    props: {
      rate: current.value,
      onSaved: async () => {
        await reload()
        await props.onSaved?.()
      },
    },
  })
}

async function setCommercialStatus(status: SetRateStatusRequest['status']) {
  try {
'''
if old not in text:
    raise SystemExit('setCommercialStatus anchor not found')
text = text.replace(old, new, 1)

old = '@click="setCommercialStatus(\'AcceptedByClient\')"'
new = '@click="acceptByClient"'
if old not in text:
    raise SystemExit('accept button anchor not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

print('Modern rate action flow patch applied')
