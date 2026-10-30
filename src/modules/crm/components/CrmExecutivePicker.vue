<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { UsersService } from '@/core/services/usersService'
import type { UserDto } from '@/core/interfaces/users'

const props = defineProps<{ modelValue: string; label?: string }>()
// Pricing already represents the institutional seller with this sentinel.
// The CRM API never receives it as a user GUID: it receives assignToCastroFallas=true.
const CASTRO_FALLAS_SELLER = '__castro_fallas__'
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'eligibility': [value: boolean]
}>()
const query = ref('')
const users = ref<UserDto[]>([])
const loading = ref(false)
const error = ref('')
let requestVersion = 0

// User-role classification must come from Auth, not email suffixes or a name search.
// Castro Fallas is the only exceptional assignment and must match the exact account.
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    .replace(/\s+/g, ' ')
function isCastroFallasAccount(user: Pick<UserDto, 'userName' | 'displayName'>): boolean {
  return [user.userName, user.displayName].some(value => normalize(value ?? '') === 'castro fallas')
}
function isSellerRole(roleName: string): boolean {
  const role = normalize(roleName)
  return ['vendedor', 'vendedores', 'seller', 'sales', 'salesperson',
    'ejecutivo comercial', 'ejecutivo de ventas', 'sales executive'].includes(role)
}
const options = computed(() => users.value.map(user => ({
  value: user.id, label: user.displayName + (user.email ? ' · ' + user.email : ''),
})))
const selectedAllowed = computed(() =>
  props.modelValue === CASTRO_FALLAS_SELLER ||
  options.value.some(x => x.value === props.modelValue))
watch(selectedAllowed, eligible => emit('eligibility', eligible), { immediate: true })

async function searchUsers() {
  const request = ++requestVersion
  loading.value = true
  error.value = ''
  try {
    const list: UserDto[] = []
    // Respect Auth pagination. Never assume that its first 50 users are all sellers.
    for (let pageNumber = 1; pageNumber <= 20; pageNumber++) {
      const response = await UsersService.browsePaged({
        pageNumber, pageSize: 100, isActive: true, isLocked: false,
        search: query.value.trim() || undefined,
      })
      if (request !== requestVersion) return
      list.push(...response.items)
      if (response.items.length < 100) break
    }
    const active = [...new Map(list.filter(u => u.isActive && !u.isLocked)
      .map(u => [u.id, u])).values()]
    // The house seller is not an Auth user: show it independently and do not
    // accidentally attribute it to an employee with a similar company name.
    const sellers: UserDto[] = []
    const candidates = active.filter(u => !isCastroFallasAccount(u))
    // Role checks are deliberate and must fail closed, never show everyone on error.
    let index = 0
    const rejected: string[] = []
    await Promise.all(Array.from({ length: Math.min(8, candidates.length) }, async () => {
      while (index < candidates.length) {
        const user = candidates[index++]
        if (!user) continue
        try {
          const roles = await UsersService.getRoles(user.id)
          if (roles.some(role => isSellerRole(role.roleName))) sellers.push(user)
        } catch { rejected.push(user.id) }
      }
    }))
    if (request !== requestVersion) return
    users.value = sellers.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
    if (rejected.length) {
      error.value = 'No se pudieron verificar los roles de algunos usuarios. Solo se muestran ejecutivos confirmados.'
    }
    if (props.modelValue !== CASTRO_FALLAS_SELLER &&
        props.modelValue && !users.value.some(x => x.id === props.modelValue)) {
      emit('update:modelValue', '')
    }
  } catch {
    if (request !== requestVersion) return
    users.value = []
    if (props.modelValue !== CASTRO_FALLAS_SELLER) emit('update:modelValue', '')
    error.value = 'No se pudo consultar el personal comercial de Auth. Castro Fallas sigue disponible.'
  } finally { if (request === requestVersion) loading.value = false }
}
const showHouseSeller = computed(() => !query.value.trim() ||
  normalize('Castro Fallas').includes(normalize(query.value)))
void searchUsers()
</script>

<template>
  <section class="space-y-3" data-crm-sales-picker>
    <p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ label ?? 'Ejecutivo de ventas' }}</p>
    <div class="flex gap-2">
      <DhInput class="min-w-0 flex-1" :model-value="query" placeholder="Buscar vendedores"
        @update:model-value="query = $event" @keyup.enter.prevent="searchUsers" />
      <DhButton :icon="Search" label="Buscar" :loading="loading" variant="secondary" size="sm"
        @click="searchUsers" />
    </div>
    <div class="max-h-72 overflow-y-auto rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-1"
      role="radiogroup" aria-label="Vendedores y Castro Fallas">
      <label v-if="showHouseSeller"
        class="flex cursor-pointer items-center gap-3 rounded-lg border-b border-[var(--dh-border)] p-3 transition hover:bg-[var(--dh-shell)]"
        :class="modelValue === CASTRO_FALLAS_SELLER ? 'bg-[var(--dh-primary)]/10 ring-1 ring-[var(--dh-primary)]' : ''">
        <input type="radio" name="crm-sales-representative" :value="CASTRO_FALLAS_SELLER"
          :checked="modelValue === CASTRO_FALLAS_SELLER"
          @change="emit('update:modelValue', CASTRO_FALLAS_SELLER)" class="accent-[var(--dh-primary)]" />
        <span class="min-w-0 flex-1">
          <strong class="block text-sm">Castro Fallas</strong>
          <span class="block text-xs text-[var(--dh-text-muted)]">Vendedor institucional</span>
        </span>
      </label>
      <label v-for="person in users" :key="person.id"
        class="flex cursor-pointer items-center gap-3 rounded-lg p-3 transition hover:bg-[var(--dh-shell)]"
        :class="modelValue === person.id ? 'bg-[var(--dh-primary)]/10 ring-1 ring-[var(--dh-primary)]' : ''">
        <input type="radio" name="crm-sales-representative" :value="person.id" :checked="modelValue === person.id"
          @change="emit('update:modelValue', person.id)" class="accent-[var(--dh-primary)]" />
        <span class="min-w-0 flex-1">
          <strong class="block text-sm">{{ person.displayName }}</strong>
          <span class="block truncate text-xs text-[var(--dh-text-muted)]">{{ person.email }}</span>
        </span>
        <span v-if="isCastroFallasAccount(person)" class="text-xs font-bold text-[var(--dh-primary)]">Castro Fallas</span>
      </label>
      <p v-if="!users.length && !showHouseSeller" class="p-4 text-center text-xs text-[var(--dh-text-muted)]">
        {{ loading ? 'Consultando roles de ventas…' : 'No hay ejecutivos confirmados para esta búsqueda.' }}
      </p>
    </div>
    <p v-if="error" role="alert" class="text-xs text-amber-500">{{ error }}</p>

  </section>
</template>
