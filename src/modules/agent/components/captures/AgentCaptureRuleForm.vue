<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'
import {
  AGENT_ENDPOINT_MATCH_TYPES,
  type AgentEndpointCaptureDto,
  type AgentEndpointMatchType,
  type SaveAgentEndpointCaptureRequest,
  type TestAgentEndpointCaptureResponse,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  profileId: string
  capture?: AgentEndpointCaptureDto | null
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const { t } = useI18n()
const toastStore = useToastStore()
const saving = ref(false)
const testing = ref(false)
const testResult = ref<TestAgentEndpointCaptureResponse | null>(null)

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ label: value, value }))
const matchTypeOptions = AGENT_ENDPOINT_MATCH_TYPES.map((value) => ({ label: value, value }))

const form = reactive({
  name: '',
  httpMethod: 'POST',
  urlPattern: '',
  matchType: 'Contains' as AgentEndpointMatchType,
  contentType: '',
  captureRequest: false,
  captureResponse: true,
  isRequired: true,
  timeoutSeconds: '90',
  isActive: true,
  sortOrder: '0',
})

const testForm = reactive({
  httpMethod: 'POST',
  url: '',
  contentType: '',
})

const canTest = computed(() => Boolean(props.capture?.id && testForm.url.trim()))

function reset() {
  form.name = props.capture?.name ?? ''
  form.httpMethod = props.capture?.httpMethod ?? 'POST'
  form.urlPattern = props.capture?.urlPattern ?? ''
  form.matchType = props.capture?.matchType ?? 'Contains'
  form.contentType = props.capture?.contentType ?? ''
  form.captureRequest = props.capture?.captureRequest ?? false
  form.captureResponse = props.capture?.captureResponse ?? true
  form.isRequired = props.capture?.isRequired ?? true
  form.timeoutSeconds = String(props.capture?.timeoutSeconds ?? 90)
  form.isActive = props.capture?.isActive ?? true
  form.sortOrder = String(props.capture?.sortOrder ?? 0)

  testForm.httpMethod = props.capture?.httpMethod ?? 'POST'
  testForm.url = ''
  testForm.contentType = props.capture?.contentType ?? ''
  testResult.value = null
}

async function save() {
  if (saving.value) return

  if (!form.name.trim()) {
    toastStore.warning(t('agent.review.capture'), t('agent.validation.required', { field: 'Nombre' }))
    return
  }

  if (!form.urlPattern.trim()) {
    toastStore.warning(t('agent.review.capture'), t('agent.validation.required', { field: 'URL Pattern' }))
    return
  }

  const timeoutSeconds = Number(form.timeoutSeconds)
  const sortOrder = Number(form.sortOrder)

  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) {
    toastStore.warning(t('agent.review.capture'), t('agent.validation.positive', { field: 'TimeoutSeconds' }))
    return
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    toastStore.warning(
      t('agent.review.capture'),
      t('agent.validation.nonNegativeInteger', { field: 'SortOrder' }),
    )
    return
  }

  const payload: SaveAgentEndpointCaptureRequest = {
    name: form.name.trim(),
    httpMethod: form.httpMethod,
    urlPattern: form.urlPattern.trim(),
    matchType: form.matchType,
    contentType: form.contentType.trim() || null,
    captureRequest: form.captureRequest,
    captureResponse: form.captureResponse,
    isRequired: form.isRequired,
    timeoutSeconds,
    isActive: form.isActive,
    sortOrder,
  }

  try {
    saving.value = true

    if (props.capture) {
      await AgentService.captures.update(props.profileId, props.capture.id, payload)
    } else {
      await AgentService.captures.create(props.profileId, payload)
    }

    toastStore.success(props.capture ? 'Regla de captura actualizada.' : 'Regla de captura creada.')
    emit('saved')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la regla de captura.')
  } finally {
    saving.value = false
  }
}

async function testRule() {
  if (!props.capture || !canTest.value || testing.value) return

  try {
    testing.value = true
    testResult.value = await AgentService.captures.test(props.profileId, props.capture.id, {
      httpMethod: testForm.httpMethod,
      url: testForm.url.trim(),
      contentType: testForm.contentType.trim() || null,
    })
  } catch (error) {
    testResult.value = null
    toastStore.backendError(error, 'No se pudo probar la regla.')
  } finally {
    testing.value = false
  }
}

watch(() => props.capture?.id, reset, { immediate: true })
</script>

<template>
  <form class="grid gap-6" @submit.prevent="save">
    <div class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="form.name" label="Nombre" :disabled="saving" />
      <DhSelect
        v-model="form.httpMethod"
        label="HTTP Method"
        :options="methodOptions"
        :disabled="saving"
      />
      <DhInput
        v-model="form.urlPattern"
        label="URL Pattern"
        placeholder="/v2/departures/offers"
        :disabled="saving"
      />
      <DhSelect
        v-model="form.matchType"
        label="Match Type"
        :options="matchTypeOptions"
        :disabled="saving"
      />
      <DhInput v-model="form.contentType" label="Content Type" :disabled="saving" />
      <DhInput
        v-model="form.timeoutSeconds"
        label="Timeout (segundos)"
        type="number"
        :disabled="saving"
      />
      <DhInput v-model="form.sortOrder" label="Orden" type="number" :disabled="saving" />
    </div>

    <div class="grid gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:grid-cols-2 lg:grid-cols-4">
      <DhCheckbox v-model="form.captureRequest" label="Capturar request" :disabled="saving" />
      <DhCheckbox v-model="form.captureResponse" label="Capturar response" :disabled="saving" />
      <DhCheckbox v-model="form.isRequired" label="Obligatoria" :disabled="saving" />
      <DhCheckbox v-model="form.isActive" label="Activa" :disabled="saving" />
    </div>

    <section
      v-if="capture"
      class="grid gap-4 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5"
    >
      <div>
        <h3 class="font-black text-[var(--dh-text)]">Probar regla</h3>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
          Prueba el endpoint real de matching del backend sin ejecutar una extracción.
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <DhSelect v-model="testForm.httpMethod" label="HTTP Method" :options="methodOptions" />
        <DhInput v-model="testForm.url" label="URL" placeholder="https://..." />
        <DhInput v-model="testForm.contentType" label="Content Type" />
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <DhButton
          label="Probar regla"
          variant="secondary"
          :loading="testing"
          :disabled="!canTest"
          @click.prevent="testRule"
        />

        <p
          v-if="testResult"
          class="rounded-full px-3 py-1.5 text-sm font-black"
          :class="testResult.matches
            ? 'bg-emerald-500/10 text-emerald-600'
            : 'bg-amber-500/10 text-amber-600'"
        >
          {{ testResult.matches ? 'Coincide ✓' : 'No coincide' }}
        </p>
      </div>
    </section>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <DhButton label="Cancelar" variant="secondary" :disabled="saving" @click.prevent="emit('cancel')" />
      <DhButton
        type="submit"
        :label="capture ? 'Guardar cambios' : 'Agregar regla'"
        :loading="saving"
      />
    </div>
  </form>
</template>
