<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Bot, Eraser, Send, Sparkles, UserRound, X } from 'lucide-vue-next'
import { AI_SCOPES } from '@/core/auth/scopes'
import { AiService } from '@/core/services/aiService'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import type { AiMessageRequest } from '@/core/interfaces/ai'
import { createUuid } from '@/core/utils/id'

interface AssistantMessage extends AiMessageRequest {
  id: string
  modelName?: string
  tokenCount?: number
}

const STORAGE_KEY = 'dhole.ai.floating-assistant.messages'
const PROFILE_KEY = 'assistant'

const authStore = useAuthStore()
const toastStore = useToastStore()
const panelOpen = ref(false)
const prompt = ref('')
const sending = ref(false)
const messages = ref<AssistantMessage[]>([])
const conversation = ref<HTMLElement | null>(null)

const isVisible = computed(
  () => authStore.isAuthenticated && authStore.hasScope(AI_SCOPES.executions.execute),
)
const canSend = computed(() => Boolean(prompt.value.trim()) && !sending.value)

function persistMessages(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.value.slice(-60)))
}

function restoreMessages(): void {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    messages.value = Array.isArray(stored) ? stored : []
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    messages.value = []
  }
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  conversation.value?.scrollTo({
    top: conversation.value.scrollHeight,
    behavior: 'smooth',
  })
}

function togglePanel(): void {
  panelOpen.value = !panelOpen.value
}

function closePanel(): void {
  panelOpen.value = false
}

function clearConversation(): void {
  messages.value = []
  localStorage.removeItem(STORAGE_KEY)
}

async function sendMessage(): Promise<void> {
  const content = prompt.value.trim()
  if (!content || !canSend.value) return

  messages.value.push({
    id: createUuid(),
    role: 'user',
    content,
  })
  prompt.value = ''
  persistMessages()
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
      correlationId: createUuid(),
    })

    messages.value.push({
      id: result.executionId,
      role: 'assistant',
      content: result.content,
      modelName: result.modelName,
      tokenCount: result.tokenUsage.totalTokens,
    })
    persistMessages()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo obtener una respuesta del asistente.')
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey) return

  event.preventDefault()
  void sendMessage()
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && panelOpen.value) {
    closePanel()
  }
}

watch(panelOpen, (isOpen) => {
  if (isOpen) void scrollToBottom()
})

watch(isVisible, (visible) => {
  if (!visible) closePanel()
})

