<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileText, Mail, Paperclip, X } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { EmailExtractionService } from '@/core/services/emailExtractionService'
import { parseStorageReference } from '@/core/services/storageService'
import { useToastStore } from '@/core/stores/toastStore'
import type { EmailAttachmentDto, EmailMessageDetailDto, PricingImportEmailSourceDto } from '@/core/interfaces/emailExtraction'
import StorageFileViewer from '@/modules/storage/components/StorageFileViewer.vue'

const props = defineProps<{ batchId: string }>()
const toastStore = useToastStore()
const loading = ref(true)
const source = ref<PricingImportEmailSourceDto | null>(null)
const message = ref<EmailMessageDetailDto | null>(null)
const viewer = ref<{ id: string; fileName: string; contentType?: string | null } | null>(null)

const bodyText = computed(() => {
  if (message.value?.bodyText?.trim()) return message.value.bodyText.trim()
  const html = message.value?.bodyHtml?.trim()
  if (!html) return 'El correo no contiene cuerpo de texto disponible.'
  const document = new DOMParser().parseFromString(html, 'text/html')
  return document.body.textContent?.replace(/\n{3,}/g, '\n\n').trim() || 'El correo no contiene cuerpo de texto disponible.'
})

function openStoredFile(storagePath: string | null | undefined, fileName: string, contentType?: string | null) {
  const id = parseStorageReference(storagePath)
  if (!id) {
    toastStore.warning('Archivo no disponible', 'La referencia del archivo original no corresponde a un archivo de Storage.')
    return
  }
  viewer.value = { id, fileName, contentType }
}

function openAttachment(attachment: EmailAttachmentDto) {
  openStoredFile(attachment.storagePath, attachment.fileName, attachment.contentType)
}

function openRawEmail() {
  if (!message.value?.rawEmailStoragePath) return
  openStoredFile(
    message.value.rawEmailStoragePath,
    `${message.value.subject || 'correo-original'}.eml`,
    'message/rfc822',
  )
}

async function load() {
  try {
    loading.value = true
    source.value = await EmailExtractionService.getPricingImportSource(props.batchId)
    message.value = await EmailExtractionService.getMessage(source.value.emailMessageId)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo recuperar el correo fuente de esta tarifa.')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="min-w-0 space-y-4">
    <div v-if="loading" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-8 text-center font-bold text-[var(--dh-text-muted)]">
      Cargando correo fuente…
    </div>

    <template v-else-if="source && message">
      <article class="min-w-0 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 sm:rounded-[22px] sm:p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">
              <Mail class="h-4 w-4" /> Asunto original
            </div>
            <h3 class="mt-2 break-words text-lg font-black text-[var(--dh-text)]">{{ message.subject }}</h3>
            <p class="mt-2 break-words text-xs font-semibold text-[var(--dh-text-muted)] sm:text-sm">
              De: {{ message.fromName ? `${message.fromName} · ` : '' }}{{ message.fromAddress }}
            </p>
            <p v-if="message.toAddresses" class="mt-1 break-words text-xs font-semibold text-[var(--dh-text-muted)]">Para: {{ message.toAddresses }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Recibido: {{ new Date(message.receivedAt).toLocaleString('es-CR') }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <DhBadge :label="source.sourceType" variant="primary" />
            <DhBadge v-if="source.originalFileName" :label="source.originalFileName" variant="neutral" />
          </div>
        </div>

        <div class="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-[18px] bg-black/[0.035] p-3 text-xs font-medium leading-5 sm:p-4 sm:text-sm sm:leading-6 text-[var(--dh-text)] dark:bg-white/[0.05]">
          {{ bodyText }}
        </div>
      </article>

      <article class="min-w-0 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 sm:rounded-[22px] sm:p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-black">Archivos originales</h3>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Revise el correo original y sus adjuntos sin salir de la tarifa.</p>
          </div>
          <DhButton v-if="message.rawEmailStoragePath" label="Ver correo original (.eml)" :icon="FileText" variant="secondary" size="sm" @click="openRawEmail" />
        </div>

        <div v-if="message.attachments.length" class="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">
          <button
            v-for="attachment in message.attachments"
            :key="attachment.id"
            type="button"
            class="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--dh-border)] p-3 text-left hover:bg-[var(--dh-card-hover)]"
            @click="openAttachment(attachment)"
          >
            <span class="flex min-w-0 items-center gap-2"><Paperclip class="h-4 w-4 shrink-0" /><span class="min-w-0 truncate text-xs font-black sm:text-sm">{{ attachment.fileName }}</span></span>
          </button>
        </div>
        <p v-else class="mt-4 text-sm font-semibold text-[var(--dh-text-muted)]">Este correo no tiene adjuntos registrados.</p>
      </article>

      <article v-if="viewer" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
        <div class="mb-3 flex items-center justify-between gap-3">
          <p class="min-w-0 truncate text-sm font-black">{{ viewer.fileName }}</p>
          <DhButton label="Cerrar archivo" :icon="X" variant="secondary" size="sm" @click="viewer = null" />
        </div>
        <StorageFileViewer :id="viewer.id" :file-name="viewer.fileName" :content-type="viewer.contentType" />
      </article>
    </template>

    <article v-else class="rounded-[22px] border border-amber-500/20 bg-amber-500/10 p-5">
      <p class="font-black">No se encontró el correo fuente.</p>
      <p class="mt-2 text-sm font-semibold opacity-80">La tarifa puede provenir de una importación histórica anterior a la trazabilidad por correo.</p>
    </article>
  </section>
</template>
