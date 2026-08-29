from pathlib import Path

path = Path('.github/scripts/apply-rate-wizard-edit-revisions-20260828.py')
text = path.read_text(encoding='utf-8')
bad = '''replace('src/modules/pricing/views/PricingRatesView.vue',
''' + "'''import { useRoute } from 'vue-router' ''',\n'''import { useRoute, useRouter } from 'vue-router' ''')\n"
if bad not in text:
    raise RuntimeError('Expected stale useRoute exact replacement was not found')
path.write_text(text.replace(bad, '', 1), encoding='utf-8')
print('Removed stale useRoute exact replacement; fallback replacement remains active.')
