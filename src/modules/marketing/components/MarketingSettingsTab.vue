<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { Save } from 'lucide-vue-next'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { ContentService } from '@/core/services/contentService'
import type { SiteSettingDto } from '@/core/interfaces/content'

const props = defineProps<{ siteKey: string }>()
const authStore = useAuthStore()
const toastStore = useToastStore()
const loading = ref(false)
const saving = ref(false)

const form = reactive({
  siteName: '',
  tagline: '',
  contactEmail: '',
  contactPhone: '',
  facebook: '',
  instagram: '',
  linkedin: '',
})

const canEdit = () => authStore.hasScope(CONTENT_SCOPES.settings.edit)

function parseObject(item?: SiteSettingDto) {
  if (!item?.valueJson) return {} as Record<string, string>
  try {
    const value = JSON.parse(item.valueJson)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, string>
      : {}
  } catch {
    return {}
  }
}

async function load() {
  loading.value = true
  try {
    const items = await ContentService.getSettings(props.siteKey || 'main')
    const general = parseObject(items.find((item) => item.key === 'site.general'))
    const social = parseObject(items.find((item) => item.key === 'site.social'))

    Object.assign(form, {
      siteName: general.siteName ?? '',
      tagline: general.tagline ?? '',
      contactEmail: general.contactEmail ?? '',
      contactPhone: general.contactPhone ?? '',
      facebook: social.facebook ?? '',
      instagram: social.instagram ?? '',
      linkedin: social.linkedin ?? '',
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los ajustes del sitio.')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!canEdit() || saving.value) return
  saving.value = true
  try {
    await Promise.all([
      ContentService.upsertSetting('site.general', {
        key: 'site.general',
        valueJson: JSON.stringify({
          siteName: form.siteName.trim(),
          tagline: form.tagline.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone.trim(),
        }),
        isPublic: true,
        siteKey: props.siteKey || 'main',
      }),
      ContentService.upsertSetting('site.social', {
        key: 'site.social',
        valueJson: JSON.stringify({
          facebook: form.facebook.trim(),
          instagram: form.instagram.trim(),
          linkedin: form.linkedin.trim(),
        }),
        isPublic: true,
        siteKey: props.siteKey || 'main',
      }),
    ])
    toastStore.success('Ajustes guardados')
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron guardar los ajustes.')
  } finally {
    saving.value = false
  }
}

watch(() => props.siteKey, () => void load())
onMounted(() => void load())
</script>

<template>
  <section class="dh-glass dh-liquid rounded-[30px] p-5">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 class="text-2xl font-black">Ajustes del sitio</h2>
        <p class="mt-1 text-sm opacity-60">Información general que Mercadeo puede actualizar sin configuraciones técnicas.</p>
      </div>
      <button v-if="canEdit()" class="primary-action" :disabled="saving || loading" @click="save">
        <Save class="h-4 w-4" /> Guardar cambios
      </button>
    </div>

    <div v-if="loading" class="p-12 text-center text-sm opacity-60">Cargando ajustes…</div>
    <div v-else class="mt-6 grid gap-5 xl:grid-cols-2">
      <div class="settings-card">
        <h3 class="text-lg font-black">Identidad del sitio</h3>
        <p class="mt-1 text-sm opacity-55">Nombre y descripción general.</p>
        <div class="mt-5 space-y-4">
          <label class="label">
            Nombre del sitio
            <input v-model="form.siteName" class="field mt-2 w-full" placeholder="Grupo Castro Fallas" />
          </label>
          <label class="label">
            Descripción corta
            <textarea v-model="form.tagline" class="field mt-2 min-h-24 w-full" placeholder="Una frase corta que describa el sitio." />
          </label>
        </div>
      </div>

      <div class="settings-card">
        <h3 class="text-lg font-black">Contacto</h3>
        <p class="mt-1 text-sm opacity-55">Datos que pueden mostrarse a los visitantes.</p>
        <div class="mt-5 space-y-4">
          <label class="label">
            Correo electrónico
            <input v-model="form.contactEmail" class="field mt-2 w-full" type="email" placeholder="contacto@empresa.com" />
          </label>
          <label class="label">
            Teléfono
            <input v-model="form.contactPhone" class="field mt-2 w-full" placeholder="+506 0000-0000" />
          </label>
        </div>
      </div>

      <div class="settings-card xl:col-span-2">
        <h3 class="text-lg font-black">Redes sociales</h3>
        <p class="mt-1 text-sm opacity-55">Pegue el enlace completo de cada perfil.</p>
        <div class="mt-5 grid gap-4 lg:grid-cols-3">
          <label class="label">Facebook<input v-model="form.facebook" class="field mt-2 w-full" placeholder="https://facebook.com/..." /></label>
          <label class="label">Instagram<input v-model="form.instagram" class="field mt-2 w-full" placeholder="https://instagram.com/..." /></label>
          <label class="label">LinkedIn<input v-model="form.linkedin" class="field mt-2 w-full" placeholder="https://linkedin.com/company/..." /></label>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:12px;background:color-mix(in srgb,var(--dh-surface) 88%,transparent);padding:.7rem .8rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}.label{display:block;font-size:.8rem;font-weight:800}.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:12px;background:var(--dh-primary);padding:.68rem .9rem;color:#fff;font-size:.8rem;font-weight:800;transition:160ms}.primary-action:disabled{opacity:.45}.settings-card{border:1px solid var(--dh-border);border-radius:18px;padding:1.1rem;background:color-mix(in srgb,var(--dh-surface) 82%,transparent)}
</style>
