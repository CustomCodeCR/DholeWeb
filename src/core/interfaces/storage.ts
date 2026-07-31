export interface BrowseStorageFilesQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  search?: string
  contentType?: string
  sourceService?: string
  entityType?: string
  providerId?: string
}

export interface StorageFileListItemDto extends Record<string, unknown> {
  id: string
  providerId: string
  providerName: string
  providerType: string
  originalFileName: string
  contentType: string
  extension?: string | null
  sizeInBytes: number
  checksum?: string | null
  status: string
  currentVersionNumber: number
  createdAt: string
  sourceService?: string | null
  entityType?: string | null
  entityId?: string | null
  referenceCount: number
  versionCount: number
  metadataJson?: string | null
}

export interface StorageFileReferenceDto extends Record<string, unknown> {
  id: string
  sourceService: string
  entityType: string
  entityId: string
}

export interface StorageFileVersionDto extends Record<string, unknown> {
  id: string
  versionNumber: number
  storedFileName: string
  path: string
  sizeInBytes: number
  checksum?: string | null
  createdAt: string
}

export interface StorageFileDto extends Record<string, unknown> {
  id: string
  providerId: string
  originalFileName: string
  storedFileName: string
  contentType: string
  extension?: string | null
  sizeInBytes: number
  path: string
  checksum?: string | null
  status: string
  currentVersionNumber: number
  metadatJson?: string | null
  metadataJson?: string | null
  createdAt: string
  references: StorageFileReferenceDto[]
  versions: StorageFileVersionDto[]
}

export interface StorageSummaryDto extends Record<string, unknown> {
  totalFiles: number
  totalSizeInBytes: number
  imageFiles: number
  pdfFiles: number
  downloadOnlyFiles: number
  providerCount: number
  activeProviderCount: number
}

export interface StorageProviderDto extends Record<string, unknown> {
  id: string
  code: string
  name: string
  providerType: string
  isDefault: boolean
  isActive: boolean
  configuration?: string | null
}

export type StoragePreviewKind = 'image' | 'pdf' | 'text' | 'download' | 'unsupported'

export interface StorageFileDescriptor {
  id: string
  fileName: string
  contentType?: string | null
  extension?: string | null
  sizeInBytes?: number | null
}
