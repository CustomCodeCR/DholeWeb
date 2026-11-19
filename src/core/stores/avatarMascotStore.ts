import { defineStore } from 'pinia'
import { ref } from 'vue'

export type MascotMovement = 'fixed' | 'roam'
export interface MascotPosition { x: number; y: number }

const DEFAULT_POSITION: MascotPosition = { x: 0.88, y: 0.72 }
const KEY_PREFIX = 'dhole.blobatar.mascot.v1:'
const DEFAULT_NAME = 'Blobatar'

function normalizeName(value: string): string {
  return value.trim().slice(0, 32) || DEFAULT_NAME
}

function normalizedPosition(value: MascotPosition): MascotPosition {
  return {
    x: Math.max(0, Math.min(1, Number.isFinite(value.x) ? value.x : DEFAULT_POSITION.x)),
    y: Math.max(0, Math.min(1, Number.isFinite(value.y) ? value.y : DEFAULT_POSITION.y)),
  }
}

/** Per-account local mascot preferences; no private photo is sent to an API. */
export const useAvatarMascotStore = defineStore('avatarMascot', () => {
  const userId = ref<string | null>(null)
  const photo = ref<string | null>(null)
  const name = ref(DEFAULT_NAME)
  const movement = ref<MascotMovement>('fixed')
  const visible = ref(true)
  const position = ref<MascotPosition>({ ...DEFAULT_POSITION })
  let consumers = 0

  function keyFor(kind: 'photo' | 'name' | 'movement' | 'visible' | 'position'): string | null {
    return userId.value ? KEY_PREFIX + encodeURIComponent(userId.value) + ':' + kind : null
  }

  function read(kind: Parameters<typeof keyFor>[0]): string | null {
    const key = keyFor(kind)
    if (!key || typeof window === 'undefined') return null
    try { return window.localStorage.getItem(key) } catch { return null }
  }

  function write(kind: Parameters<typeof keyFor>[0], value: string | null) {
    const key = keyFor(kind)
    if (!key || typeof window === 'undefined') return
    // The photo upload must report quota errors rather than pretending to save.
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  }

  function hydrate() {
    const savedPhoto = read('photo')
    photo.value = savedPhoto && /^data:image\/(?:png|jpeg|webp);base64,/i.test(savedPhoto)
      ? savedPhoto : null
    name.value = normalizeName(read('name') ?? DEFAULT_NAME)
    movement.value = read('movement') === 'roam' ? 'roam' : 'fixed'
    visible.value = read('visible') !== 'false'
    try {
      const saved = JSON.parse(read('position') || 'null')
      position.value = saved && typeof saved.x === 'number' && typeof saved.y === 'number'
        ? normalizedPosition(saved) : { ...DEFAULT_POSITION }
    } catch {
      position.value = { ...DEFAULT_POSITION }
    }
  }

  function selectUser(value: string | number | null | undefined) {
    const next = String(value ?? '').trim() || null
    if (userId.value === next) return
    userId.value = next
    hydrate()
  }

  function setPhoto(dataUrl: string | null) {
    if (dataUrl !== null &&
      (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(dataUrl) || dataUrl.length > 750_000))
      throw new Error('Invalid or oversized profile image')
    write('photo', dataUrl)
    photo.value = dataUrl
    if (dataUrl) setVisible(true)
  }

  function setName(value: string) {
    name.value = normalizeName(value)
    write('name', name.value)
  }

  function setMovement(value: MascotMovement) {
    movement.value = value === 'roam' ? 'roam' : 'fixed'
    write('movement', movement.value)
  }

  function setVisible(value: boolean) {
    visible.value = Boolean(value)
    write('visible', String(visible.value))
  }

  function setPosition(value: MascotPosition) {
    position.value = normalizedPosition(value)
    write('position', JSON.stringify(position.value))
  }

  function handleStorage(event: StorageEvent) {
    if (userId.value && event.key?.startsWith(KEY_PREFIX + encodeURIComponent(userId.value) + ':'))
      hydrate()
  }

  function start() {
    if (typeof window === 'undefined') return
    consumers += 1
    if (consumers === 1) window.addEventListener('storage', handleStorage)
  }

  function stop() {
    consumers = Math.max(0, consumers - 1)
    if (consumers === 0 && typeof window !== 'undefined')
      window.removeEventListener('storage', handleStorage)
  }

  return { userId, photo, name, movement, visible, position,
    selectUser, setPhoto, setName, setMovement, setVisible, setPosition, start, stop }
})
