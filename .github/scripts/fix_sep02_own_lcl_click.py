from pathlib import Path

path = Path('src/modules/pricing/views/PricingOwnLclView.vue')
text = path.read_text(encoding='utf-8')
before = '@click="saveScenarioRows"'
after = '@click="saveScenarioRows()"'
count = text.count(before)
if count != 1:
    raise RuntimeError(f'Expected exactly one saveScenarioRows click binding, found {count}')
path.write_text(text.replace(before, after, 1), encoding='utf-8')
print('Fixed saveScenarioRows click type.')
