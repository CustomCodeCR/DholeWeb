export interface CatalogGroupDto {
  id: string
  code: string
  slug: string
  name: string
  description: string | null
  metadataJson: string | null
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CatalogGroupSelectDto {
  id: string
  code: string
  slug: string
  name: string
  isSystem: boolean
  isActive: boolean
}

export interface CatalogGroupDetailDto extends CatalogGroupDto {
  items: CatalogItemDto[]
}

export interface CatalogItemDto {
  id: string
  catalogGroupId: string
  catalogGroupCode: string
  catalogGroupSlug: string
  code: string
  slug: string
  name: string
  description: string | null
  value: string | null
  metadataJson: string | null
  sortOrder: number
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CatalogItemDetailDto extends CatalogItemDto {
  catalogGroupName: string
}

export interface CatalogItemSelectDto {
  value: string
  label: string
  id: string
  code: string
  slug: string
  metadataJson: string | null
  isActive: boolean
}

export interface CatalogItemLookupDto {
  id: string
  catalogGroupId: string
  catalogGroupCode: string
  catalogGroupSlug: string
  code: string
  slug: string
  name: string
  value: string | null
  metadataJson: string | null
  isActive: boolean
}

export interface ValidateCatalogItemResponse {
  isValid: boolean
  catalogGroupSlug: string
  catalogItemSlug: string
  item: CatalogItemLookupDto | null
}

export interface CreateCatalogGroupRequest {
  name: string
  slug?: string | null
  description?: string | null
  metadataJson?: string | null
  isSystem: boolean
}

export interface UpdateCatalogGroupRequest {
  name: string
  description?: string | null
  metadataJson?: string | null
}

export interface SetCatalogGroupActiveRequest {
  isActive: boolean
}

export interface CreateCatalogItemRequest {
  catalogGroupId: string
  name: string
  slug?: string | null
  description?: string | null
  value?: string | null
  metadataJson?: string | null
  sortOrder: number
  isSystem: boolean
}

export interface CreateCatalogItemForGroupRequest {
  name: string
  slug?: string | null
  description?: string | null
  value?: string | null
  metadataJson?: string | null
  sortOrder: number
  isSystem: boolean
}

export interface UpdateCatalogItemRequest {
  name: string
  description?: string | null
  value?: string | null
  metadataJson?: string | null
  sortOrder: number
}

export interface SetCatalogItemActiveRequest {
  isActive: boolean
}

export interface ChangeCatalogItemSortOrderRequest {
  sortOrder: number
}

export interface BrowseCatalogGroupsQuery {
  pageNumber?: number
  pageSize?: number
  search?: string
  isActive?: boolean | null
}

export interface BrowseCatalogItemsQuery {
  pageNumber?: number
  pageSize?: number
  catalogGroupId?: string | null
  search?: string
  isActive?: boolean | null
}

export interface SelectCatalogGroupsQuery {
  search?: string
}

export interface SelectCatalogItemsQuery {
  catalogGroupId?: string | null
  catalogGroupSlug?: string | null
  search?: string
}

export interface ValidateCatalogItemQuery {
  catalogGroupSlug: string
  catalogItemSlug: string
}
