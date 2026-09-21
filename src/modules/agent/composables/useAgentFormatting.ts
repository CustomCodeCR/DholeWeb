export function useAgentFormatting() {
  function formatDate(value: string | null | undefined): string {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat('es-CR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date)
  }

  function formatDuration(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—'
    if (value < 1000) return `${value} ms`

    const seconds = value / 1000
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`

    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  function parseJson(value: string | null | undefined): unknown {
    if (!value) return null
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  return { formatDate, formatDuration, parseJson }
}
