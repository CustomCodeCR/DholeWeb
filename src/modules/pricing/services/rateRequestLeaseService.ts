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
  async claim(id: string): Promise<RateRequestLease> {
    const response = await callEndpoint<unknown, { token: string | null }>({
      method: 'POST',
      path: path(id, 'claim'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { body: { token: this.tokenFor(id) } })
    const lease = unwrapApiResponse<RateRequestLease>(response as never)
    sessionStorage.setItem(key(id), lease.token)
    return lease
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
    sessionStorage.removeItem(key(id))
    await callEndpoint<unknown, { token: string }>({
      method: 'POST',
      path: path(id, 'release'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { body: { token } })
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
  async completeRate(id: string, rateId: string): Promise<void> {
    const token = this.tokenFor(id)
    if (!token) throw new Error('No existe una reserva vigente para finalizar la tarifa.')
    await callEndpoint<unknown, { rateId: string }>({
      method: 'POST',
      path: path(id, 'complete-rate'),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, {
      body: { rateId },
      extraHeaders: { 'X-Rate-Request-Lease': token },
    })
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
