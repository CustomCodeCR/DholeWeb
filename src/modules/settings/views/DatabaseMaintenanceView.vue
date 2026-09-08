<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AlertTriangle, Database, RefreshCcw, ShieldAlert, Trash2 } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'

interface DatabaseTableDto {
  schema: string
  name: string
  key: string
  isProtected: boolean
}

interface DatabaseDto {
  name: string
  available: boolean
  tables: DatabaseTableDto[]
}

interface DatabaseCatalogDto {
  environment: string
  databases: DatabaseDto[]
}

interface TruncateResponseDto {
  environment: string
  database: string
  mode: 'table' | 'database'
  table?: string | null
  cascade: boolean
  tablesTruncated: number
  completedAtUtc: string
}

const authStore = useAuthStore()
const toastStore = useToastStore()

const loading = ref(false)
const executing = ref(false)
const catalog = ref<DatabaseCatalogDto | null>(null)
const selectedDatabase = ref('')
const selectedTable = ref('')
const mode = ref<'table' | 'database'>('table')
const cascade = ref(false)
const confirmation = ref('')

const isSuperUser = computed(() => authStore.hasRole('SuperUsuario'))
const environment = computed(() => catalog.value?.environment || 'Desconocido')
const isProduction = computed(() => environment.value.toLowerCase() === 'production')

const databaseOptions = computed(() =>
  (catalog.value?.databases ?? []).map((database) => ({
    label: database.available ? database.name : `${database.name} · no disponible`,
    value: database.name,
    disabled: !database.available,
  })),
)

const currentDatabase = computed(() =>
  catalog.value?.databases.find((database) => database.name === selectedDatabase.value) ?? null,
)

const tableOptions = computed(() =>
  (currentDatabase.value?.tables ?? [])
    .filter((table) => !table.isProtected)
    .map((table) => ({ label: table.key, value: table.key })),
)

const protectedTables = computed(() =>
  (currentDatabase.value?.tables ?? []).filter((table) => table.isProtected),
)

const expectedConfirmation = computed(() => {
  if (!selectedDatabase.value) return ''
  if (mode.value === 'database') return `TRUNCAR BASE ${selectedDatabase.value}`
  if (!selectedTable.value) return ''
  return `TRUNCAR TABLA ${selectedDatabase.value}.${selectedTable.value}`
})

const confirmationMatches = computed(
  () => expectedConfirmation.value.length > 0 && confirmation.value === expectedConfirmation.value,
)

const authDatabaseWarning = computed(
  () => selectedDatabase.value.toLowerCase().includes('auth'),
)

watch(selectedDatabase, () => {
  selectedTable.value = ''
  confirmation.value = ''
  cascade.value = false
})

watch(mode, () => {
  confirmation.value = ''
  cascade.value = false
})

watch(selectedTable, () => {
  confirmation.value = ''
})

async function loadCatalog() {
  if (!isSuperUser.value) return

  try {
    loading.value = true
    const response = await callEndpoint<DatabaseCatalogDto>({
      method: 'GET',
      path: '/api/auth/database-maintenance/catalog',
      headers: { Accept: 'application/json' },
    })

    catalog.value = response

    if (!selectedDatabase.value) {
      selectedDatabase.value = response.databases.find((database) => database.available)?.name ?? ''
    }
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el catálogo de bases de datos.')
  } finally {
    loading.value = false
  }
}

async function executeTruncate() {
  if (!confirmationMatches.value || executing.value) return

  try {
    executing.value = true

    const response = await callEndpoint<TruncateResponseDto, {
      database: string
      mode: 'table' | 'database'
      table: string | null
      cascade: boolean
      confirmation: string
    }>(
      {
        method: 'POST',
        path: '/api/auth/database-maintenance/truncate',
        headers: { Accept: 'application/json' },
      },
      {
        body: {
          database: selectedDatabase.value,
          mode: mode.value,
          table: mode.value === 'table' ? selectedTable.value : null,
          cascade: mode.value === 'table' ? cascade.value : true,
          confirmation: confirmation.value,
        },
      },
    )

    toastStore.success(
      mode.value === 'table' ? 'Tabla vaciada' : 'Base de datos vaciada',
      mode.value === 'table'
        ? `${response.database}.${response.table} fue truncada correctamente.`
        : `${response.tablesTruncated} tablas fueron truncadas en ${response.database}.`,
    )

    confirmation.value = ''
    await loadCatalog()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo ejecutar el truncate solicitado.')
  } finally {
    executing.value = false
  }
}

