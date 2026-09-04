from pathlib import Path

path = Path('build/pricingSellerRateRequestResponsibilities.ts')
text = path.read_text()

old_head = '''  const ratesLoading = `          <div v-if="loadingRates" class="py-14 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Buscando tarifas vigentes…</div>`
  const pricingHandoff = `'''
new_head = '''  const screen5Marker = `<h2 class="crystal-title">Tarifas pre-aprobadas disponibles</h2>`
  const pricingHandoff = `'''
if text.count(old_head) != 1:
    raise SystemExit(f'Expected one rates-loading anchor declaration, found {text.count(old_head)}')
text = text.replace(old_head, new_head)

old_tail = '''          </div>\\n\\n${ratesLoading}`
  code = replaceOne(code, ratesLoading, pricingHandoff, 'Pricing request handoff summary')
'''
new_tail = '''          </div>`

  const markerIndex = code.indexOf(screen5Marker)
  if (markerIndex < 0 || code.indexOf(screen5Marker, markerIndex + screen5Marker.length) >= 0) {
    throw new Error('[pricingSellerRateRequestResponsibilities] Expected one screen 5 header.')
  }
  const headerCloseMarker = '          </div>'
  const headerClose = code.indexOf(headerCloseMarker, markerIndex + screen5Marker.length)
  if (headerClose < 0) {
    throw new Error('[pricingSellerRateRequestResponsibilities] Could not locate the screen 5 header closing element.')
  }
  const insertionPoint = headerClose + headerCloseMarker.length
  code = code.slice(0, insertionPoint) + `\\n\\n${pricingHandoff}` + code.slice(insertionPoint)
'''
if text.count(old_tail) != 1:
    raise SystemExit(f'Expected one Pricing handoff tail, found {text.count(old_tail)}')
text = text.replace(old_tail, new_tail)

path.write_text(text)
