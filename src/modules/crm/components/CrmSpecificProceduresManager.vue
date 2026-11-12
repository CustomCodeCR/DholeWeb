<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/core/stores/authStore'
import { ChevronDown, ClipboardList, Pencil, Plus, RefreshCw, Search, Trash2, UsersRound, X } from 'lucide-vue-next'
import { crmError, crmPath, crmRequest } from '../services/crmApi'
import { StorageService } from '@/core/services/storageService'
import CrmDocumentsPanel from './CrmDocumentsPanel.vue'
import CrmFileDropzone from './CrmFileDropzone.vue'
import { useCrmDraftAutosave } from '../utils/crmDraftAutosave'

type Procedure = {
  id: string
  accountId: string
  name: string
  detail: string | null
  assignedTeam: string | null
  rowVersion: number
  updatedAt: string
}
const props = defineProps<{ accountId: string }>()
const auth = useAuthStore()
const canEdit = computed(() => auth.hasScope('crm.account.update'))
const procedures = ref<Procedure[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const search = ref('')
const expandedId = ref<string | null>(null)
const deleteCandidate = ref<string | null>(null)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const draft = reactive({ name: '', detail: '', assignedTeam: '' })
function captureProcedure() { return { fields: { ...draft } } }
const procedureAutosave = useCrmDraftAutosave({
  scope: () => 'procedure:' + props.accountId + ':' + (editingId.value || 'new'),
  enabled: () => isEditing.value,
  capture: captureProcedure,
  apply: (snapshot: ReturnType<typeof captureProcedure>) => { Object.assign(draft, snapshot.fields) },
})
const pendingDocuments = ref<File[]>([])
const canAttach = computed(() => canEdit.value && auth.hasScope('storage.files.create'))

const endpoint = () => crmPath('accounts', props.accountId, 'specific-procedures')
const shown = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return !term ? procedures.value : procedures.value.filter(item =>
    [item.name, item.detail, item.assignedTeam].some(value =>
      (value ?? '').toLocaleLowerCase().includes(term)))
})

async function load() {
  if (!props.accountId) return
  const requestedId = props.accountId
  loading.value = true
  error.value = ''
  try {
    const result = await crmRequest<Procedure[]>(endpoint())
    if (props.accountId === requestedId) procedures.value = result
  } catch (cause) {
    if (props.accountId === requestedId) error.value = crmError(cause)
  } finally {
    if (props.accountId === requestedId) loading.value = false
  }
}
watch(() => props.accountId, () => {
  procedures.value = []
  expandedId.value = null
  closeEditor()
  void load()
}, { immediate: true })

function closeEditor() {
  procedureAutosave.stop()
  isEditing.value = false
  editingId.value = null
  draft.name = ''
  draft.detail = ''
  draft.assignedTeam = ''
  pendingDocuments.value = []
}
function newProcedure() {
  closeEditor()
  error.value = ''
  success.value = ''
  isEditing.value = true
  procedureAutosave.begin()
}
function editProcedure(item: Procedure) {
  procedureAutosave.stop()
  editingId.value = item.id
  draft.name = item.name
  draft.detail = item.detail ?? ''
  draft.assignedTeam = item.assignedTeam ?? ''
  error.value = ''
  success.value = ''
  isEditing.value = true
  procedureAutosave.begin()
}
async function save() {
  if (saving.value) return
  if (pendingDocuments.value.length && !canAttach.value) {
    error.value = 'Necesitás permisos de Storage para adjuntar documentos.'
    return
  }
  const name = draft.name.trim()
  if (!name) { error.value = 'El nombre del procedimiento es obligatorio.'; return }
  if (name.length > 160 || draft.detail.trim().length > 8000 || draft.assignedTeam.trim().length > 500) {
    error.value = 'Verifique la longitud del nombre, detalle o equipo asignado.'
    return
  }
  const previous = procedures.value.find(item => item.id === editingId.value)
  if (editingId.value && !previous) {
    error.value = 'Este procedimiento cambió. Actualice la lista.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const url = editingId.value ? endpoint() + '/' + encodeURIComponent(editingId.value) : endpoint()
    const result = await crmRequest<Procedure>(url, editingId.value ? 'PUT' : 'POST', {
      name, detail: draft.detail.trim() || null, assignedTeam: draft.assignedTeam.trim() || null,
      expectedVersion: previous?.rowVersion ?? null,
    })
    // Remember a successful creation before attempting Storage uploads.
    // A failed attachment must never cause a second procedure on retry.
    procedureAutosave.commit()
    editingId.value = result.id
    procedures.value = [result, ...procedures.value.filter(item => item.id !== result.id)]
    success.value = 'Procedimiento guardado correctamente.'
    expandedId.value = result.id
    if (pendingDocuments.value.length) {
      const access = await crmRequest<{ canUpload: boolean }>(
        crmPath('documents/procedure', result.id, 'access'))
      if (!access.canUpload) throw new Error('No tenés permiso para adjuntar archivos a este procedimiento.')
      const failed: File[] = []
      for (const file of pendingDocuments.value) {
        try {
          await StorageService.uploadFile({
            file, sourceService: 'DholeCRMService', entityType: 'crm.procedure',
            entityId: result.id,
          })
        } catch (cause) {
          failed.push(file)
        }
      }
      pendingDocuments.value = failed
      if (failed.length) {
        await load()
        error.value = failed.length + ' archivo(s) no se pudieron subir. El procedimiento ya se guardó; podés reintentar sin duplicarlo.'
        return
      }
    }
    closeEditor()
    success.value = 'Procedimiento guardado correctamente.'
    await load()
  } catch (cause) {
    error.value = crmError(cause)
  } finally {
    saving.value = false
  }
}
async function remove(item: Procedure) {
  if (saving.value) return
  if (deleteCandidate.value !== item.id) {
    deleteCandidate.value = item.id
    return
  }
  saving.value = true
  error.value = ''
  try {
    await crmRequest(
      endpoint() + '/' + encodeURIComponent(item.id) + '?expectedVersion=' + encodeURIComponent(String(item.rowVersion)),
      'DELETE')
    deleteCandidate.value = null
    if (expandedId.value === item.id) expandedId.value = null
    success.value = 'Procedimiento eliminado.'
    await load()
  } catch (cause) {
    error.value = crmError(cause)
  } finally {
    saving.value = false
  }
}
function teamLabels(value: string | null): string[] {
  return (value ?? '').split(',').map(part => part.trim()).filter(Boolean)
}
</script>

