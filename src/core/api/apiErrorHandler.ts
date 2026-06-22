/**
 * API Error Handler
 *
 * This module provides custom error classes and utilities for handling API errors
 * in a consistent and informative way across the application.
 */

export interface BackendErrorPayload {
  code?: string
  message?: string
  title?: string
  detail?: string
  error?: unknown
  errors?: unknown
  data?: unknown
  value?: unknown
  result?: unknown
  [key: string]: unknown
}

/**
 * Base class for all API-related errors
 */
export class ApiError extends Error {
  public status?: number
  public endpoint: string
  public method: string
  public code?: string
  public data?: unknown

  constructor(
    message: string,
    endpoint: string,
    method: string,
    status?: number,
    code?: string,
    data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.endpoint = endpoint
    this.method = method
    this.status = status
    this.code = code
    this.data = data

    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

/**
 * Error thrown when a network issue prevents the request from completing
 */
export class NetworkError extends ApiError {
  constructor(endpoint: string, method: string, originalError: Error) {
    super(`Network error while accessing ${endpoint}: ${originalError.message}`, endpoint, method)
    this.name = 'NetworkError'

    Object.setPrototypeOf(this, NetworkError.prototype)
  }
}

/**
 * Error thrown for HTTP 4xx client errors
 */
export class ClientError extends ApiError {
  constructor(
    endpoint: string,
    method: string,
    status: number,
    message: string,
    data?: unknown,
    code?: string,
  ) {
    super(message, endpoint, method, status, code, data)
    this.name = 'ClientError'

    Object.setPrototypeOf(this, ClientError.prototype)
  }
}

/**
 * Error thrown for HTTP 5xx server errors
 */
export class ServerError extends ApiError {
  constructor(endpoint: string, method: string, status: number, message: string, data?: unknown, code?: string) {
    super(message, endpoint, method, status, code, data)
    this.name = 'ServerError'

    Object.setPrototypeOf(this, ServerError.prototype)
  }
}

/**
 * Error thrown when a parameter is missing in endpoint URL
 */
export class MissingParameterError extends Error {
  public paramName: string

  constructor(paramName: string) {
    super(`Missing parameter: ${paramName}`)
    this.name = 'MissingParameterError'
    this.paramName = paramName

    Object.setPrototypeOf(this, MissingParameterError.prototype)
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const text = value.trim()
  return text.length > 0 ? text : null
}

function firstMessageFromArray(values: unknown[]): string | null {
  const messages = values
    .flatMap((value) => {
      if (typeof value === 'string') return [value]
      if (isObject(value)) {
        const message = clean(value.message) ?? clean(value.errorMessage) ?? clean(value.description)
        return message ? [message] : []
      }
      return []
    })
    .map((value) => value.trim())
    .filter(Boolean)

  return messages.length > 0 ? messages.join('\n') : null
}

function extractValidationErrors(errors: unknown): string | null {
  if (!errors) return null

  if (typeof errors === 'string') return clean(errors)
  if (Array.isArray(errors)) return firstMessageFromArray(errors)

  if (isObject(errors)) {
    const messages: string[] = []

    Object.entries(errors).forEach(([field, value]) => {
      if (Array.isArray(value)) {
        const message = firstMessageFromArray(value)
        if (message) messages.push(field ? `${field}: ${message}` : message)
        return
      }

      const message = clean(value) ?? (isObject(value) ? extractBackendMessage(value) : null)
      if (message) messages.push(field ? `${field}: ${message}` : message)
    })

    return messages.length > 0 ? messages.join('\n') : null
  }

  return null
}

export function extractBackendCode(data: unknown): string | undefined {
  let current = data

  for (let depth = 0; depth < 4; depth += 1) {
    if (!isObject(current)) break

    const code = clean(current.code) ?? clean(current.errorCode) ?? clean(current.type)
    if (code) return code

    if (isObject(current.error)) {
      current = current.error
      continue
    }

    if (isObject(current.data)) {
      current = current.data
      continue
    }

    if (isObject(current.value)) {
      current = current.value
      continue
    }

    if (isObject(current.result)) {
      current = current.result
      continue
    }

    break
  }

  return undefined
}

export function extractBackendMessage(data: unknown): string | null {
  let current = data

  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current === 'string') return clean(current)
    if (Array.isArray(current)) return firstMessageFromArray(current)
    if (!isObject(current)) return null

    const directMessage =
      clean(current.message) ??
      clean(current.detail) ??
      clean(current.errorMessage) ??
      clean(current.description)

    if (directMessage) return directMessage

    const validationMessage = extractValidationErrors(current.errors)
    if (validationMessage) return validationMessage

    const errorValue = current.error
    if (typeof errorValue === 'string') return clean(errorValue)
    if (Array.isArray(errorValue)) return firstMessageFromArray(errorValue)
    if (isObject(errorValue)) {
      current = errorValue
      continue
    }

    if (isObject(current.data)) {
      current = current.data
      continue
    }

    if (isObject(current.value)) {
      current = current.value
      continue
    }

    if (isObject(current.result)) {
      current = current.result
      continue
    }

    const title = clean(current.title)
    if (title) return title

    return null
  }

  return null
}

export function getApiErrorMessage(error: unknown, fallback = 'No se pudo completar la acción.'): string {
  if (error instanceof ApiError) {
    return extractBackendMessage(error.data) ?? error.message ?? fallback
  }

  if (error instanceof Error) {
    return error.message || fallback
  }

  return extractBackendMessage(error) ?? fallback
}

function fallbackMessageByStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Solicitud inválida.'
    case 401:
      return 'La sesión expiró o no está autorizada.'
    case 403:
      return 'No tiene permisos para realizar esta acción.'
    case 404:
      return 'No se encontró el registro solicitado.'
    case 409:
      return 'La acción genera conflicto con el estado actual del registro.'
    case 422:
      return 'La validación falló.'
    case 429:
      return 'Demasiados intentos. Intente de nuevo más tarde.'
    default:
      return status >= 500 ? 'Error interno del servidor.' : `Error HTTP ${status}.`
  }
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false

  const value = contentType.toLowerCase()
  return value.includes('application/json') || value.includes('+json')
}

