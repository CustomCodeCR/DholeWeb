let transientAccessToken: string | null = null

export function getTransientAccessToken(): string | null {
  return transientAccessToken
}

export function hasTransientAccessToken(): boolean {
  return Boolean(transientAccessToken)
}

export function setTransientAccessToken(token: string): void {
  transientAccessToken = token
}

export function clearTransientAccessToken(): void {
  transientAccessToken = null
}
