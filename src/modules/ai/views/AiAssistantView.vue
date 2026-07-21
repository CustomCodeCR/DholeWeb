<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Bot, Eraser, Send, Sparkles, UserRound } from 'lucide-vue-next'
import { DhBadge, DhButton, DhEmptyState } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { AiService } from '@/core/services/aiService'
import { useToastStore } from '@/core/stores/toastStore'
import type { AiMessageRequest } from '@/core/interfaces/ai'

interface ChatMessage extends AiMessageRequest {
  id: string
  modelName?: string
  tokenCount?: number
}

const PROFILE_KEY = 'assistant'
const STORAGE_KEY = 'dhole.ai.assistant.messages'
const toastStore = useToastStore()
const messages = ref<ChatMessage[]>([])
const prompt = ref('')
const sending = ref(false)
const conversation = ref<HTMLElement | null>(null)

const canSend = computed(() => Boolean(prompt.value.trim() && !sending.value))

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.value.slice(-60)))
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

async function sendMessage() {
  const content = prompt.value.trim()
  if (!canSend.value || !content) return

  messages.value.push({
    id: crypto.randomUUID(),
    role: 'user',
    content,
  })
  prompt.value = ''
  persist()
  await scrollToBottom()

  try {
    sending.value = true
    const history: AiMessageRequest[] = messages.value
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-30)
      .map(({ role, content: messageContent }) => ({ role, content: messageContent }))

    const result = await AiService.executeChat({
      profileKey: PROFILE_KEY,
      messages: history,
      correlationId: crypto.randomUUID(),
    })

    messages.value.push({
      id: result.executionId,
      role: 'assistant',
      content: result.content,
      modelName: result.modelName,
      tokenCount: result.tokenUsage.totalTokens,
    })
    persist()
  } catch (error) {
    toastStore.backendError(error, 'El asistente no pudo responder la consulta.')
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

function clearConversation() {
  messages.value = []
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
      subtitle="Converse con el asistente general de Dhole. Las preguntas y respuestas quedan registradas en AuditLogs."
      :icon="Bot"
    >
      <template #actions>
        <DhButton label="Limpiar conversación" :icon="Eraser" variant="secondary" @click="clearConversation" />
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px]">
      <header class="flex items-center gap-3 border-b border-[var(--dh-border)] p-4">
        <div class="flex h-10 w-10 items-center justify-center rounded-2xl dh-bg-primary-soft text-[var(--dh-primary)]">
          <Sparkles class="h-4 w-4" />
        </div>
        <div>
          <h2 class="font-black text-[var(--dh-text)]">Conversación</h2>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Perfil activo: assistant</p>
        </div>
      </header>

      <div ref="conversation" class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        <DhEmptyState
          v-if="messages.length === 0"
          title="Inicie una conversación"
          description="Escriba una consulta para el asistente general de Dhole."
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
            :class="message.role === 'user'
              ? 'bg-[var(--dh-primary)] text-white'
              : 'border border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text)]'"
          >
            <p class="whitespace-pre-wrap break-words text-sm font-semibold leading-6">{{ message.content }}</p>
            <div v-if="message.role === 'assistant' && message.modelName" class="mt-3 flex flex-wrap gap-2">
              <DhBadge :label="message.modelName" variant="neutral" />
              <DhBadge v-if="message.tokenCount != null" :label="`${message.tokenCount} tokens`" variant="neutral" />
            </div>
          </div>
          <div
            v-if="message.role === 'user'"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-white"
          >
            <UserRound class="h-4 w-4" />
          </div>
        </article>

        <div v-if="sending" class="flex items-center gap-3 text-sm font-bold text-[var(--dh-text-muted)]">
          <div class="flex h-9 w-9 items-center justify-center rounded-2xl dh-bg-primary-soft text-[var(--dh-primary)]">
            <Bot class="h-4 w-4" />
          </div>
          Analizando la consulta...
        </div>
      </div>

      <footer class="border-t border-[var(--dh-border)] p-4">
        <div class="flex items-end gap-3 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 focus-within:border-[var(--dh-primary)]">
          <textarea
            v-model="prompt"
            rows="2"
            class="max-h-48 min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-muted)]"
            placeholder="Escriba su consulta... Enter para enviar, Shift+Enter para nueva línea"
            :disabled="sending"
            @keydown="handleKeydown"
          />
          <DhButton label="Enviar" :icon="Send" :disabled="!canSend" :loading="sending" @click="sendMessage" />
        </div>
      </footer>
    </section>
  </section>
</template>
