<script setup lang="ts">
import { computed } from 'vue'
import { Activity, Building2, CalendarClock, FileText, MapPin, Pencil, Route, UsersRound, Wallet } from 'lucide-vue-next'
import type { CrmRow } from '../services/crmApi'

type Cell = { label: string; value: unknown }
const props = defineProps<{
  account: CrmRow
  profile: CrmRow | null
  country: string
  contacts: CrmRow[]
  addresses: CrmRow[]
  activities: CrmRow[]
  followups: CrmRow[]
  analyses: CrmRow[]
  routes: CrmRow[]
  credit: CrmRow[]
  contracts: CrmRow[]
  canReadContacts: boolean
  canReadCredit: boolean
  canReadContracts: boolean
  canEditProfile: boolean
}>()
const emit = defineEmits<{
  (event: 'edit-profile'): void
  (event: 'open-tab', tab: 'agenda' | 'history' | 'finance' | 'quotes'): void
}>()
const display = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—'
  if (typeof value === 'string' && value.trim()) return value
  return '—'
}
const person = (row: CrmRow) => display(row.name || row.displayName)
const linkId = (row: CrmRow) => encodeURIComponent(String(row.id))
const time = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return '—'
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
    : '—'
}
const cells = (...items: [string, unknown][]): Cell[] =>
  items.map(([label, value]) => ({ label, value }))

const companyIdentity = computed(() => cells(
  ['Nombre de cuenta', props.account.displayName],
  ['Razón social', props.account.legalName],
  ['Identificación', props.account.taxId],
  ['Tipo de identificación', props.account.taxIdTypeCode],
  ['País', props.country],
  ['Tipo de relación', props.account.relationshipTypeCode],
  ['Categoría', [props.account.categoryType, props.account.categoryCode].filter(Boolean).join(' · ')],
  ['Origen de la cuenta', props.account.sourceCode],
))
const companyDetails = computed(() => cells(
  ['Teléfono', props.profile?.phone],
  ['Correo electrónico', props.profile?.email],
  ['Correo comercial / marketing', props.profile?.marketingEmail],
  ['Sitio web', props.profile?.website],
  ['Sector productivo', props.profile?.sector],
  ['Actividad de la empresa', props.profile?.businessActivity],
  ['Líneas de productos o mercancías', props.profile?.products],
  ['Historia de la empresa', props.profile?.companyHistory],
))
const commercialDetails = computed(() => cells(
  ['Observaciones comerciales', props.profile?.commercialObservations],
  ['Mercados en análisis', props.analyses.map(a => display(a.marketCode)).filter(x => x !== '—').join(', ')],
  ['Nacionalización de aduanas', props.analyses.length
    ? props.analyses.some(a => a.customsNationalizationRequired === true) : null],
  ['Volumen estimado', props.analyses.map(a =>
    [a.estimatedMonthlyVolume, a.volumeUnit].filter(v => v !== null && v !== undefined && v !== '').join(' ')
  ).filter(Boolean).join(' · ')],
  ['Rutas habituales', props.routes.filter(r => r.isActive !== false).length],
))
const operationDetails = computed(() => cells(
  ['Observaciones e instrucciones operativas', props.profile?.operationalInstructions],
  ['Correo de facturación', props.profile?.billingEmail],
  ['Direcciones registradas', props.addresses.length],
))
const primaryContact = computed(() =>
  props.contacts.find(c => c.isPrimary === true || c.primary === true) ?? null)
const datedActivities = computed(() => props.activities.map(a => ({
  id: String(a.id), kind: display(a.type), title: display(a.subject),
  stamp: String(a.occurredAt ?? a.scheduledStartAt ?? ''),
  status: display(a.status),
  url: '/crm/activities/' + linkId(a),
})))
const datedFollowups = computed(() => props.followups.map(f => ({
  id: String(f.id), kind: 'SEGUIMIENTO', title: display(f.channel),
  stamp: String(f.dueAt ?? ''), status: display(f.status),
  url: '/crm/followups/' + linkId(f),
})))
const timeline = computed(() =>
  [...datedActivities.value, ...datedFollowups.value]
    .sort((a, b) => b.stamp.localeCompare(a.stamp)).slice(0, 8))
const nextFollowup = computed(() => props.followups
  .filter(f => String(f.status).toLowerCase() === 'pending' &&
    typeof f.dueAt === 'string' && new Date(f.dueAt).getTime() >= Date.now())
  .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0])
const lastInteraction = computed(() => datedActivities.value
  .filter(a => a.stamp)
  .sort((a, b) => b.stamp.localeCompare(a.stamp))[0])
const creditData = computed(() => props.credit[0])
</script>

