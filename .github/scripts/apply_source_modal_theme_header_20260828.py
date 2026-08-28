from pathlib import Path

# Add an opaque semantic surface that follows the active theme.
theme = Path('src/assets/theme.css')
text = theme.read_text()
if '--dh-card-solid:' not in text:
    light = '  --dh-card: rgb(255 255 255 / 0.42);\n'
    dark = '  --dh-card: rgb(255 255 255 / 0.085);\n'
    if light not in text or dark not in text:
        raise SystemExit('Theme card variables not found')
    text = text.replace(light, light + '  --dh-card-solid: #ffffff;\n', 1)
    text = text.replace(dark, dark + '  --dh-card-solid: #18181b;\n', 1)
theme.write_text(text)

# Header stays opaque but takes its color from the active light/dark theme.
wizard = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = wizard.read_text()
old = """  background-color: #ffffff;
  background-image: none;
  opacity: 1;
  box-shadow: var(--dh-shadow-md);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.dark) .crystal-lines-header {
  background-color: #18181b;
}"""
new = """  background-color: var(--dh-card-solid);
  background-image: none;
  opacity: 1;
  box-shadow: var(--dh-shadow-md);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}"""
if old not in text:
    raise SystemExit('Current solid header CSS pattern not found')
text = text.replace(old, new, 1)

# Every source link in the wizard must use the internal modal.
for marker in (
    'const modalStore = useModalStore()',
    'component: PricingEmailSourceModal',
    '@click.stop="openImportSource(rate)"',
):
    if marker not in text:
        raise SystemExit(f'Modal integration marker missing: {marker}')
if 'openPricingSourcePopup' in text:
    raise SystemExit('Wizard still references the browser popup helper')
wizard.write_text(text)

# Remove the browser-popup helper entirely so it cannot be re-used accidentally.
trace = Path('src/modules/pricing/utils/pricingSourceTrace.ts')
text = trace.read_text()
popup_start = text.find('\nexport function sourcePopupUrl(')
if popup_start >= 0:
    text = text[:popup_start].rstrip() + '\n'
if 'window.open(' in text or 'openPricingSourcePopup' in text or 'sourcePopupUrl' in text:
    raise SystemExit('Popup implementation still exists')
trace.write_text(text)

# The official rate detail must also be modal-only.
detail = Path('src/modules/pricing/components/PricingRateDetailDrawer.vue').read_text()
if 'component: PricingEmailSourceModal' not in detail or 'openPricingSourcePopup' in detail:
    raise SystemExit('Official rate source is not modal-only')
