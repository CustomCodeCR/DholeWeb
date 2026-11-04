import { version } from '../../package.json'

/** The installed version comes from package.json; builds are identified by commit SHA. */
export const APP_VERSION: string = version
export const APP_CHANNEL: string = String(
  import.meta.env.VITE_RELEASE_CHANNEL || 'local',
)
export const APP_COMMIT: string = String(import.meta.env.VITE_BUILD_SHA || '')
  .trim()
  .slice(0, 12)

export const APP_VERSION_DETAIL = [
  `v${APP_VERSION}`,
  APP_CHANNEL,
  APP_COMMIT || null,
].filter(Boolean).join(' · ')
