<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/core/stores/authStore'
import { useI18n } from 'vue-i18n'
import { crmError, crmGet, crmPath, crmPatch, crmRequest, crmUuid, type CrmRow } from '../services/crmApi'

const route = useRoute(), router = useRouter(), auth = useAuthStore()
const { t } = useI18n()
const id = String(route.params.id ?? '')
const contact = ref<CrmRow | null>(null)
const preference = ref<CrmRow | null>(null)
const consents = ref<CrmRow[]>([])
const error = ref(''), notice = ref(''), busy = ref(false)
const edit = reactive({ name: '', jobTitle: '', email: '', phone: '' })
const pref = reactive({
  preferredChannel: 'EMAIL', preferredDaysMask: 127, startLocalTime: '',
  endLocalTime: '', timezoneId: 'America/Costa_Rica',
  frequencyDays: 7, doNotContact: false,
})
const consent = reactive({ channel: 'EMAIL', purpose: 'MARKETING',
  status: 'REVOKED', source: 'MANUAL', evidenceReference: '' })
const can = (scope: string) => auth.hasScope(scope)
async function load() {
  busy.value = true; error.value = ''
  try {
    contact.value = await crmGet('contacts', id)
    Object.assign(edit, {
      name: String(contact.value?.name || ''), jobTitle: String(contact.value?.jobTitle || ''),
      email: String(contact.value?.email || ''), phone: String(contact.value?.phone || ''),
    })
    const [p, c] = await Promise.all([
      crmRequest<CrmRow | null>(crmPath('contacts', id, 'preferences')),
      crmRequest<CrmRow[]>(crmPath('contacts', id, 'consents')),
    ])
    preference.value = p
    consents.value = c
    if (p) {
      pref.preferredChannel = String(p.preferredChannel || 'EMAIL')
      pref.preferredDaysMask = Number(p.preferredDaysMask ?? 127)
      pref.startLocalTime = String(p.startLocalTime || '')
      pref.endLocalTime = String(p.endLocalTime || '')
      pref.timezoneId = String(p.timezoneId || 'America/Costa_Rica')
      pref.frequencyDays = Number(p.frequencyDays ?? 7)
      pref.doNotContact = Boolean(p.doNotContact)
    }
  } catch (e) { error.value = crmError(e) }
  finally { busy.value = false }
}
async function run(action: () => Promise<unknown>) {
  busy.value = true; error.value = ''; notice.value = ''
  try { await action(); await load(); notice.value = t('crm.saved') }
  catch (e) { error.value = crmError(e) }
  finally { busy.value = false }
}
function saveContact() {
  if (!contact.value || !can('crm.contact.update')) return
  return run(() => crmPatch('contacts', id, {
    expectedVersion: contact.value?.rowVersion, ...edit,
  }))
}
function savePreferences() {
  if (!can('crm.contact.update')) return
  return run(() => crmRequest(crmPath('contacts', id, 'preferences'), 'PUT', {
    expectedVersion: preference.value?.rowVersion ?? null,
    preferredChannel: pref.preferredChannel, preferredDaysMask: pref.preferredDaysMask,
    startLocalTime: pref.startLocalTime || null, endLocalTime: pref.endLocalTime || null,
    timezoneId: pref.timezoneId, frequencyDays: pref.frequencyDays,
    doNotContact: pref.doNotContact,
  }))
}
function addConsent() {
  if (!can('crm.contact.marketing-consent.manage')) return
  if (consent.status === 'OPTED_IN' && !consent.evidenceReference.trim()) {
    error.value = t('crm.consentEvidence'); return
  }
  return run(() => crmRequest(crmPath('contacts', id, 'consents'), 'POST', {
    ...consent, evidenceReference: consent.evidenceReference || null,
  }, crmUuid()))
}
onMounted(() => { if (can('crm.contact.read')) void load() })
</script>

