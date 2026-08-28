import { callEndpoint } from '@/core/api/callEndpoint'
import { fetchBlobClient } from '@/core/api/fetchBlobClient'
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import { toQueryString } from '@/core/api/queryString'
import type {
  BrowseStorageFilesQuery,
  StorageFileDescriptor,
  StorageFileDto,
  StorageFileListItemDto,
  StoragePreviewKind,
  StorageProviderDto,
  StorageSummaryDto,
} from '@/core/interfaces/storage'
import type { Endpoint } from '@/core/composables/endpoints'

const gatewayBaseUrl =
  ((import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '')
const storageGatewayPath =
  ((import.meta.env.VITE_STORAGE_GATEWAY_PATH as string | undefined)?.trim() || '/api/storage')
    .replace(/^\/?/, '/')
    .replace(/\/$/, '')

export const STORAGE_BASE_URL = `${gatewayBaseUrl}${storageGatewayPath}`

const endpoints = {
  browse: { method: 'GET', path: '/api/v1/storage/files', baseUrl: STORAGE_BASE_URL },
  upload: { method: 'POST', path: '/api/v1/storage/files', baseUrl: STORAGE_BASE_URL },
  summary: { method: 'GET', path: '/api/v1/storage/files/summary', baseUrl: STORAGE_BASE_URL },
  get: { method: 'GET', path: '/api/v1/storage/files/{{fileId}}', baseUrl: STORAGE_BASE_URL },
  delete: { method: 'DELETE', path: '/api/v1/storage/files/{{fileId}}', baseUrl: STORAGE_BASE_URL },
  providers: { method: 'GET', path: '/api/v1/storage/providers', baseUrl: STORAGE_BASE_URL },
} satisfies Record<string, Endpoint>

const downloadExtensions = new Set(['.csv', '.xls', '.xlsx', '.xlsm', '.xlsb', '.doc', '.docx'])
const textExtensions = new Set(['.txt', '.json', '.xml', '.html', '.htm', '.eml', '.log', '.md'])
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.svg'])

function normalizedExtension(file: Pick<StorageFileDescriptor, 'fileName' | 'extension'>): string {
  if (file.extension?.trim()) {
    const value = file.extension.trim().toLowerCase()
    return value.startsWith('.') ? value : `.${value}`
  }

  const dot = file.fileName.lastIndexOf('.')
  return dot >= 0 ? file.fileName.slice(dot).toLowerCase() : ''
}

export function storagePreviewKind(file: StorageFileDescriptor): StoragePreviewKind {
  const contentType = file.contentType?.toLowerCase().trim() ?? ''
  const extension = normalizedExtension(file)

  if (downloadExtensions.has(extension)) return 'download'
  if (contentType.startsWith('image/') || imageExtensions.has(extension)) return 'image'
  if (contentType === 'application/pdf' || extension === '.pdf') return 'pdf'
  if (
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType === 'message/rfc822' ||
    textExtensions.has(extension)
  ) {
    return 'text'
  }

  return 'unsupported'
}

export function parseStorageReference(reference?: string | null): string | null {
  if (!reference?.trim()) return null
  const value = reference.trim()
  const candidate = value.toLowerCase().startsWith('storage://') ? value.slice('storage://'.length) : value
  const normalized = candidate.replace(/^\/+|\/+$/g, '')
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null
}

export interface UploadStorageFileInput {
  file: File
  sourceService: string
  entityType: string
  entityId: string
  providerId?: string | null
  metadataJson?: string | null
}

export const StorageService = {
  async browse(query?: BrowseStorageFilesQuery): Promise<PagedResponse<StorageFileListItemDto>> {
    const response = await callEndpoint<unknown>({
      ...endpoints.browse,
      path: endpoints.browse.path + (query ? toQueryString(query) : ''),
    })
    return unwrapPagedResponse<StorageFileListItemDto>(response)
  },

  async uploadFile(input: UploadStorageFileInput): Promise<StorageFileDto> {
    const body = new FormData()
    body.append('file', input.file)
    body.append('sourceService', input.sourceService)
    body.append('entityType', input.entityType)
    body.append('entityId', input.entityId)
    if (input.providerId) body.append('providerId', input.providerId)
    if (input.metadataJson) body.append('metadataJson', input.metadataJson)

    const response = await callEndpoint<unknown>(endpoints.upload, { body, isFormData: true })
    return unwrapApiResponse<StorageFileDto>(response as never)
  },

  async getSummary(): Promise<StorageSummaryDto> {
    const response = await callEndpoint<unknown>(endpoints.summary)
    return unwrapApiResponse<StorageSummaryDto>(response as never)
  },

  async getFile(fileId: string): Promise<StorageFileDto> {
    const response = await callEndpoint<unknown>(endpoints.get, { params: { fileId } })
    return unwrapApiResponse<StorageFileDto>(response as never)
  },

  async getProviders(): Promise<StorageProviderDto[]> {
    const response = await callEndpoint<unknown>(endpoints.providers)
    return unwrapListResponse<StorageProviderDto>(response)
  },

  async deleteFile(fileId: string): Promise<void> {
    await callEndpoint<void>(endpoints.delete, { params: { fileId } })
  },

  async getContent(fileId: string): Promise<Blob> {
    return fetchBlobClient(
      `/api/v1/storage/files/${encodeURIComponent(fileId)}/content`,
      { method: 'GET' },
      STORAGE_BASE_URL,
    )
  },

  async downloadFile(file: StorageFileDescriptor): Promise<void> {
    const blob = await this.getContent(file.id)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.fileName || 'archivo'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  },
}
