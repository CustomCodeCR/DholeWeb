import { PricingService } from '@/core/services/pricingService'
import { useToastStore } from '@/core/stores/toastStore'
import { createUuid } from '@/core/utils/id'
import type { CreateRateRequest, UpdateRateRequest } from '@/core/interfaces/pricing'

type QueuedPricingMutation =
  | { id: string; type: 'create-rate'; payload: CreateRateRequest; createdAt: string; attempts: number }
  | { id: string; type: 'update-rate'; rateId: string; payload: UpdateRateRequest; createdAt: string; attempts: number }

const STORAGE_KEY = 'dhole.offline.pricing.queue.v1'
let initialized = false
let flushing = false

function readQueue(): QueuedPricingMutation[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? (JSON.parse(value) as QueuedPricingMutation[]) : []
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedPricingMutation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  window.dispatchEvent(new CustomEvent('dhole:offline:queue-changed', { detail: { pending: queue.length } }))
}

export function isConnectionFailure(error: unknown): boolean {
  if (!navigator.onLine) return true
  if (error instanceof TypeError) return true
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase()
  return message.includes('failed to fetch') || message.includes('network') || message.includes('load failed')
}

export function queueRateCreate(payload: CreateRateRequest) {
  const queue = readQueue()
  queue.push({ id: createUuid(), type: 'create-rate', payload, createdAt: new Date().toISOString(), attempts: 0 })
  writeQueue(queue)
}

export function queueRateUpdate(rateId: string, payload: UpdateRateRequest) {
  const queue = readQueue()
  const existingIndex = queue.findIndex((item) => item.type === 'update-rate' && item.rateId === rateId)
  const entry: QueuedPricingMutation = {
    id: existingIndex >= 0 ? queue[existingIndex]!.id : createUuid(),
    type: 'update-rate',
    rateId,
    payload,
    createdAt: new Date().toISOString(),
    attempts: existingIndex >= 0 ? queue[existingIndex]!.attempts : 0,
  }
  if (existingIndex >= 0) queue.splice(existingIndex, 1, entry)
  else queue.push(entry)
  writeQueue(queue)
}

export async function flushPricingOfflineQueue() {
  if (flushing || !navigator.onLine) return
  flushing = true
  const toast = useToastStore()
  try {
    const queue = readQueue()
    if (!queue.length) return
    const remaining: QueuedPricingMutation[] = []
    let synced = 0

    for (const item of queue) {
      try {
        if (item.type === 'create-rate') await PricingService.createRate(item.payload)
        else await PricingService.updateRate(item.rateId, item.payload)
        synced += 1
      } catch (error) {
        remaining.push({ ...item, attempts: item.attempts + 1 } as QueuedPricingMutation)
        if (isConnectionFailure(error)) {
          remaining.push(...queue.slice(queue.indexOf(item) + 1))
          break
        }
      }
    }

    writeQueue(remaining)
    if (synced > 0) {
      toast.success('Cambios sincronizados', `${synced} cambio${synced === 1 ? '' : 's'} pendiente${synced === 1 ? '' : 's'} se guardó correctamente.`)
      window.dispatchEvent(new CustomEvent('dhole:data:changed', { detail: { endpoint: '/api/pricing/rates', method: 'OFFLINE_SYNC' } }))
    }
    if (remaining.length > 0 && synced > 0) toast.warning('Sincronización parcial', `${remaining.length} cambio(s) siguen pendientes.`)
  } finally {
    flushing = false
  }
}

export function initializePricingOfflineSync() {
  if (initialized) return
  initialized = true
  window.addEventListener('online', () => void flushPricingOfflineQueue())
  if (navigator.onLine) void flushPricingOfflineQueue()
}
