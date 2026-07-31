import type { AiMessageRequest } from '@/core/interfaces/ai'

const DEFAULT_MAX_MESSAGES = 12
const DEFAULT_MAX_CHARACTERS = 12_000

export function buildAiChatHistory(
  messages: readonly AiMessageRequest[],
  maximumMessages = DEFAULT_MAX_MESSAGES,
  maximumCharacters = DEFAULT_MAX_CHARACTERS,
): AiMessageRequest[] {
  const history: AiMessageRequest[] = []
  let usedCharacters = 0

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (history.length >= maximumMessages || usedCharacters >= maximumCharacters) break

    const message = messages[index]
    if (!message || (message.role !== 'user' && message.role !== 'assistant')) continue

    const content = message.content.trim()
    if (!content) continue

    const availableCharacters = maximumCharacters - usedCharacters
    const boundedContent =
      content.length <= availableCharacters ? content : content.slice(0, availableCharacters)

    history.unshift({ role: message.role, content: boundedContent })
    usedCharacters += boundedContent.length
  }

  return history
}
