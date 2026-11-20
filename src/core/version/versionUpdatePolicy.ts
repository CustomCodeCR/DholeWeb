/**
 * A global shutdown always wins over an individual opt-in.
 * A null individual value inherits the global policy.
 */
export function shouldShowVersionUpdateNotice(globalEnabled: boolean, userEnabled: boolean | null): boolean {
  return globalEnabled && userEnabled !== false
}
