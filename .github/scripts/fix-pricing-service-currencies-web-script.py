from pathlib import Path

p = Path('.github/scripts/apply-pricing-service-currencies-web-20260828.py')
t = p.read_text(encoding='utf-8')

start_marker = '# Persist operation + selected services for open requests too.\n'
end_marker = '# Header totals: always show both equivalent currencies; label mixed-currency state explicitly.\n'
start = t.index(start_marker)
end = t.index(end_marker, start)

replacement = '''# Persist operation + selected services in both CreateRate payloads.
text = read(wizard)
needle = "      rateType: 'Spot',\\n      shipmentMode: shipmentModeForApi.value,\\n"
inserted = "      rateType: 'Spot',\\n      operationType: operationType.value,\\n      services: effectiveServices.value.map((service) => ({ id: service.id, name: displayValue(service) || service.label, code: String(service.code ?? displayValue(service)).trim() })),\\n      shipmentMode: shipmentModeForApi.value,\\n"
if text.count(needle) != 2:
    raise RuntimeError(f'{wizard}: expected two CreateRate rateType blocks, found {text.count(needle)}')
write(wizard, text.replace(needle, inserted))

'''

t = t[:start] + replacement + t[end:]
p.write_text(t, encoding='utf-8')
print('web pricing currency patch compatibility fix applied')
