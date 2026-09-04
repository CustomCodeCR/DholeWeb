from pathlib import Path

path = Path('build/pricingSellerRateRequestResponsibilities.ts')
text = path.read_text()
old = '''  const screen5Marker = `<h2 class="crystal-title">Tarifas pre-aprobadas disponibles</h2>`'''
new = '''  const screen5Marker = `<p class="crystal-kicker">Pantalla 5</p>`'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected one old screen 5 marker, found {count}')
path.write_text(text.replace(old, new))
