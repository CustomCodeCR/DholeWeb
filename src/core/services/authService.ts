import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'

import type {
  ChangeOwnPasswordRequest,
  ImpersonationResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from '@/core/interfaces/auth'

export const AuthService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const response = await callEndpoint<LoginResponse, LoginRequest>(Endpoints.login, {
      body: payload,
    })

    return unwrapApiResponse(response)
  },

  async startImpersonation(userId: string): Promise<ImpersonationResponse> {
    const response = await callEndpoint<ImpersonationResponse>(Endpoints.startImpersonation, {
      params: { userId },
    })

    return unwrapApiResponse(response)
  },

  async stopImpersonation(): Promise<void> {
    await callEndpoint<void>(Endpoints.stopImpersonation)
  },

  async changeOwnPassword(payload: ChangeOwnPasswordRequest): Promise<void> {
    await callEndpoint<void, ChangeOwnPasswordRequest>(Endpoints.changeOwnPassword, {
      body: payload,
    })
  },

  async refreshToken(payload: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const response = await callEndpoint<RefreshTokenResponse, RefreshTokenRequest>(
      Endpoints.refreshToken,
      {
        body: payload,
      },
    )

    return unwrapApiResponse(response)
  },
}
