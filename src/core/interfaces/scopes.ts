export interface ScopeDto {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
}

export interface ScopeSelectDto {
  id: string
  code: string
  name: string
}
