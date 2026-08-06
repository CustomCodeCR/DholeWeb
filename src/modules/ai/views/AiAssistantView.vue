<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  Bot,
  Download,
  Eraser,
  FileSpreadsheet,
  Paperclip,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhEmptyState } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { AiService } from '@/core/services/aiService'
import { useToastStore } from '@/core/stores/toastStore'
import type { AiGeneratedFileDto, AiMessageRequest } from '@/core/interfaces/ai'
import { buildAiChatHistory } from '@/core/utils/aiChatHistory'
import { downloadAiGeneratedFile, formatAiFileSize } from '@/core/utils/aiGeneratedFile'
import { createUuid } from '@/core/utils/id'

interface ChatMessage extends AiMessageRequest {
  id: string
  modelName?: string
  tokenCount?: number
  attachmentName?: string
  generatedFile?: AiGeneratedFileDto
}

const PROFILE_KEY = 'assistant'
const STORAGE_KEY = 'dhole.ai.assistant.messages'
const MAXIMUM_FILE_BYTES = 25 * 1024 * 1024
const toastStore = useToastStore()
const messages = ref<ChatMessage[]>([])
const prompt = ref('')
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const sending = ref(false)
const conversation = ref<HTMLElement | null>(null)

const canSend = computed(() => Boolean(prompt.value.trim() && !sending.value))

function persist() {
  const persisted = messages.value.slice(-60).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    modelName: message.modelName,
    tokenCount: message.tokenCount,
    attachmentName: message.attachmentName,
  }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
}

function restore() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (Array.isArray(stored)) messages.value = stored
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
}

async function scrollToBottom() {
  await nextTick()
  conversation.value?.scrollTo({ top: conversation.value.scrollHeight, behavior: 'smooth' })
}

function openFilePicker() {
  if (!sending.value) fileInput.value?.click()
}

function clearSelectedFile() {
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !['csv', 'xlsx'].includes(extension)) {
    toastStore.warning('Archivo no compatible', 'Solo puede adjuntar archivos CSV o XLSX.')
    clearSelectedFile()
    return
  }

  if (file.size > MAXIMUM_FILE_BYTES) {
    toastStore.warning('Archivo demasiado grande', 'El tamaño máximo permitido es de 25 MB.')
    clearSelectedFile()
    return
  }

  selectedFile.value = file
}