onMounted(() => {
  restoreMessages()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-4 scale-95 opacity-0"
      enter-to-class="translate-y-0 scale-100 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 scale-100 opacity-100"
      leave-to-class="translate-y-4 scale-95 opacity-0"
    >
      <section
        v-if="isVisible && panelOpen"
        class="fixed bottom-24 right-4 z-[100] flex h-[min(680px,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:bottom-28 sm:right-7"
        aria-label="Asistente IA"
      >
        <header
          class="flex items-center justify-between border-b border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-3"
        >
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-white shadow-lg"
            >
              <Bot class="h-5 w-5" />
            </span>

            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="truncate text-sm font-black text-[var(--dh-text)]">Asistente IA</h2>
                <Sparkles class="h-3.5 w-3.5 text-[var(--dh-primary)]" />
              </div>
              <p class="truncate text-xs font-semibold text-[var(--dh-text-muted)]">
                Perfil: assistant
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="rounded-xl p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)] disabled:cursor-not-allowed disabled:opacity-40"
              title="Limpiar conversación"
              :disabled="messages.length === 0 || sending"
              @click="clearConversation"
            >
              <Eraser class="h-4 w-4" />
            </button>

            <button
              type="button"
              class="rounded-xl p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]"
              title="Cerrar"
              @click="closePanel"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </header>

        <div ref="conversation" class="dh-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
          <div
            v-if="messages.length === 0"
            class="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center"
          >
            <span
              class="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[color-mix(in_srgb,var(--dh-primary)_12%,transparent)] text-[var(--dh-primary)]"
            >
              <Sparkles class="h-7 w-7" />
            </span>
            <h3 class="text-base font-black text-[var(--dh-text)]">¿En qué puedo ayudarte?</h3>
            <p class="mt-2 max-w-xs text-sm leading-6 text-[var(--dh-text-muted)]">
              Pregunta sobre el sistema, procesos o información operativa sin abandonar la pantalla
              actual.
            </p>
          </div>

          <article
            v-for="message in messages"
            :key="message.id"
            class="flex gap-3"
            :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <span
              v-if="message.role === 'assistant'"
              class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-primary)] text-white"
            >
              <Bot class="h-4 w-4" />
            </span>

            <div
              class="max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm"
              :class="
                message.role === 'user'
                  ? 'rounded-br-md bg-[var(--dh-primary)] text-white'
                  : 'rounded-bl-md border border-[var(--dh-border)] bg-[var(--dh-shell)] text-[var(--dh-text)]'
              "
            >
              <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
              <p
                v-if="message.role === 'assistant' && (message.modelName || message.tokenCount)"
                class="mt-2 text-[10px] font-bold uppercase tracking-wide text-[var(--dh-text-muted)]"
              >
                {{ message.modelName
                }}<span v-if="message.modelName && message.tokenCount"> · </span
                >{{ message.tokenCount ? `${message.tokenCount} tokens` : '' }}
              </p>
            </div>

            <span
              v-if="message.role === 'user'"
              class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-card-hover)] text-[var(--dh-text)]"
            >
              <UserRound class="h-4 w-4" />
            </span>
          </article>

          <div v-if="sending" class="flex items-center gap-3">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--dh-primary)] text-white"
            >
              <Bot class="h-4 w-4" />
            </span>
            <div
              class="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-3"
            >
              <span
                class="h-2 w-2 animate-bounce rounded-full bg-[var(--dh-primary)] [animation-delay:-0.3s]"
              />
              <span
                class="h-2 w-2 animate-bounce rounded-full bg-[var(--dh-primary)] [animation-delay:-0.15s]"
              />
              <span class="h-2 w-2 animate-bounce rounded-full bg-[var(--dh-primary)]" />
            </div>
          </div>
        </div>

        <footer class="border-t border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
          <div
            class="flex items-end gap-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2 focus-within:border-[var(--dh-primary)]"
          >
            <textarea
              v-model="prompt"
              rows="1"
              class="dh-scrollbar max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-muted)]"
              placeholder="Escribe tu mensaje..."
              :disabled="sending"
              @keydown="handleComposerKeydown"
            />

            <button
              type="button"
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-primary)] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              title="Enviar"
              :disabled="!canSend"
              @click="sendMessage"
            >
              <Send class="h-4 w-4" />
            </button>
          </div>
          <p class="mt-2 text-center text-[10px] font-semibold text-[var(--dh-text-muted)]">
            Enter para enviar · Shift + Enter para nueva línea
          </p>
        </footer>
      </section>
    </Transition>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-3 scale-90 opacity-0"
      enter-to-class="translate-y-0 scale-100 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 scale-100 opacity-100"
      leave-to-class="translate-y-3 scale-90 opacity-0"
    >
      <button
        v-if="isVisible"
        type="button"
        class="group fixed bottom-5 right-5 z-[101] flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-[var(--dh-primary)] text-white shadow-[0_18px_45px_rgba(0,0,0,0.34)] transition hover:-translate-y-1 hover:scale-105 hover:shadow-[0_22px_60px_rgba(0,0,0,0.42)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--dh-primary)_30%,transparent)] sm:bottom-7 sm:right-7"
        :aria-expanded="panelOpen"
        aria-label="Abrir asistente IA"
        title="Asistente IA"
        @click="togglePanel"
      >
        <X v-if="panelOpen" class="h-6 w-6 transition-transform group-hover:rotate-90" />
        <Bot v-else class="h-7 w-7" />
        <Sparkles
          v-if="!panelOpen"
          class="absolute right-2 top-2 h-3.5 w-3.5 transition-transform group-hover:rotate-12 group-hover:scale-110"
        />
        <span
          v-if="!panelOpen"
          class="absolute inset-0 -z-10 animate-ping rounded-full bg-[var(--dh-primary)] opacity-20 [animation-duration:2.5s]"
        />
      </button>
    </Transition>
  </Teleport>
</template>
