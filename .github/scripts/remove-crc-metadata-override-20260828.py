from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')

old = "  salesExecutiveId?: string\n  forceCrcInCostaRica?: boolean\n}"
new = "  salesExecutiveId?: string\n}"
if text.count(old) != 1:
    raise RuntimeError('CatalogMetadata CRC override field not found exactly once')
text = text.replace(old, new, 1)

old = """      .filter((service) => {\n        const configured = metadata(service)?.forceCrcInCostaRica\n        if (typeof configured === 'boolean') return configured\n\n        const values = [displayValue(service), service.label, service.code, service.slug]\n          .map((value) => normalizeCatalogValue(String(value ?? '')))\n        return values.some((value) => forcedNames.has(value))\n      })"""
new = """      .filter((service) => {\n        const values = [displayValue(service), service.label, service.code, service.slug]\n          .map((value) => normalizeCatalogValue(String(value ?? '')))\n        return values.some((value) => forcedNames.has(value))\n      })"""
if text.count(old) != 1:
    raise RuntimeError('CRC service metadata override block not found exactly once')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('CRC services remain authoritative by the approved service list.')
