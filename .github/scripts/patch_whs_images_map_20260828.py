from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')

old = "import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'\n"
new = old + "import DhStorageImage from '@/shared/components/DhStorageImage.vue'\n"
if old not in text:
    raise SystemExit('atoms import anchor not found')
text = text.replace(old, new, 1)

old = "  phone?: string\n  salesExecutiveId?: string\n"
new = "  phone?: string\n  imageStorageId?: string\n  imageFileName?: string\n  salesExecutiveId?: string\n"
if old not in text:
    raise SystemExit('CatalogMetadata phone anchor not found')
text = text.replace(old, new, 1)

old = '''            <div v-if="selectedIncotermCode === 'FCA' && selectedWarehouse" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-xs font-semibold text-[var(--dh-text-soft)]">
              <p class="text-sm font-black text-[var(--dh-text)]">{{ selectedWarehouse.label || displayValue(selectedWarehouse) }}</p>
              <p class="mt-2"><strong>Dirección:</strong> {{ warehouseAddress(selectedWarehouse) || 'Sin dirección' }}</p>
              <p v-if="metadata(selectedWarehouse)?.schedule" class="mt-1"><strong>Horario:</strong> {{ metadata(selectedWarehouse)?.schedule }}</p>
              <p v-if="metadata(selectedWarehouse)?.contacts" class="mt-1"><strong>Contactos:</strong> {{ metadata(selectedWarehouse)?.contacts }}</p>
              <p v-if="metadata(selectedWarehouse)?.email" class="mt-1"><strong>Email:</strong> {{ metadata(selectedWarehouse)?.email }}</p>
              <p v-if="metadata(selectedWarehouse)?.phone" class="mt-1"><strong>Teléfono:</strong> {{ metadata(selectedWarehouse)?.phone }}</p>
              <p v-if="metadataNumber(selectedWarehouse, 'latitude', 'lat') != null && metadataNumber(selectedWarehouse, 'longitude', 'lng') != null" class="mt-1">
                <strong>Ubicación:</strong>
                {{ metadataNumber(selectedWarehouse, 'latitude', 'lat')?.toFixed(6) }},
                {{ metadataNumber(selectedWarehouse, 'longitude', 'lng')?.toFixed(6) }}
              </p>
            </div>
            <DhButton v-if="selectedIncotermCode === 'FCA'" variant="ghost" @click="router.push({ name: 'config-catalogs' })">Administrar / crear WHS en Config</DhButton>
'''
new = '''            <div v-if="selectedIncotermCode === 'FCA' && selectedWarehouse" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-xs font-semibold text-[var(--dh-text-soft)]">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                <DhStorageImage
                  v-if="metadata(selectedWarehouse)?.imageStorageId"
                  :file-id="metadata(selectedWarehouse)?.imageStorageId"
                  :alt="`Imagen de ${selectedWarehouse.label || displayValue(selectedWarehouse)}`"
                  class="h-28 w-28 shrink-0 self-start sm:h-32 sm:w-32"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-black text-[var(--dh-text)]">{{ selectedWarehouse.label || displayValue(selectedWarehouse) }}</p>
                  <p class="mt-2"><strong>Dirección:</strong> {{ warehouseAddress(selectedWarehouse) || 'Sin dirección' }}</p>
                  <p v-if="metadata(selectedWarehouse)?.schedule" class="mt-1"><strong>Horario:</strong> {{ metadata(selectedWarehouse)?.schedule }}</p>
                  <p v-if="metadata(selectedWarehouse)?.contacts" class="mt-1"><strong>Contactos:</strong> {{ metadata(selectedWarehouse)?.contacts }}</p>
                  <p v-if="metadata(selectedWarehouse)?.email" class="mt-1 break-words"><strong>Email:</strong> {{ metadata(selectedWarehouse)?.email }}</p>
                  <p v-if="metadata(selectedWarehouse)?.phone" class="mt-1"><strong>Teléfono:</strong> {{ metadata(selectedWarehouse)?.phone }}</p>
                  <p v-if="metadataNumber(selectedWarehouse, 'latitude', 'lat') != null && metadataNumber(selectedWarehouse, 'longitude', 'lng') != null" class="mt-1">
                    <strong>Ubicación:</strong>
                    {{ metadataNumber(selectedWarehouse, 'latitude', 'lat')?.toFixed(6) }},
                    {{ metadataNumber(selectedWarehouse, 'longitude', 'lng')?.toFixed(6) }}
                  </p>
                </div>
              </div>
            </div>
            <DhButton v-if="selectedIncotermCode === 'FCA'" variant="ghost" @click="router.push({ name: 'config-catalogs', query: { search: 'pricing-warehouses' } })">Administrar / crear WHS en Config</DhButton>
'''
if old not in text:
    raise SystemExit('selected warehouse card anchor not found')
text = text.replace(old, new, 1)

old = '              :fit-markers="true"\n              :initial-zoom="3"\n'
new = '              :fit-markers="!form.warehouseId"\n              :initial-zoom="3"\n'
if old not in text:
    raise SystemExit('FCA fit-markers anchor not found')
text = text.replace(old, new, 1)

old = '              hint="Los marcadores corresponden a los WHS globales configurados en Dhole. Toque uno para seleccionarlo."\n'
new = '              hint="Los marcadores corresponden a los WHS globales configurados en Dhole. Al seleccionar uno, el mapa se centra en ese WHS."\n'
if old not in text:
    raise SystemExit('FCA map hint anchor not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('WHS image/map patch applied')
