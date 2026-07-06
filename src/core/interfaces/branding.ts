export interface ClientBrandingSettings {
  clientId?: string | null
  clientCode?: string | null
  clientName?: string | null
  primaryColor: string
  backgroundImageUrl?: string | null
  backgroundOverlayOpacity?: number | null
  updatedAt?: string | null
}

export interface UpdateClientBrandingRequest {
  clientId?: string | null
  clientCode?: string | null
  primaryColor: string
  backgroundImageUrl?: string | null
  backgroundOverlayOpacity?: number | null
}

export interface SaveClientBrandingResult {
  synced: boolean
  settings: ClientBrandingSettings
  error?: unknown
}

export const DEFAULT_CLIENT_BRANDING: ClientBrandingSettings = {
  clientId: null,
  clientCode: 'default',
  clientName: 'Default',
  primaryColor: '#fc2800',
  backgroundImageUrl: null,
  backgroundOverlayOpacity: 0.5,
}
