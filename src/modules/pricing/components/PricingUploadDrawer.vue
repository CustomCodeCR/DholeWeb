<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-vue-next'
import { DhButton, DhSelect } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { createCorrelationId } from '@/modules/pricing/utils/pricingFormat'
import type { ExtractImportRatesResultDto } from '@/core/interfaces/pricing'

const props = defineProps<{ onSaved?: () => void | Promise<void> }>()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const result = ref<ExtractImportRatesResultDto | null>(null)
const form = reactive({ profileId: '', submitted: false, saving: false, dragging: false })

const selectedProfile = computed(() =>
  catalogs.findById(catalogs.importProfiles.value, form.profileId),
)

function chooseFile(files: FileList | null) {
  file.value = files?.[0] ?? null
  result.value = null
}

function drop(event: DragEvent) {
  form.dragging = false
  chooseFile(event.dataTransfer?.files ?? null)
}

async function submit() {
  form.submitted = true
  if (!file.value || !selectedProfile.value) return

  try {
    form.saving = true
    result.value = await PricingService.extractImportRates(
      file.value,
      selectedProfile.value.slug,
      createCorrelationId(),
    )
    toastStore.success(
      'Archivo procesado',
      `${result.value.createdRows} tarifas importadas fueron creadas.`,
    )
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo extraer el tarifario.')
  } finally {
    form.saving = false
  }
}

onMounted(catalogs.loadAll)
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <DhSelect
        v-model="form.profileId"
        label="Perfil de importación"
        placeholder="Seleccione el formato del proveedor"
        :options="catalogs.profileOptions.value"
        :error="form.submitted && !form.profileId ? 'Seleccione un perfil.' : undefined"
      />

      <button
        type="button"
        class="mt-5 flex min-h-64 w-full flex-col items-center justify-center rounded-[28px] border-2 border-dashed p-8 text-center transition"
        :class="
          form.dragging
            ? 'border-[var(--dh-primary)] dh-bg-primary-soft'
            : 'border-[var(--dh-border-strong)] hover:border-[var(--dh-primary)] hover:bg-[var(--dh-card-hover)]'
        "
        @click="fileInput?.click()"
        @dragover.prevent="form.dragging = true"
        @dragleave.prevent="form.dragging = false"
        @drop.prevent="drop"
      >
        <input
          ref="fileInput"
          class="hidden"
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,image/*"
          @change="chooseFile(($event.target as HTMLInputElement).files)"
        />
        <div
          class="flex h-16 w-16 items-center justify-center rounded-[24px] dh-bg-primary-soft text-[var(--dh-primary)]"
        >
          <FileSpreadsheet v-if="file" class="h-7 w-7" />
          <UploadCloud v-else class="h-7 w-7" />
        </div>
        <p class="mt-4 text-base font-black text-[var(--dh-text)]">
          {{ file?.name ?? 'Arrastre o seleccione el tarifario' }}
        </p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          PDF, Excel, CSV o imagen. El archivo se valida antes de crear registros.
        </p>
        <p
          v-if="file"
          class="mt-3 rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-[var(--dh-text-soft)] dark:bg-white/10"
        >
          {{ (file.size / 1024 / 1024).toFixed(2) }} MB
        </p>
      </button>
      <p v-if="form.submitted && !file" class="mt-2 text-xs font-semibold text-red-500">
        Seleccione un archivo.
      </p>
    </section>

    <section
      v-if="result"
      class="rounded-[26px] border p-5"
      :class="
        result.hasIssues
          ? 'border-amber-500/20 bg-amber-500/10'
          : 'border-emerald-500/20 bg-emerald-500/10'
      "
    >
      <div class="flex items-start gap-3">
        <AlertTriangle v-if="result.hasIssues" class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <CheckCircle2 v-else class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div class="flex-1">
          <h3 class="font-black text-[var(--dh-text)]">Resultado de la extracción</h3>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Filas</p>
              <p class="text-lg font-black">{{ result.totalRows }}</p>
            </div>
            <div>
              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Creadas</p>
              <p class="text-lg font-black text-emerald-600">{{ result.createdRows }}</p>
            </div>
            <div>
              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Advertencias</p>
              <p class="text-lg font-black text-amber-600">{{ result.warningRows }}</p>
            </div>
            <div>
              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Inválidas</p>
              <p class="text-lg font-black text-red-500">{{ result.invalidRows }}</p>
            </div>
          </div>
          <div
            v-if="result.issues.length"
            class="mt-4 max-h-48 space-y-2 overflow-y-auto dh-scrollbar"
          >
            <div
              v-for="(issue, index) in result.issues"
              :key="`${issue.code}-${index}`"
              class="rounded-2xl bg-[var(--dh-card)] px-3 py-2 text-xs font-semibold text-[var(--dh-text-soft)]"
            >
              <span class="font-black">{{ issue.code }}</span> · {{ issue.message }}
              <span v-if="issue.sourceRowNumber" class="text-[var(--dh-text-muted)]">
                (fila {{ issue.sourceRowNumber }})</span
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="flex justify-end gap-2">
      <DhButton
        :label="result ? 'Cerrar' : 'Cancelar'"
        variant="secondary"
        :disabled="form.saving"
        @click="drawerStore.close()"
      />
      <DhButton
        v-if="!result"
        label="Extraer tarifas"
        :icon="UploadCloud"
        :loading="form.saving"
        @click="submit"
      />
    </div>
  </div>
</template>