<template>
  <div class="dynamics-sheet grid items-start gap-3 xl:grid-cols-[minmax(0,.88fr)_minmax(0,1.05fr)_minmax(290px,.91fr)]"
    data-crm-dynamics-sheet>
    <div class="min-w-0 space-y-3">
      <section class="sheet-panel">
        <div class="sheet-title"><Building2 class="h-4 w-4" />Información de la cuenta</div>
        <dl class="sheet-fields">
          <div v-for="cell in companyIdentity" :key="cell.label" class="sheet-field">
            <dt>{{ cell.label }}</dt><dd>{{ display(cell.value) }}</dd>
          </div>
        </dl>
      </section>
      <section class="sheet-panel">
        <div class="sheet-heading">
          <h2 class="sheet-title"><Building2 class="h-4 w-4" />Datos de la empresa</h2>
          <button v-if="canEditProfile" type="button" class="sheet-link" @click="emit('edit-profile')">
            <Pencil class="h-3.5 w-3.5" />Editar
          </button>
        </div>
        <p v-if="!profile" class="sheet-empty">La ficha empresarial aún no se ha completado.</p>
        <dl v-else class="sheet-fields">
          <div v-for="cell in companyDetails" :key="cell.label" class="sheet-field">
            <dt>{{ cell.label }}</dt><dd>{{ display(cell.value) }}</dd>
          </div>
        </dl>
      </section>
      <section class="sheet-panel">
        <h2 class="sheet-title"><MapPin class="h-4 w-4" />Direcciones</h2>
        <p v-if="!addresses.length" class="sheet-empty">Sin direcciones registradas.</p>
        <div v-for="address in addresses" :key="String(address.id)" class="sheet-related">
          <span class="sheet-mini">{{ display(address.addressType) }}</span>
          <p>{{ display(address.addressText) }}</p>
        </div>
      </section>
    </div>

    <div class="min-w-0 space-y-3">
      <section class="sheet-panel">
        <h2 class="sheet-title"><CalendarClock class="h-4 w-4" />Seguimiento de la cuenta</h2>
        <dl class="sheet-fields">
          <div class="sheet-field"><dt>Última gestión registrada</dt><dd>{{ lastInteraction ? time(lastInteraction.stamp) : '—' }}</dd></div>
          <div class="sheet-field"><dt>Próximo seguimiento pendiente</dt><dd>{{ nextFollowup ? time(nextFollowup.dueAt) : '—' }}</dd></div>
          <div class="sheet-field"><dt>Actividades registradas</dt><dd>{{ activities.length }}</dd></div>
          <div class="sheet-field"><dt>Seguimientos visibles</dt><dd>{{ followups.length }}</dd></div>
        </dl>
        <button type="button" class="sheet-link mt-3" @click="emit('open-tab', 'agenda')">Abrir agenda y registrar actividades</button>
      </section>
      <section class="sheet-panel">
        <h2 class="sheet-title"><Route class="h-4 w-4" />Análisis comercial</h2>
        <dl class="sheet-fields">
          <div v-for="cell in commercialDetails" :key="cell.label" class="sheet-field">
            <dt>{{ cell.label }}</dt><dd>{{ display(cell.value) }}</dd>
          </div>
        </dl>
        <div v-for="analysis in analyses.slice(0, 4)" :key="String(analysis.id)" class="sheet-related">
          <RouterLink :to="'/crm/analyses/' + linkId(analysis)" class="sheet-link">
            {{ display(analysis.marketCode) }}
          </RouterLink>
          <p class="sheet-mini">{{ display(analysis.estimatedMonthlyVolume) }} {{ display(analysis.volumeUnit) }}</p>
        </div>
        <button type="button" class="sheet-link mt-3" @click="emit('open-tab', 'history')">
          Ver rutas procedentes de reuniones y cotizaciones
        </button>
      </section>
      <section class="sheet-panel">
        <h2 class="sheet-title"><FileText class="h-4 w-4" />Análisis operativo e instrucciones</h2>
        <dl class="sheet-fields">
          <div v-for="cell in operationDetails" :key="cell.label" class="sheet-field">
            <dt>{{ cell.label }}</dt><dd>{{ display(cell.value) }}</dd>
          </div>
        </dl>
      </section>
      <section v-if="canReadCredit" class="sheet-panel">
        <div class="sheet-heading">
          <h2 class="sheet-title"><Wallet class="h-4 w-4" />Crédito y facturación</h2>
          <button type="button" class="sheet-link" @click="emit('open-tab', 'finance')">Ver detalle</button>
        </div>
        <p v-if="!creditData" class="sheet-empty">No hay perfil de crédito registrado.</p>
        <dl v-else class="sheet-fields">
          <div v-for="cell in cells(
              ['Estado', creditData.status],
              ['Días de crédito', creditData.creditDays],
              ['Límite de crédito', creditData.creditLimit],
              ['Moneda', creditData.currencyCode],
              ['Financiamiento mensual', creditData.monthlyFinancingPct],
              ['Condiciones de pago', creditData.paymentConditions],
            )" :key="cell.label" class="sheet-field">
            <dt>{{ cell.label }}</dt><dd>{{ display(cell.value) }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <aside class="min-w-0 space-y-3" aria-label="Registros relacionados">
      <section class="sheet-panel">
        <div class="sheet-heading">
          <h2 class="sheet-title"><Activity class="h-4 w-4" />Escala de tiempo</h2>
          <button type="button" class="sheet-link" @click="emit('open-tab', 'agenda')">Ver todo</button>
        </div>
        <p class="sheet-mini mb-3">Reuniones, llamadas, visitas y seguimientos reales.</p>
        <p v-if="!timeline.length" class="sheet-empty">No hay actividades registradas.</p>
        <ol v-else class="sheet-timeline">
          <li v-for="entry in timeline" :key="entry.kind + entry.id">
            <RouterLink :to="entry.url" class="sheet-link">{{ entry.title }}</RouterLink>
            <span class="sheet-mini block">{{ entry.kind }} · {{ entry.status }}</span>
            <time class="sheet-mini block">{{ time(entry.stamp) }}</time>
          </li>
        </ol>
      </section>
      <section v-if="canReadContacts" class="sheet-panel">
        <div class="sheet-heading">
          <h2 class="sheet-title"><UsersRound class="h-4 w-4" />Contactos relacionados</h2>
          <span class="sheet-mini">{{ contacts.length }}</span>
        </div>
        <p v-if="!contacts.length" class="sheet-empty">No hay contactos vinculados.</p>
        <div v-if="primaryContact" class="sheet-primary">
          <span class="sheet-mini">Contacto principal</span>
          <RouterLink :to="'/crm/contacts/' + linkId(primaryContact)" class="sheet-link block">
            {{ person(primaryContact) }}
          </RouterLink>
        </div>
        <div v-for="contact in contacts.slice(0, 8)" :key="String(contact.id)" class="sheet-related">
          <RouterLink :to="'/crm/contacts/' + linkId(contact)" class="sheet-link">{{ person(contact) }}</RouterLink>
          <p class="sheet-mini">{{ display(contact.jobTitle || contact.email) }}</p>
        </div>
      </section>
      <section v-if="canReadContracts" class="sheet-panel">
        <h2 class="sheet-title"><FileText class="h-4 w-4" />Contratos vinculados</h2>
        <p v-if="!contracts.length" class="sheet-empty">No hay contratos registrados.</p>
        <div v-for="contract in contracts.slice(0, 4)" :key="String(contract.id)" class="sheet-related">
          <p class="font-semibold">{{ display(contract.contractNumber) }}</p>
          <p class="sheet-mini">{{ display(contract.status) }} · {{ time(contract.expiryDate) }}</p>
        </div>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.sheet-panel{min-width:0;border:1px solid var(--dh-border);border-radius:.75rem;background:var(--dh-card);padding:1rem;box-shadow:var(--dh-shadow-sm)}
.sheet-title{display:flex;align-items:center;gap:.5rem;font-size:.8rem;font-weight:800;color:var(--dh-text);margin-bottom:.7rem}
.sheet-title svg{color:var(--dh-primary);flex-shrink:0}
.sheet-heading{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.6rem}
.sheet-heading .sheet-title{margin-bottom:0}
.sheet-fields{display:flex;flex-direction:column}
.sheet-field{display:grid;grid-template-columns:minmax(0,44%) minmax(0,56%);gap:1rem;align-items:start;padding:.66rem 0;border-bottom:1px solid var(--dh-border);font-size:.75rem;line-height:1.5}
.sheet-field:last-child{border-bottom:0}
.sheet-field dt{color:var(--dh-text-muted);font-weight:600}
.sheet-field dd{margin:0;min-width:0;overflow-wrap:anywhere;color:var(--dh-text);font-weight:600}
.sheet-link{display:inline-flex;align-items:center;gap:.3rem;color:var(--dh-primary);font-size:.75rem;font-weight:750;text-align:left}
.sheet-link:hover{text-decoration:underline}
.sheet-link:focus-visible{outline:2px solid var(--dh-primary);outline-offset:3px}
.sheet-empty{padding:1rem 0;font-size:.75rem;color:var(--dh-text-muted)}
.sheet-mini{font-size:.68rem;color:var(--dh-text-muted);line-height:1.5}
.sheet-related{padding:.75rem 0;border-bottom:1px solid var(--dh-border);font-size:.75rem;overflow-wrap:anywhere}
.sheet-related:last-child{border-bottom:0}
.sheet-primary{background:var(--dh-shell);border:1px solid var(--dh-border);padding:.65rem;border-radius:.5rem}
.sheet-timeline{border-left:1px solid var(--dh-border);margin-left:.4rem}
.sheet-timeline li{position:relative;padding:0 0 1.1rem 1.15rem}
.sheet-timeline li:before{position:absolute;left:-.28rem;top:.35rem;content:'';height:.55rem;width:.55rem;border:2px solid var(--dh-card);border-radius:100%;background:var(--dh-primary)}
@media(max-width:620px){.sheet-field{grid-template-columns:minmax(0,43%) minmax(0,57%);gap:.6rem}}
</style>