<template>
  <main class="mx-auto max-w-5xl space-y-5 p-3 text-[var(--dh-text)] sm:p-6">
    <button class="crm-button" @click="router.back()">← {{ t('crm.back') }}</button>
    <h1 class="text-2xl font-black">{{ t('crm.contactDetails') }}</h1>
    <p v-if="!can('crm.contact.read')" role="alert">{{ t('crm.denied') }}</p>
    <template v-else>
      <p v-if="busy" role="status">{{ t('common.loading') }}</p>
      <p v-if="error" role="alert" class="text-red-600">{{ error }}</p>
      <p v-if="notice" role="status" class="text-emerald-600">{{ notice }}</p>
      <form v-if="contact" class="crm-panel grid gap-4 p-5 sm:grid-cols-2" @submit.prevent="saveContact">
        <label class="text-sm font-bold">{{ t('crm.contactName') }}<input v-model.trim="edit.name" class="crm-input" required maxlength="220" /></label>
        <label class="text-sm font-bold">{{ t('crm.jobTitle') }}<input v-model.trim="edit.jobTitle" class="crm-input" /></label>
        <label class="text-sm font-bold">{{ t('crm.email') }}<input v-model.trim="edit.email" class="crm-input" type="email" /></label>
        <label class="text-sm font-bold">{{ t('crm.phone') }}<input v-model.trim="edit.phone" class="crm-input" /></label>
        <button v-if="can('crm.contact.update')" type="submit" :disabled="busy" class="crm-button">{{ t('common.save') }}</button>
      </form>
      <form v-if="contact" class="crm-panel grid gap-4 p-5 sm:grid-cols-2" @submit.prevent="savePreferences">
        <h2 class="text-lg font-bold sm:col-span-2">{{ t('crm.contactPreferences') }}</h2>
        <label class="text-sm font-bold">{{ t('crm.preferredChannel') }}
          <select v-model="pref.preferredChannel" class="crm-input">
            <option v-for="v in ['EMAIL','PHONE','WHATSAPP','VISIT','OTHER']" :key="v">{{ v }}</option>
          </select>
        </label>
        <label class="text-sm font-bold">{{ t('crm.timezone') }}<input v-model.trim="pref.timezoneId" class="crm-input" /></label>
        <label class="text-sm font-bold">{{ t('crm.frequencyDays') }}<input v-model.number="pref.frequencyDays" type="number" min="1" class="crm-input" /></label>
        <label class="text-sm font-bold">{{ t('crm.preferredDays') }}<input v-model.number="pref.preferredDaysMask" type="number" min="0" max="127" class="crm-input" /></label>
        <label class="text-sm font-bold">{{ t('crm.startHour') }}<input v-model="pref.startLocalTime" type="time" class="crm-input" /></label>
        <label class="text-sm font-bold">{{ t('crm.endHour') }}<input v-model="pref.endLocalTime" type="time" class="crm-input" /></label>
        <label class="flex items-center gap-2 font-bold">
          <input v-model="pref.doNotContact" type="checkbox" />{{ t('crm.doNotContact') }}
        </label>
        <button v-if="can('crm.contact.update')" type="submit" :disabled="busy" class="crm-button">{{ t('common.save') }}</button>
      </form>
      <section v-if="contact" class="crm-panel space-y-4 p-5">
        <h2 class="text-lg font-bold">{{ t('crm.consentHistory') }}</h2>
        <div v-for="c in consents" :key="c.id" class="border-b border-[var(--dh-border)] py-2 text-sm">
          {{ c.channel }} — {{ c.status }} · {{ c.purpose }} · {{ c.capturedAt }}
        </div>
        <p v-if="!consents.length" class="text-sm">{{ t('common.noData') }}</p>
        <form v-if="can('crm.contact.marketing-consent.manage')" class="grid gap-3 sm:grid-cols-2" @submit.prevent="addConsent">
          <label class="text-sm font-bold">{{ t('common.status') }}
            <select v-model="consent.status" class="crm-input">
              <option value="OPTED_OUT">OPTED_OUT</option>
              <option value="REVOKED">REVOKED</option>
              <option value="OPTED_IN">OPTED_IN</option>
            </select>
          </label>
          <label class="text-sm font-bold">{{ t('crm.evidence') }}
            <input v-model.trim="consent.evidenceReference" class="crm-input"
              :required="consent.status === 'OPTED_IN'" />
          </label>
          <label class="text-sm font-bold">{{ t('crm.consentSource') }}
            <input v-model.trim="consent.source" class="crm-input" required />
          </label>
          <button type="submit" :disabled="busy" class="crm-button">{{ t('crm.registerConsent') }}</button>
        </form>
      </section>
    </template>
  </main>
</template>

<style scoped>
.crm-panel{border:1px solid var(--dh-border);border-radius:1.2rem;background:var(--dh-card)}
.crm-input{display:block;width:100%;background:var(--dh-card);border:1px solid var(--dh-border);border-radius:.7rem;padding:.6rem;color:var(--dh-text)}
.crm-button{min-height:42px;border:1px solid var(--dh-border);border-radius:.7rem;padding:.6rem 1rem}
</style>
