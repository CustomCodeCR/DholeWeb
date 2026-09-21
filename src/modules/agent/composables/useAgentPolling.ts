import { onBeforeUnmount } from 'vue'
import type { AgentExecutionStatus } from '@/core/interfaces/agent'

export const AGENT_POLLING_STATUSES: ReadonlySet<AgentExecutionStatus> = new Set([
  'Pending',
  'Queued',
  'Running',
  'WaitingForAuthentication',
])

export const AGENT_TERMINAL_STATUSES: ReadonlySet<AgentExecutionStatus> = new Set([
  'Completed',
  'PartiallyCompleted',
  'Failed',
  'Cancelled',
])

export function isAgentExecutionPollingStatus(
  status: AgentExecutionStatus | null | undefined,
): boolean {
  return Boolean(status && AGENT_POLLING_STATUSES.has(status))
}

export function isAgentExecutionTerminalStatus(
  status: AgentExecutionStatus | null | undefined,
): boolean {
  return Boolean(status && AGENT_TERMINAL_STATUSES.has(status))
}

export function useAgentPolling(options: {
  getStatus: () => AgentExecutionStatus | null | undefined
  refresh: () => Promise<void> | void
  intervalMs?: number
}) {
  const intervalMs = Math.max(1000, options.intervalMs ?? 5000)
  let timer: number | null = null
  let refreshing = false
  let disposed = false

  function stop() {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  function schedule() {
    stop()

    if (disposed || document.hidden || !isAgentExecutionPollingStatus(options.getStatus())) {
      return
    }

    timer = window.setTimeout(async () => {
      timer = null
      if (disposed || refreshing || document.hidden) {
        schedule()
        return
      }

      refreshing = true
      try {
        await options.refresh()
      } finally {
        refreshing = false
      }

      if (isAgentExecutionTerminalStatus(options.getStatus())) {
        stop()
        return
      }

      schedule()
    }, intervalMs)
  }

  function sync() {
    if (disposed) return

    if (document.hidden || isAgentExecutionTerminalStatus(options.getStatus())) {
      stop()
      return
    }

    if (isAgentExecutionPollingStatus(options.getStatus())) {
      schedule()
    } else {
      stop()
    }
  }

  async function onVisibilityChange() {
    if (document.hidden) {
      stop()
      return
    }

    if (isAgentExecutionPollingStatus(options.getStatus())) {
      try {
        await options.refresh()
      } finally {
        sync()
      }
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)

  onBeforeUnmount(() => {
    disposed = true
    stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { sync, stop }
}