onMounted(loadCatalog)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Mantenimiento de bases de datos"
      subtitle="Vacía datos de una tabla o de una base completa sin eliminar la estructura. Disponible únicamente para SuperUsuario."
      :icon="Database"
    >
      <template #actions>
        <DhButton
          label="Actualizar"
          variant="secondary"
          :icon="RefreshCcw"
          :loading="loading"
          @click="loadCatalog"
        />
      </template>
    </DhPageHeader>

    <div v-if="!isSuperUser" class="rounded-[28px] border border-red-500/30 bg-red-500/10 p-6">
      <div class="flex items-start gap-3">
        <ShieldAlert class="mt-0.5 h-6 w-6 shrink-0 text-red-500" />
        <div>
          <p class="font-black text-[var(--dh-text)]">Acceso restringido</p>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            Esta herramienta solo puede ser utilizada por el rol de sistema SuperUsuario.
          </p>
        </div>
      </div>
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
              <p class="font-black text-[var(--dh-text)]">Operación destructiva</p>
              <p class="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
                Los datos eliminados por TRUNCATE no se pueden recuperar desde Dhole. La herramienta nunca elimina el esquema ni la tabla
                <code>__EFMigrationsHistory</code>. En producción confirme siempre que seleccionó la base y tabla correctas.
              </p>
            </div>
          </div>
          <DhBadge :label="environment" :variant="isProduction ? 'danger' : 'warning'" />
        </div>
      </div>

      <div class="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <article class="dh-glass dh-liquid rounded-[30px] p-6 space-y-5">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Destino</p>
            <h2 class="mt-1 text-xl font-black text-[var(--dh-text)]">Seleccione qué desea vaciar</h2>
          </div>

          <DhSelect
            v-model="selectedDatabase"
            label="Base de datos"
            placeholder="Seleccione una base"
            :options="databaseOptions"
            :disabled="loading || executing"
          />

          <div v-if="selectedDatabase" class="grid grid-cols-2 gap-3">
            <button
              type="button"
              class="rounded-[22px] border p-4 text-left transition"
              :class="mode === 'table'
                ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10'
                : 'border-[var(--dh-border)] bg-[var(--dh-card)]'"
              @click="mode = 'table'"
            >
              <p class="text-sm font-black text-[var(--dh-text)]">Una tabla</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Vacía únicamente la tabla seleccionada.</p>
            </button>

            <button
              type="button"
              class="rounded-[22px] border p-4 text-left transition"
              :class="mode === 'database'
                ? 'border-red-500 bg-red-500/10'
                : 'border-[var(--dh-border)] bg-[var(--dh-card)]'"
              @click="mode = 'database'"
            >
              <p class="text-sm font-black text-[var(--dh-text)]">Base completa</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Vacía todas las tablas de datos y mantiene el esquema.</p>
            </button>
          </div>

          <DhSelect
            v-if="mode === 'table' && selectedDatabase"
            v-model="selectedTable"
            label="Tabla"
            placeholder="Seleccione una tabla"
            :options="tableOptions"
            :disabled="loading || executing"
          />

          <DhCheckbox
            v-if="mode === 'table' && selectedTable"
            v-model="cascade"
            label="Incluir dependencias (CASCADE)"
            description="Actívelo solo si PostgreSQL indica que otras tablas dependen de esta tabla. Puede vaciar tablas relacionadas."
            :disabled="executing"
          />

          <p v-if="protectedTables.length" class="text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ protectedTables.length }} tabla(s) técnica(s) protegida(s) no pueden seleccionarse.
          </p>
        </article>

        <article class="dh-glass dh-liquid rounded-[30px] p-6 space-y-5">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.12em] text-red-500">Confirmación</p>
            <h2 class="mt-1 text-xl font-black text-[var(--dh-text)]">
              {{ mode === 'table' ? 'Confirmar truncate de tabla' : 'Confirmar vaciado de base' }}
            </h2>
          </div>

          <div v-if="authDatabaseWarning && mode === 'database'" class="rounded-[22px] border border-red-500/30 bg-red-500/10 p-4">
            <p class="text-sm font-black text-red-600 dark:text-red-300">Advertencia especial de Auth</p>
            <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
              Vaciar esta base puede eliminar usuarios, roles, permisos y sesiones. El SuperUsuario se vuelve a sembrar cuando Auth reinicie,
              pero la operación sigue siendo destructiva.
            </p>
          </div>

          <div v-if="expectedConfirmation" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Escriba exactamente</p>
            <code class="mt-2 block break-all text-sm font-black text-red-500">{{ expectedConfirmation }}</code>
          </div>

          <DhInput
            v-model="confirmation"
            label="Frase de confirmación"
            :placeholder="expectedConfirmation || 'Seleccione primero el destino'"
            autocomplete="off"
            :disabled="!expectedConfirmation || executing"
          />

          <DhButton
            class="w-full"
            :label="mode === 'table' ? 'Vaciar tabla' : 'Vaciar base de datos'"
            variant="danger"
            :icon="Trash2"
            :loading="executing"
            :disabled="!confirmationMatches || executing"
            @click="executeTruncate"
          />

          <p class="text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            El ambiente no se puede cambiar desde esta pantalla: Dhole producción opera únicamente contra producción y Dhole staging únicamente
            contra staging.
          </p>
        </article>
      </div>
    </template>
  </section>
</template>
