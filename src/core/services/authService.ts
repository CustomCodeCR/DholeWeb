import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'

import type {
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