async function readErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type')

  try {
    if (isJsonContentType(contentType)) {
      return await response.json()
    }

    const text = await response.text()
    return clean(text)
  } catch (e) {
    console.warn('Could not parse error response body', e)
    return null
  }
}

/**
 * Handles API response errors and throws appropriate custom error
 *
 * @param response - The fetch Response object
 * @param endpoint - The API endpoint that was called
 * @param method - The HTTP method that was used
 * @throws ApiError or its subclasses based on the response status
 */
export async function handleApiResponse(
  response: Response,
  endpoint: string,
  method: string,
): Promise<void> {
  if (response.ok) {
    return
  }

  const status = response.status
  const errorData = await readErrorBody(response)
  const backendMessage = extractBackendMessage(errorData)
  const code = extractBackendCode(errorData)
  const message = backendMessage ?? fallbackMessageByStatus(status)

  if (status >= 400 && status < 500) {
    throw new ClientError(endpoint, method, status, message, errorData, code)
  }

  if (status >= 500) {
    throw new ServerError(endpoint, method, status, message, errorData, code)
  }

  throw new ApiError(message, endpoint, method, status, code, errorData)
}

/**
 * Parses JSON safely with error handling
 *
 * @param response - The fetch Response object to parse
 * @returns The parsed JSON data or null if parsing fails
 */
export async function safeJsonParse(response: Response): Promise<any> {
  if (
    response.status === 204 ||
    response.headers.get('Content-Length') === '0' ||
    !isJsonContentType(response.headers.get('Content-Type'))
  ) {
    return null
  }

  try {
    const clonedResponse = response.clone()
    return await clonedResponse.json()
  } catch (error) {
    console.warn('Failed to parse response as JSON:', error)
    return null
  }
}
