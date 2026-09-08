<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, RefreshCcw, RotateCcwKey, ShieldCheck } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DhBadge, DhButton, DhInput } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'

interface DatabaseCatalogDto {
  environment: string
}

interface EnvironmentReseedResponseDto {
  environment: string
  restored: string[]
  secretValuesReturned: boolean
  completedAtUtc: string
}

const authStore = useAuthStore()
const toastStore = useToastStore()

const loading = ref(false)
const executing = ref(false)
const environment = ref('Desconocido')
const confirmation = ref('')
const lastRestored = ref<string[]>([])

const expectedConfirmation = 'REGENERAR DATOS ENV'
const isSuperUser = computed(() => authStore.hasRole('SuperUsuario'))
const isProduction = computed(() => environment.value.toLowerCase() === 'production')
const confirmationMatches = computed(() => confirmation.value === expectedConfirmation)

async function loadEnvironment() {
  if (!isSuperUser.value) return

  try {
    loading.value = true
    const response = await callEndpoint<DatabaseCatalogDto>({
      method: 'GET',
      path: '/api/auth/database-maintenance/catalog',
      headers: { Accept: 'application/json' },
    })
    environment.value = response.environment || 'Desconocido'
  } catch (error) {
    toastStore.backendError(error, 'No se pudo identificar el ambiente actual.')
  } finally {
    loading.value = false
  }
}

async function reseedEnvironment() {
  if (!confirmationMatches.value || executing.value) return

  try {
    executing.value = true
    const response = await callEndpoint<EnvironmentReseedResponseDto, { confirmation: string }>(
      {
        method: 'POST',
        path: '/api/auth/database-maintenance/reseed-environment',
        headers: { Accept: 'application/json' },
      },
      {
        body: { confirmation: confirmation.value },
      },
    )

    environment.value = response.environment || environment.value
    lastRestored.value = response.restored ?? []
    confirmation.value = ''

    toastStore.success(
      'Datos regenerados',
      `Los datos iniciales configurados para ${environment.value} fueron regenerados correctamente.`,
    )
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron regenerar los datos del ambiente.')
  } finally {
    executing.value = false
  }
}

onMounted(loadEnvironment)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Regenerar datos del ambiente"
      subtitle="Vuelve a crear los datos iniciales que Dhole Auth obtiene de la configuración del .env del ambiente actual."
      :icon="RotateCcwKey"
    >
      <template #actions>
        <DhButton
          label="Actualizar ambiente"
          variant="secondary"
          :icon="RefreshCcw"
          :loading="loading"
          @click="loadEnvironment"
        />
      </template>
    </DhPageHeader>

    <div v-if="!isSuperUser" class="rounded-[28px] border border-red-500/30 bg-red-500/10 p-6">
      <p class="font-black text-[var(--dh-text)]">Acceso restringido</p>
      <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
        Esta acción solo está disponible para el rol de sistema SuperUsuario.
      </p>
    </div>

    <template v-else>
      <div
        class="rounded-[28px] border p-5"
        :class="isProduction ? 'border-red-500/35 bg-red-500/10' : 'border-amber-500/35 bg-amber-500/10'"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <AlertTriangle
              class="mt-0.5 h-6 w-6 shrink-0"
              :class="isProduction ? 'text-red-500' : 'text-amber-500'"
            />
            <div>
              <p class="font-black text-[var(--dh-text)]">Se utilizará únicamente el .env del ambiente actual</p>
              <p class="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
                En producción se usan los valores de producción y en staging los valores de staging. No se copian datos entre ambientes y nunca se muestran secretos del .env en pantalla.
              </p>
            </div>
          </div>
          <DhBadge :label="environment" :variant="isProduction ? 'danger' : 'warning'" />
        </div>
      </div>

      <article class="dh-glass dh-liquid rounded-[30px] p-6 space-y-5">
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[20px] bg-emerald-500/10 text-emerald-500">
            <ShieldCheck class="h-6 w-6" />
          </div>
          <div>
            <h2 class="text-xl font-black text-[var(--dh-text)]">Regenerar datos iniciales</h2>
            <p class="mt-1 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
              Esta acción vuelve a ejecutar el seeding de Auth y recrea, si faltan, los roles del sistema, scopes/permisos, asignaciones de SuperUsuario y el SuperUsuario definido en <code>Seed:SuperAdmin</code> del .env actual.
            </p>
          </div>
        </div>

        <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Escriba exactamente</p>
          <code class="mt-2 block text-sm font-black text-[var(--dh-primary)]">{{ expectedConfirmation }}</code>
        </div>

        <DhInput
          v-model="confirmation"
          label="Frase de confirmación"
          :placeholder="expectedConfirmation"
          autocomplete="off"
          :disabled="executing"
        />

        <DhButton
          class="w-full"
          label="Regenerar datos desde .env"
          variant="primary"
          :icon="RotateCcwKey"
          :loading="executing"
          :disabled="!confirmationMatches || executing"
          @click="reseedEnvironment"
        />

        <div v-if="lastRestored.length" class="rounded-[22px] border border-emerald-500/25 bg-emerald-500/10 p-4">
          <p class="text-sm font-black text-[var(--dh-text)]">Última regeneración completada</p>
          <ul class="mt-2 space-y-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            <li v-for="item in lastRestored" :key="item">• {{ item }}</li>
          </ul>
        </div>
      </article>
    </template>
  </section>
</template>
