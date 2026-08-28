from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Pattern not found: {label}")
    return text.replace(old, new, 1)

wizard = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = wizard.read_text()
text = replace_once(
    text,
    "import { useToastStore } from '@/core/stores/toastStore'",
    "import { useToastStore } from '@/core/stores/toastStore'\nimport { useModalStore } from '@/core/stores/modalStore'",
    'wizard modal store import',
)
text = replace_once(
    text,
    "import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'",
    "import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'\nimport PricingEmailSourceModal from '@/modules/pricing/components/PricingEmailSourceModal.vue'",
    'wizard source modal import',
)
text = replace_once(
    text,
    "import { openPricingSourcePopup, sourceTitle } from '@/modules/pricing/utils/pricingSourceTrace'",
    "import { sourceTitle } from '@/modules/pricing/utils/pricingSourceTrace'",
    'wizard remove popup helper',
)
text = replace_once(
    text,
    "const router = useRouter()\nconst toastStore = useToastStore()",
    "const router = useRouter()\nconst toastStore = useToastStore()\nconst modalStore = useModalStore()",
    'wizard modal store instance',
)
text = replace_once(
    text,
    """function openImportSource(rate: ImportRateSelectDto) {
  openPricingSourcePopup(rate)
}""",
    """function openImportSource(rate: ImportRateSelectDto) {
  modalStore.open({
    title: `Correo / fuente de la tarifa · ${importSourceTitle(rate)}`,
    component: PricingEmailSourceModal,
    size: 'xl',
    props: { batchId: rate.importBatchId },
  })
}""",
    'wizard source modal open',
)
wizard.write_text(text)

rate_detail = Path('src/modules/pricing/components/PricingRateDetailDrawer.vue')
text = rate_detail.read_text()
text = replace_once(
    text,
    "import PricingDuplicateRateModal from './PricingDuplicateRateModal.vue'",
    "import PricingDuplicateRateModal from './PricingDuplicateRateModal.vue'\nimport PricingEmailSourceModal from './PricingEmailSourceModal.vue'",
    'rate detail source modal import',
)
text = replace_once(
    text,
    "import { openPricingSourcePopup, sourceTitle } from '@/modules/pricing/utils/pricingSourceTrace'",
    "import { sourceTitle } from '@/modules/pricing/utils/pricingSourceTrace'",
    'rate detail remove popup helper',
)
text = replace_once(
    text,
    """function openRateSource() {
  if (sourceImportRate.value) openPricingSourcePopup(sourceImportRate.value)
}""",
    """function openRateSource() {
  const source = sourceImportRate.value
  if (!source) return
  modalStore.open({
    title: `Correo / fuente de la tarifa · ${sourceLabel.value || 'Fuente de la tarifa'}`,
    component: PricingEmailSourceModal,
    size: 'xl',
    props: { batchId: source.importBatchId },
  })
}""",
    'rate detail source modal open',
)
rate_detail.write_text(text)
