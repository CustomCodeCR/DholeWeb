from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')
old = '''        rateType: editingRate.value.rateType,\n        quoNumber: editingRate.value.quoNumber ?? null,\n        includes: editingRate.value.includes ?? createPayload.includes ?? null,\n        subjectTo: editingRate.value.subjectTo ?? createPayload.subjectTo ?? null,\n        excludes: editingRate.value.excludes ?? createPayload.excludes ?? null,\n        extraDetails,'''
new = '''        rateType: editingRate.value.rateType,\n        quoNumber: editingRate.value.quoNumber ?? null,\n        // Includes / SubjectTo / Excludes already come from baseUpdate, recalculated by\n        // this same wizard from the edited Incoterm, services and tariff lines.\n        extraDetails,'''
count = text.count(old)
if count != 1:
    raise RuntimeError(f'Expected one update payload commercial-term block, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Wizard edit now persists recalculated commercial terms.')
