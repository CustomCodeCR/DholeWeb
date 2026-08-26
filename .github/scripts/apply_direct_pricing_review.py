from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


drawer = Path("src/modules/pricing/components/PricingEmailMessageDrawer.vue")
text = drawer.read_text()
text = replace_once(
    text,
    "const canSendToPricing = computed(() => Boolean(reviewJob.value))\n",
    "const canSendToPricing = computed(() => Boolean(reviewJob.value))\n\nconst showClassificationResult = computed(() =>\n  Boolean(current.value?.errorMessage) ||\n  (current.value?.status === 'NeedsReview' && Boolean(current.value?.classificationReason)),\n)\n",
    "classification result computed",
)
text = replace_once(
    text,
    '        v-if="current.classificationReason || current.errorMessage"',
    '        v-if="showClassificationResult"',
    "classification result visibility",
)
drawer.write_text(text)

view = Path("src/modules/pricing/views/PricingEmailImportsView.vue")
text = view.read_text()
text = replace_once(
    text,
    "      description: 'Abra el correo y envíe la extracción utilizable a la pantalla de revisión de Pricing.',",
    "      description: 'Abra el correo únicamente cuando exista un problema real que impida crear automáticamente la revisión en Pricing.',",
    "review next action copy",
)
old_open = '''function openDetail(message: EmailMessageDto) {
  drawerStore.open({'''
new_open = '''function openDetail(message: EmailMessageDto) {
  const job = latestJob(message.id)
  if (job?.pricingImportBatchId) {
    openPricingBatch(job.pricingImportBatchId)
    return
  }

  drawerStore.open({'''
text = replace_once(text, old_open, new_open, "direct pricing batch navigation")
text = replace_once(
    text,
    "      'La extracción se ejecutará nuevamente y se enviará a Pricing si supera la confianza configurada.',",
    "      'La extracción se ejecutará nuevamente y, si produce filas válidas, creará automáticamente la revisión en Pricing.',",
    "reprocess copy",
)
view.write_text(text)
