from pathlib import Path

path = Path('src/modules/pricing/views/PricingOwnLclView.vue')
text = path.read_text(encoding='utf-8')
old = '@click="saveScenarioRows"'
new = '@click="saveScenarioRows()"'
count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected exactly one saveScenarioRows click binding, found {count}')
path.write_text(text.replace(old, new), encoding='utf-8')
print('Patched PricingOwnLclView.vue')