<template>
  <section class="space-y-4" aria-label="Procedimientos específicos de la cuenta">
    <div class="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="flex items-start gap-3">
        <div class="rounded-xl bg-[var(--dh-primary-light)] p-2.5 text-[var(--dh-primary)]">
          <ClipboardList class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-base font-extrabold text-[var(--dh-text)]">Procedimientos específicos</h2>
          <p class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">
            Instrucciones particulares de esta cuenta, organizadas por procedimiento y equipo responsable.
          </p>
          <p class="mt-2 text-xs font-bold text-[var(--dh-text-muted)]">
            {{ procedures.length }} {{ procedures.length === 1 ? 'procedimiento registrado' : 'procedimientos registrados' }}
          </p>
        </div>
      </div>
      <button v-if="canEdit" type="button" class="inline-flex items-center gap-2 rounded-xl bg-[var(--dh-primary)] px-4 py-2.5 text-xs font-extrabold text-white hover:opacity-90"
        @click="newProcedure">
        <Plus class="h-4 w-4" /> Nuevo procedimiento
      </button>
    </div>

    <p v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="text-xs font-semibold text-emerald-500">{{ success }}</p>

    <form v-if="isEditing && canEdit" class="space-y-4 rounded-2xl border border-[var(--dh-primary)]/50 bg-[var(--dh-card)] p-5"

      @submit.prevent="save">
      <p v-if="procedureAutosave.status.value !== 'idle'" role="status" class="text-xs text-[var(--dh-text-muted)]">{{ procedureAutosave.status.value === 'restored' ? 'Procedimiento recuperado.' : procedureAutosave.status.value === 'saved' ? 'Borrador del procedimiento guardado.' : 'No se pudo guardar el borrador local.' }}</p>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-extrabold">{{ editingId ? 'Editar procedimiento' : 'Nuevo procedimiento específico' }}</h3>
        <button type="button" aria-label="Cerrar formulario" class="rounded-lg p-1 text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]" @click="closeEditor">
          <X class="h-4 w-4" />
        </button>
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <label class="space-y-1.5 text-xs font-semibold text-[var(--dh-text)]">
          <span>Nombre del procedimiento <span class="text-red-500">*</span></span>
          <input v-model="draft.name" maxlength="160" required autofocus
            placeholder="Ej. Instrucciones para retiro de carga"
            class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 py-2.5 text-sm text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]" />
        </label>
        <label class="space-y-1.5 text-xs font-semibold text-[var(--dh-text)]">
          <span>Equipo asignado</span>
          <input v-model="draft.assignedTeam" maxlength="500"
            placeholder="Ej. Operaciones, Aduanas, Transporte"
            class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 py-2.5 text-sm text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]" />
          <span class="block text-[11px] font-normal text-[var(--dh-text-muted)]">Puede indicar varios equipos separados por comas.</span>
        </label>
      </div>
      <label class="block space-y-1.5 text-xs font-semibold text-[var(--dh-text)]">
        <span>Detalle del procedimiento</span>
        <textarea v-model="draft.detail" maxlength="8000" rows="7"
          placeholder="Describa instrucciones, responsables, excepciones y pasos a seguir..."
          class="min-h-40 w-full resize-y rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 py-3 text-sm leading-relaxed text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]" />
      </label>
      <div class="space-y-2 rounded-xl border border-[var(--dh-border)] p-3">
        <CrmFileDropzone v-model="pendingDocuments" :disabled="saving || !canAttach"
          label="Documentos del procedimiento" />
        <p class="text-[11px] text-[var(--dh-text-muted)]">
          {{ canAttach
            ? 'Los documentos se subirán al guardar el procedimiento. Podés adjuntar todos los que necesités.'
            : 'Se requieren permisos de edición y storage.files.create para adjuntar archivos.' }}
        </p>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="rounded-xl border border-[var(--dh-border)] px-4 py-2.5 text-xs font-bold" @click="closeEditor">Cancelar</button>
        <button type="submit" :disabled="saving || !draft.name.trim()" class="rounded-xl bg-[var(--dh-primary)] px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">
          {{ saving ? 'Guardando...' : 'Guardar procedimiento' }}
        </button>
      </div>
    </form>

    <div v-if="procedures.length > 0" class="flex flex-wrap items-center justify-between gap-2">
      <label class="relative block w-full max-w-sm">
        <Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--dh-text-muted)]" />
        <input v-model="search" type="search" placeholder="Buscar por nombre, detalle o equipo..."
          class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] py-2.5 pl-9 pr-3 text-xs text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]" />
      </label>
      <span class="text-xs text-[var(--dh-text-muted)]">Mostrando {{ shown.length }} de {{ procedures.length }}</span>
    </div>

    <p v-if="loading" role="status" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-8 text-center text-sm text-[var(--dh-text-muted)]">
      Cargando procedimientos...
    </p>
    <div v-else-if="!procedures.length && !error" class="rounded-2xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-12 text-center">
      <ClipboardList class="mx-auto h-9 w-9 text-[var(--dh-text-muted)]" />
      <p class="mt-3 text-sm font-extrabold">Aún no hay procedimientos específicos</p>
      <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Agregue tantas instrucciones particulares como necesite esta cuenta.</p>
      <button v-if="canEdit" type="button" class="mt-4 text-xs font-extrabold text-[var(--dh-primary)]" @click="newProcedure">Crear primer procedimiento</button>
    </div>
    <p v-else-if="!shown.length" class="rounded-xl border border-[var(--dh-border)] p-6 text-center text-sm text-[var(--dh-text-muted)]">
      No hay procedimientos que coincidan con la búsqueda.
    </p>
    <div v-else class="grid items-start gap-3 lg:grid-cols-2">
      <article v-for="procedure in shown" :key="procedure.id"
        class="min-w-0 overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-sm">
        <button type="button" class="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-[var(--dh-primary-light)]"
          :aria-expanded="expandedId === procedure.id"
          @click="expandedId = expandedId === procedure.id ? null : procedure.id; deleteCandidate = null">
          <div class="flex min-w-0 items-start gap-3">
            <div class="shrink-0 rounded-lg border border-[var(--dh-border)] p-2 text-[var(--dh-primary)]">
              <ClipboardList class="h-4 w-4" />
            </div>
            <div class="min-w-0 space-y-1">
              <h3 class="break-words text-sm font-extrabold text-[var(--dh-text)]">{{ procedure.name }}</h3>
              <p class="line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-[var(--dh-text-muted)]">
                {{ procedure.detail || 'Sin detalle registrado.' }}
              </p>
              <p v-if="procedure.assignedTeam" class="flex items-center gap-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">
                <UsersRound class="h-3 w-3" />{{ procedure.assignedTeam }}
              </p>
            </div>
          </div>
          <ChevronDown class="mt-1 h-4 w-4 shrink-0 text-[var(--dh-text-muted)] transition-transform" :class="{ 'rotate-180': expandedId === procedure.id }" />
        </button>
        <div v-if="expandedId === procedure.id" class="space-y-4 border-t border-[var(--dh-border)] px-4 py-4">
          <div>
            <h4 class="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--dh-text-muted)]">Detalle</h4>
            <p class="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--dh-text)]">{{ procedure.detail || 'Sin detalle registrado.' }}</p>
          </div>
          <div>
            <h4 class="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--dh-text-muted)]">Equipo asignado</h4>
            <div v-if="teamLabels(procedure.assignedTeam).length" class="flex flex-wrap gap-1.5">
              <span v-for="team in teamLabels(procedure.assignedTeam)" :key="team"
                class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 py-1 text-xs font-semibold">
                {{ team }}
              </span>
            </div>
            <p v-else class="text-xs text-[var(--dh-text-muted)]">Sin equipo asignado.</p>
          </div>
          <CrmDocumentsPanel kind="procedure" :record-id="procedure.id" />
          <div v-if="canEdit" class="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--dh-border)] pt-3">
            <button type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-bold"
              @click="editProcedure(procedure)"><Pencil class="h-3.5 w-3.5" />Editar</button>
            <button type="button" :disabled="saving" class="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-500 disabled:opacity-50"
              @click="remove(procedure)">
              <Trash2 class="h-3.5 w-3.5" />{{ deleteCandidate === procedure.id ? 'Confirmar eliminación' : 'Eliminar' }}
            </button>
            <button v-if="deleteCandidate === procedure.id" type="button" class="text-xs text-[var(--dh-text-muted)]"
              @click="deleteCandidate = null">Cancelar</button>
          </div>
        </div>
      </article>
    </div>
    <button v-if="!loading && procedures.length" type="button"
      class="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--dh-text-muted)] hover:text-[var(--dh-primary)]"
      @click="load"><RefreshCw class="h-3.5 w-3.5" />Actualizar procedimientos</button>
  </section>
</template>
