// Route the trusted production and staging gateways through the Web origin.
// Local development, custom deployments and external API endpoints retain their configured origins.
const pairedGatewayOrigins: Record<string, string> = {
  'https://sistema.logisticacastrofallas.com': 'https://api.logisticacastrofallas.com',
  'https://dhole.customcodecr.com': 'https://dhole-api.customcodecr.com',
}

export function resolveGatewayBaseUrl(
  configuredBaseUrl: string | undefined,
  frontendOrigin: string | undefined = typeof window === 'undefined' ? undefined : window.location.origin,
): string {
  const gatewayBaseUrl = (configuredBaseUrl ?? '').trim().replace(/\/+$/, '')
  const matchingGateway = frontendOrigin ? pairedGatewayOrigins[frontendOrigin] : undefined

  // Never rewrite arbitrary domains: a mismatched or custom Gateway remains untouched.
  return matchingGateway && gatewayBaseUrl.toLowerCase() === matchingGateway ? '' : gatewayBaseUrl
}
