<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Save, Search, UsersRound } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { UsersService } from '@/core/services/usersService'
import { SellerVisibilityService } from '@/core/services/sellerVisibilityService'
import { useToastStore } from '@/core/stores/toastStore'
import type { UserDto } from '@/core/interfaces/users'

const toastStore = useToastStore()
const users = ref<UserDto[]>([])
const viewerUserId = ref('')
const sellerSearch = ref('')
const assignedSellerIds = ref<string[]>([])
const loadingUsers = ref(false)
const loadingAssignments = ref(false)
const saving = ref(false)

const activeUsers = computed(() =>
  users.value
    .filter((user) => user.isActive && user.userType === 'Internal')
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es')),
)

const selectedViewer = computed(() =>
  activeUsers.value.find((user) => user.id === viewerUserId.value) ?? null,
)

const filteredSellers = computed(() => {
  const query = sellerSearch.value.trim().toLowerCase()
  if (!query) return activeUsers.value
  return activeUsers.value.filter((user) =>
    `${user.displayName} ${user.userName} ${user.email}`.toLowerCase().includes(query),
  )
})

function userLabel(user: UserDto) {
  return `${user.displayName} · ${user.email}`
}

function isAssigned(userId: string) {
  return userId === viewerUserId.value || assignedSellerIds.value.includes(userId)
}

function toggleSeller(userId: string) {
  if (!viewerUserId.value || userId === viewerUserId.value) return
  if (assignedSellerIds.value.includes(userId)) {
    assignedSellerIds.value = assignedSellerIds.value.filter((id) => id !== userId)
  } else {
    assignedSellerIds.value = [...assignedSellerIds.value, userId]
  }
}

async function loadUsers() {
  try {
    loadingUsers.value = true
    users.value = await UsersService.browse({
      pageNumber: 1,
      pageSize: 500,
      isActive: true,
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los usuarios para configurar la visibilidad.')
  } finally {
    loadingUsers.value = false
  }
}

async function loadAssignments() {
  assignedSellerIds.value = []
  if (!viewerUserId.value) return

  try {
    loadingAssignments.value = true
    const visibility = await SellerVisibilityService.get(viewerUserId.value)
    assignedSellerIds.value = visibility.sellerUserIds.filter((id) => id !== viewerUserId.value)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la visibilidad asignada al usuario.')
  } finally {
    loadingAssignments.value = false
  }
}

async function saveAssignments() {
  if (!viewerUserId.value || saving.value) return
  try {
    saving.value = true
    const saved = await SellerVisibilityService.replace(
      viewerUserId.value,
      assignedSellerIds.value.filter((id) => id !== viewerUserId.value),
    )
    assignedSellerIds.value = saved.sellerUserIds.filter((id) => id !== viewerUserId.value)
    toastStore.success(
      'Visibilidad actualizada',
      `${selectedViewer.value?.displayName ?? 'El usuario'} ahora puede ver sus propias tarifas y ${assignedSellerIds.value.length} vendedor(es) asignado(s).`,
    )
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la visibilidad comercial.')
  } finally {
    saving.value = false
  }
}

watch(viewerUserId, loadAssignments)
onMounted(loadUsers)
</script>

<template>
  <section class="space-y-5">
    <DhPageHeader
      title="Visibilidad comercial"
      subtitle="Defina qué vendedores puede consultar cada vendedor supervisor. Su propia gestión siempre se incluye automáticamente."
      :icon="UsersRound"
    >
      <template #actions>
        <DhButton
          :icon="Save"
          label="Guardar asignación"
          :loading="saving"
          :disabled="!viewerUserId || loadingAssignments"
          @click="saveAssignments"
        />
      </template>
    </DhPageHeader>

    <div class="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
      <aside class="dh-glass dh-liquid min-w-0 rounded-[28px] p-4 sm:p-5">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Usuario con visibilidad delegada</p>
        <h2 class="mt-2 text-lg font-black text-[var(--dh-text)]">Supervisor / vendedor</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          El rol <strong>Vendedor Supervisor</strong> usa la lista configurada aquí. El rol <strong>Vendedor Jefe</strong> no necesita asignaciones porque ve a todos.
        </p>

        <label class="mt-5 block">
          <span class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Usuario</span>
          <select
            v-model="viewerUserId"
            class="h-12 w-full min-w-0 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-base font-bold text-[var(--dh-text)] outline-none sm:text-sm"
            :disabled="loadingUsers"
          >
            <option value="">Seleccione un usuario</option>
            <option v-for="user in activeUsers" :key="user.id" :value="user.id">
              {{ userLabel(user) }}
            </option>
          </select>
        </label>

        <div v-if="selectedViewer" class="mt-4 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="break-words text-sm font-black text-[var(--dh-text)]">{{ selectedViewer.displayName }}</p>
          <p class="mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]">{{ selectedViewer.email }}</p>
          <p class="mt-3 text-xs font-bold text-[var(--dh-primary)]">Su propia gestión siempre es visible.</p>
        </div>
      </aside>

      <section class="dh-glass dh-liquid min-w-0 rounded-[28px] p-4 sm:p-5">
        <div class="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div class="min-w-0">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Vendedores permitidos</p>
            <h2 class="mt-2 break-words text-lg font-black text-[var(--dh-text)]">
              {{ selectedViewer ? `Qué puede ver ${selectedViewer.displayName}` : 'Seleccione primero un usuario' }}
            </h2>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
              Marque únicamente los vendedores adicionales. El usuario seleccionado no necesita marcarse a sí mismo.
            </p>
          </div>
          <DhInput
            v-model="sellerSearch"
            class="w-full md:max-w-sm"
            placeholder="Buscar vendedor..."
            :icon="Search"
            :disabled="!viewerUserId"
          />
        </div>

        <div v-if="loadingAssignments" class="mt-5 rounded-[22px] border border-dashed border-[var(--dh-border)] p-8 text-center text-sm font-bold text-[var(--dh-text-muted)]">
          Cargando asignaciones...
        </div>

        <div v-else-if="!viewerUserId" class="mt-5 rounded-[22px] border border-dashed border-[var(--dh-border)] p-8 text-center text-sm font-bold text-[var(--dh-text-muted)]">
          Seleccione el vendedor supervisor para configurar su alcance.
        </div>

        <div v-else class="mt-5 grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
          <button
            v-for="user in filteredSellers"
            :key="user.id"
            type="button"
            class="flex min-w-0 touch-manipulation items-start gap-3 rounded-[20px] border p-3 text-left transition"
            :class="isAssigned(user.id)
              ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.08)]'
              : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:bg-[var(--dh-card-hover)]'"
            :disabled="user.id === viewerUserId"
            @click="toggleSeller(user.id)"
          >
            <span
              class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-black"
              :class="isAssigned(user.id)
                ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                : 'border-[var(--dh-border)]'"
            >
              {{ isAssigned(user.id) ? '✓' : '' }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block break-words text-sm font-black text-[var(--dh-text)]">{{ user.displayName }}</span>
              <span class="mt-0.5 block break-all text-xs font-semibold text-[var(--dh-text-muted)]">{{ user.email }}</span>
              <span v-if="user.id === viewerUserId" class="mt-1 block text-[10px] font-black uppercase tracking-wide text-[var(--dh-primary)]">Siempre incluido</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
