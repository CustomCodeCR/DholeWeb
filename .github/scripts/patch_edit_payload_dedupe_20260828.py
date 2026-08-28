from pathlib import Path

path = Path('src/modules/pricing/components/PricingRateFormDrawerLegacy.vue')
text = path.read_text(encoding='utf-8')
old = '''    if (props.rate) {
      const payload: UpdateRateRequest = {
        ...header,
        extraDetails: [
          ...containerFreightDetails(),
          ...details.value
            .filter(
              (detail) =>
                (!usesContainerFreight.value || detail.costDetailType !== 'Freight') &&
                !detail.importedFreight &&
                (detail.insuranceGenerated ||
                  detail.automaticFixed ||
                  !selectorsChanged.value ||
                  !detail.locked),
            )
            .map((detail) => ({ ...mapDetail(detail), id: detail.id ?? null })),
        ],
        removedExtraDetailIds: [...new Set(removedDetailIds.value)],
      }
'''
new = '''    if (props.rate) {
      const rawExtraDetails = [
        ...containerFreightDetails(),
        ...details.value
          .filter(
            (detail) =>
              (!usesContainerFreight.value || detail.costDetailType !== 'Freight') &&
              !detail.importedFreight &&
              (detail.insuranceGenerated ||
                detail.automaticFixed ||
                !selectorsChanged.value ||
                !detail.locked),
          )
          .map((detail) => ({ ...mapDetail(detail), id: detail.id ?? null })),
      ]
      const liveDetailIds = new Set<string>()
      const extraDetails = rawExtraDetails.filter((detail) => {
        const id = detail.id?.trim()
        if (!id) return true
        if (liveDetailIds.has(id)) return false
        liveDetailIds.add(id)
        return true
      })
      const payload: UpdateRateRequest = {
        ...header,
        extraDetails,
        removedExtraDetailIds: [...new Set(removedDetailIds.value)].filter(
          (id) => !liveDetailIds.has(id),
        ),
      }
'''
if old not in text:
    raise SystemExit('Edit payload anchor not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Web edit payload dedupe patch applied')
