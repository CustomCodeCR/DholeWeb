<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { UsersService } from '@/core/services/usersService'
import type { UserDto } from '@/core/interfaces/users'

const props = defineProps<{ modelValue: string; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const query = ref('')
const users = ref<UserDto[]>([])
const loading = ref(false)
const error = ref('')
const options = computed(() => {
  const list = users.value.filter(u => u.isActive && !u.isLocked)
    .map(u => ({value: u.id, label: u.displayName + ' · ' + u.email}))
  if (props.modelValue && !list.some(u => u.value === props.modelValue))
    list.unshift({value: props.modelValue, label: 'Ejecutivo actual'})
  return list
})
async function searchUsers() {
  loading.value = true
  error.value = ''
  try {
    const result = await UsersService.browsePaged({
      pageNumber: 1, pageSize: 50,
      isActive: true, isLocked: false,
      search: query.value.trim() || undefined,
    })
    users.value = result.items
  } catch {
    error.value = 'No se pudo consultar los usuarios autorizados de Auth.'
    users.value = []
  } finally { loading.value = false }
}
watch(() => props.modelValue, () => { /* preserve selection across searches */ })
void searchUsers()
</script>

<template>
  <section class="space-y-2">
    <p class="text-xs font-black uppercase tracking-[.12em] text-[var(--dh-text-muted)]">{{ label ?? 'Ejecutivo asignado' }}</p>
    <div class="flex items-end gap-2">
      <DhInput class="min-w-0 flex-1" :model-value="query" placeholder="Buscar ejecutivo"
        @update:model-value="query = $event" @keyup.enter.prevent="searchUsers" />
      <DhButton :icon="Search" label="Buscar" :loading="loading" variant="secondary" size="sm" @click="searchUsers" />
    </div>
    <DhSelect :model-value="modelValue" :options="options" placeholder=""
      @update:model-value="emit('update:modelValue', String($event))" />
    <p v-if="error" role="alert" class="text-xs text-red-500">{{ error }}</p>
  </section>
</template>
