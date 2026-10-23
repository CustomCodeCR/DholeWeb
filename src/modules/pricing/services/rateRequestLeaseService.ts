import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'

export interface RateRequestLease {
  token: string
  ownerName: string
  expiresAtUtc: string
}

const key = (id: string) => `dhole:pricing:rate-request:lease:${id}`
const path = (id: string, operation: string) =>
  `/api/pricing/rate-requests/${encodeURIComponent(id)}/${operation}`

export const RateRequestLeaseService = {
  tokenFor(id: string): string | null {
    return sessionStorage.getItem(key(id))
  },
  async claim(id: string, options?: { recoverOwnLease?: boolean }): Promise<RateRequestLease> {
    const response = await callEndpoint<unknown, { token: string | null; recoverOwnLease: boolean }>({
      method: 'POST',
      path: path(id, 'claim'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { body: { token: this.tokenFor(id), recoverOwnLease: options?.recoverOwnLease === true } })
    const lease = unwrapApiResponse<RateRequestLease>(response as never)
    sessionStorage.setItem(key(id), lease.token)
    return lease
  },
  async setWorkStatus(id: string, workStatus: 'Working' | 'RequestedFromProvider'): Promise<{ workStatus: 'Working' | 'RequestedFromProvider'; workStatusUpdatedAtUtc: string }> {
    const token = this.tokenFor(id)
    if (!token) throw new Error('No existe una reserva vigente de la solicitud.')
    const response = await callEndpoint<unknown, { workStatus: string }>({
      method: 'PATCH',
      path: path(id, 'work-status'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, {
      body: { workStatus },
      extraHeaders: { 'X-Rate-Request-Lease': token },
    })
    return unwrapApiResponse<{ workStatus: 'Working' | 'RequestedFromProvider'; workStatusUpdatedAtUtc: string }>(response as never)
  },
  async heartbeat(id: string): Promise<void> {
    const token = this.tokenFor(id)
    if (!token) throw new Error('Se perdió la reserva de la solicitud.')
    await callEndpoint<unknown, { token: string }>({
      method: 'POST',
      path: path(id, 'heartbeat'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { body: { token } })
  },
  async release(id: string): Promise<void> {
    const token = this.tokenFor(id)
    if (!token) return
    await callEndpoint<unknown, { token: string }>({
      method: 'POST',
      path: path(id, 'release'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { body: { token } })
    if (sessionStorage.getItem(key(id)) === token) sessionStorage.removeItem(key(id))
  },
  async attachRate(id: string, rateId: string): Promise<void> {
    const token = this.tokenFor(id)
    if (!token) throw new Error('No existe una reserva vigente para asociar la tarifa.')
    await callEndpoint<unknown, { rateId: string }>({
      method: 'POST',
      path: path(id, 'attach-rate'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, {
      body: { rateId },
      extraHeaders: { 'X-Rate-Request-Lease': token },
    })
  },
  async prepareModification(id: string, rateId: string, revisionNumber: number): Promise<number> {
    const token = this.tokenFor(id)
    if (!token) throw new Error('No existe una reserva vigente de esta modificación.')
    const response = await callEndpoint<unknown, { rateId: string; revisionNumber: number }>({
      method: 'POST',
      path: path(id, 'prepare-modification'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, {
      body: { rateId, revisionNumber },
      extraHeaders: { 'X-Rate-Request-Lease': token },
    })
    const prepared = unwrapApiResponse<{ preparedRevisionNumber: number }>(response as never)
    return prepared.preparedRevisionNumber
  },
  async completeRate(id: string, rateId: string, options?: { confirmSellerModification?: boolean }): Promise<void> {
    const token = this.tokenFor(id)
    if (!token) throw new Error('No existe una reserva vigente para finalizar la tarifa.')
    await callEndpoint<unknown, { rateId: string }>({
      method: 'POST',
      path: path(id, 'complete-rate'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, {
      body: { rateId, confirmation: options?.confirmSellerModification === true ? 'SendSellerModification' : null },
      extraHeaders: { 'X-Rate-Request-Lease': token },
    })
  },
  async cancel(id: string, payload: { reason: 'Duplicate' | 'CustomerCancelled' | 'SellerCancelled' | 'Other'; details?: string }): Promise<void> {
    const token = this.tokenFor(id)
    if (!token) throw new Error('No existe una reserva vigente para cancelar la solicitud.')
    await callEndpoint<unknown, typeof payload>({
      method: 'POST',
      path: path(id, 'cancel'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { body: payload, extraHeaders: { 'X-Rate-Request-Lease': token } })
  },
  async complete(id: string): Promise<void> {
    const token = this.tokenFor(id)
    if (!token) throw new Error('No existe una reserva vigente para completar la solicitud.')
    await callEndpoint<unknown>({
      method: 'POST',
      path: path(id, 'complete'),
      headers: { Accept: 'application/json' },
    }, { extraHeaders: { 'X-Rate-Request-Lease': token } })
  },
}
