<script setup lang="ts">
import { computed, ref } from 'vue'
import { DhButton, DhInput, DhTextarea } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { AiService } from '@/core/services/aiService'
import type { AiPromptTemplateDto } from '@/core/interfaces/ai'

const props = defineProps<{
  template?: AiPromptTemplateDto
  onSaved?: () => Promise<void> | void
}>()

const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const loading = ref(false)

const form = ref({
  key: props.template?.key ?? '',
  name: props.template?.name ?? '',
  description: props.template?.description ?? '',
  systemPrompt: props.template?.systemPrompt ?? '',
  userPromptTemplate: props.template?.userPromptTemplate ?? '',
  variables: props.template?.variables.join(', ') ?? '',
})

const isEdit = computed(() => Boolean(props.template))

function normalizeVariables(value: string) {
  return [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))]
}

async function save() {
  if (!form.value.key.trim() || !form.value.name.trim()) {
    toastStore.warning('Datos incompletos', 'Key y nombre son obligatorios.')
    return
  }

  try {
    loading.value = true
    const payload = {
      key: form.value.key.trim(),
      name: form.value.name.trim(),
      description: form.value.description.trim() || null,
      systemPrompt: form.value.systemPrompt.trim() || null,
      userPromptTemplate: form.value.userPromptTemplate.trim() || null,
      variables: normalizeVariables(form.value.variables),
    }

    if (props.template) await AiService.updatePromptTemplate(props.template.id, payload)
    else await AiService.createPromptTemplate(payload)

    toastStore.success('Plantilla guardada', 'Ya puede asociarla a uno o varios perfiles de IA.')
    await props.onSaved?.()
    drawerStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la plantilla de prompt.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="form.key" label="Key" placeholder="pricing.rate-summary" />
      <DhInput v-model="form.name" label="Nombre" placeholder="Resumen de tarifa" />
      <DhInput
        v-model="form.description"
        label="Descripción"
        placeholder="Uso esperado de esta plantilla"
        class="md:col-span-2"
      />
    </div>

    <DhTextarea
      v-model="form.systemPrompt"
      label="System prompt"
      :rows="7"
      placeholder="Eres un asistente especializado en..."
    />
    <DhTextarea
      v-model="form.userPromptTemplate"
      label="Plantilla del usuario"
      :rows="9"
      placeholder="Analiza la tarifa {{rateJson}} y devuelve..."
    />
    <DhTextarea
      v-model="form.variables"
      label="Variables"
      :rows="3"
      placeholder="rateJson, language, customerName"
    />

    <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-xs font-semibold text-[var(--dh-text-muted)]">
      Use variables con formato <code class="font-black text-[var(--dh-primary)]" v-text="'{{variable}}'" />. Sepárelas por coma o por línea.
    </div>

    <div class="flex justify-end gap-2">
      <DhButton label="Cancelar" variant="secondary" @click="drawerStore.close()" />
      <DhButton type="submit" :label="isEdit ? 'Guardar cambios' : 'Crear plantilla'" :loading="loading" />
    </div>
  </form>
</template>