async function sendMessage() {
  const content = prompt.value.trim()
  if (!canSend.value || !content) return

  const file = selectedFile.value
  const previousHistory = buildAiChatHistory(messages.value)

  messages.value.push({
    id: createUuid(),
    role: 'user',
    content,
    attachmentName: file?.name,
  })
  prompt.value = ''
  clearSelectedFile()
  persist()
  await scrollToBottom()

  try {
    sending.value = true

    if (file) {
      const result = await AiService.executeFileChat({
        profileKey: PROFILE_KEY,
        prompt: content,
        file,
        messages: previousHistory,
        correlationId: createUuid(),
      })

      messages.value.push({
        id: result.chat.executionId,
        role: 'assistant',
        content: result.chat.content,
        modelName: result.chat.modelName,
        tokenCount: result.chat.tokenUsage.totalTokens,
        generatedFile: result.generatedFile ?? undefined,
      })

      if (result.sourceWasTruncated) {
        toastStore.warning(
          'Archivo parcialmente analizado',
          'El archivo superó el límite de filas configurado y se procesó una muestra.',
        )
      }
    } else {
      const history = buildAiChatHistory(messages.value)
      const result = await AiService.executeChat({
        profileKey: PROFILE_KEY,
        messages: history,
        correlationId: createUuid(),
      })

      messages.value.push({
        id: result.executionId,
        role: 'assistant',
        content: result.content,
        modelName: result.modelName,
        tokenCount: result.tokenUsage.totalTokens,
      })
    }

    persist()
  } catch (error) {
    toastStore.backendError(error, 'El asistente no pudo procesar la consulta o el archivo.')
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

function clearConversation() {
  messages.value = []
  clearSelectedFile()
  localStorage.removeItem(STORAGE_KEY)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void sendMessage()
  }
}

onMounted(async () => {
  restore()
  await scrollToBottom()
})
</script>

<template>
  <section class="flex min-h-[calc(100vh-10rem)] flex-col gap-5 pb-5">
    <DhPageHeader
      title="Asistente de IA"
      subtitle="Analice consultas o adjunte archivos CSV y XLSX para transformar, resumir o exportar datos."
      :icon="Bot"
    >
      <template #actions>
        <DhButton
          label="Limpiar conversación"
          :icon="Eraser"
          variant="secondary"
          @click="clearConversation"
        />
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px]">
      <header class="flex items-center gap-3 border-b border-[var(--dh-border)] p-4">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-2xl dh-bg-primary-soft text-[var(--dh-primary)]"
        >
          <Sparkles class="h-4 w-4" />
        </div>
        <div>
          <h2 class="font-black text-[var(--dh-text)]">Conversación</h2>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
            Perfil activo: assistant · CSV/XLSX hasta 25 MB
          </p>
        </div>
      </header>

      <div ref="conversation" class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        <DhEmptyState
          v-if="messages.length === 0"
          title="Inicie una conversación"
          description="Escriba una consulta o adjunte una hoja de cálculo para analizarla y generar un nuevo archivo."
          :icon="Bot"
        />

        <article
          v-for="message in messages"
          :key="message.id"
          class="flex gap-3"
          :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            v-if="message.role === 'assistant'"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl dh-bg-primary-soft text-[var(--dh-primary)]"
          >
            <Bot class="h-4 w-4" />
          </div>
          <div
            class="max-w-[86%] rounded-[24px] px-4 py-3 md:max-w-[74%]"
            :class="
              message.role === 'user'
                ? 'bg-[var(--dh-primary)] text-white'
                : 'border border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text)]'
            "
          >
            <div
              v-if="message.attachmentName"
              class="mb-3 flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold"
            >
              <FileSpreadsheet class="h-4 w-4 shrink-0" />
              <span class="truncate">{{ message.attachmentName }}</span>
            </div>

            <p class="whitespace-pre-wrap break-words text-sm font-semibold leading-6">
              {{ message.content }}
            </p>

            <button
              v-if="message.generatedFile"
              type="button"
              class="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-left transition hover:bg-[var(--dh-card-hover)]"
              @click="downloadAiGeneratedFile(message.generatedFile)"
            >
              <span class="flex min-w-0 items-center gap-3">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl dh-bg-primary-soft text-[var(--dh-primary)]"
                >
                  <FileSpreadsheet class="h-5 w-5" />
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-black">{{ message.generatedFile.fileName }}</span>
                  <span class="block text-xs font-semibold text-[var(--dh-text-muted)]">
                    {{ formatAiFileSize(message.generatedFile.sizeBytes) }}
                  </span>
                </span>
              </span>
              <Download class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
            </button>

            <div
              v-if="message.role === 'assistant' && message.modelName"
              class="mt-3 flex flex-wrap gap-2"
            >
              <DhBadge :label="message.modelName" variant="neutral" />
              <DhBadge
                v-if="message.tokenCount != null"
                :label="`${message.tokenCount} tokens`"
                variant="neutral"
              />
            </div>
          </div>
          <div
            v-if="message.role === 'user'"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-white"
          >
            <UserRound class="h-4 w-4" />
          </div>
        </article>

        <div
          v-if="sending"
          class="flex items-center gap-3 text-sm font-bold text-[var(--dh-text-muted)]"
        >
          <div
            class="flex h-9 w-9 items-center justify-center rounded-2xl dh-bg-primary-soft text-[var(--dh-primary)]"
          >
            <Bot class="h-4 w-4" />
          </div>
          Analizando la consulta y los datos...
        </div>
      </div>

      <footer class="border-t border-[var(--dh-border)] p-4">
        <input
          ref="fileInput"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="hidden"
          @change="selectFile"
        />

        <div
          v-if="selectedFile"
          class="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2"
        >
          <span class="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--dh-text)]">
            <FileSpreadsheet class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
            <span class="truncate">{{ selectedFile.name }}</span>
            <span class="shrink-0 text-xs text-[var(--dh-text-muted)]">
              {{ formatAiFileSize(selectedFile.size) }}
            </span>
          </span>
          <button
            type="button"
            class="rounded-xl p-1.5 text-[var(--dh-text-muted)] hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]"
            title="Quitar archivo"
            @click="clearSelectedFile"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <div
          class="flex items-end gap-3 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 focus-within:border-[var(--dh-primary)]"
        >
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-muted)] transition hover:text-[var(--dh-primary)] disabled:opacity-40"
            title="Adjuntar CSV o XLSX"
            :disabled="sending"
            @click="openFilePicker"
          >
            <Paperclip class="h-4 w-4" />
          </button>

          <textarea
            v-model="prompt"
            rows="2"
            class="max-h-48 min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-muted)]"
            placeholder="Ejemplo: extraiga las tarifas y devuélvalas en un XLSX con columnas normalizadas"
            :disabled="sending"
            @keydown="handleKeydown"
          />
          <DhButton
            label="Enviar"
            :icon="Send"
            :disabled="!canSend"
            :loading="sending"
            @click="sendMessage"
          />
        </div>
      </footer>
    </section>
  </section>
</template>
