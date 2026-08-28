<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ExternalLink, FileText, Mail, Paperclip, X } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { EmailExtractionService } from '@/core/services/emailExtractionService'
import { parseStorageReference } from '@/core/services/storageService'
import { useToastStore } from '@/core/stores/toastStore'
import type { EmailAttachmentDto, EmailMessageDetailDto, PricingImportEmailSourceDto } from '@/core/interfaces/emailExtraction'
import StorageFileViewer from '@/modules/storage/components/StorageFileViewer.vue'

const route = useRoute()
const toastStore = useToastStore()
const loading = ref(true)
const source = ref<PricingImportEmailSourceDto | null>(null)
const message = ref<EmailMessageDetailDto | null>(null)
const viewer = ref<{ id: string; fileName: string; contentType?: string | null } | null>(null)

const batchId = computed(() => String(route.params.batchId ?? ''))
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

function closeWindow() {
  window.close()
}

async function load() {
  try {
    loading.value = true
    source.value = await EmailExtractionService.getPricingImportSource(batchId.value)
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
  <section class="space-y-5 p-1">
    <DhPageHeader
      title="Correo / fuente de la tarifa"
      subtitle="Trazabilidad de la información enviada desde Data Extraction a Pricing."
      :icon="Mail"
    >
      <template #actions>
        <DhButton label="Cerrar ventana" :icon="X" variant="secondary" @click="closeWindow" />
      </template>
    </DhPageHeader>

    <div v-if="loading" class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-8 text-center font-bold text-[var(--dh-text-muted)]">
      Cargando fuente…
    </div>

    <template v-else-if="source && message">
      <article class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Asunto original</p>
            <h2 class="mt-2 text-xl font-black text-[var(--dh-text)]">{{ message.subject }}</h2>
            <p class="mt-2 text-sm font-semibold text-[var(--dh-text-muted)]">
              De: {{ message.fromName ? `${message.fromName} · ` : '' }}{{ message.fromAddress }}
            </p>
            <p v-if="message.toAddresses" class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Para: {{ message.toAddresses }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Recibido: {{ new Date(message.receivedAt).toLocaleString('es-CR') }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <DhBadge :label="source.sourceType" variant="primary" />
            <DhBadge v-if="source.originalFileName" :label="source.originalFileName" variant="neutral" />
          </div>
        </div>

        <div class="mt-5 whitespace-pre-wrap rounded-[20px] bg-black/[0.035] p-4 text-sm font-medium leading-6 text-[var(--dh-text)] dark:bg-white/[0.05]">{{ bodyText }}</div>
      </article>

      <article class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-black">Archivos originales</h3>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Puede revisar el correo original y los PDF/archivos adjuntos sin abandonar la tarifa.</p>
          </div>
          <DhButton v-if="message.rawEmailStoragePath" label="Ver correo original (.eml)" :icon="FileText" variant="secondary" size="sm" @click="openRawEmail" />
        </div>

        <div v-if="message.attachments.length" class="mt-4 grid gap-2 md:grid-cols-2">
          <button
            v-for="attachment in message.attachments"
            :key="attachment.id"
            type="button"
            class="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--dh-border)] p-3 text-left hover:bg-[var(--dh-card-hover)]"
            @click="openAttachment(attachment)"
          >
            <span class="flex min-w-0 items-center gap-2"><Paperclip class="h-4 w-4 shrink-0" /><span class="truncate text-sm font-black">{{ attachment.fileName }}</span></span>
            <ExternalLink class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
          </button>
        </div>
        <p v-else class="mt-4 text-sm font-semibold text-[var(--dh-text-muted)]">Este correo no tiene adjuntos registrados.</p>
      </article>
    </template>

    <article v-else class="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-6">
      <p class="font-black">No se encontró el correo fuente.</p>
      <p class="mt-2 text-sm font-semibold opacity-80">La tarifa puede provenir de una importación histórica anterior a la trazabilidad por correo.</p>
    </article>

    <article v-if="viewer" class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="mb-3 flex justify-end">
        <DhButton label="Cerrar archivo" :icon="X" variant="secondary" size="sm" @click="viewer = null" />
      </div>
      <StorageFileViewer
        :id="viewer.id"
        :file-name="viewer.fileName"
        :content-type="viewer.contentType"
      />
    </article>
  </section>
</template>
