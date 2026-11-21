import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { MASCOT_ACCESSORIES, MASCOT_ACCESSORY_SLOT, normalizeMascotAccessories, type MascotAccessory } from '@/shared/components/atoms/mascotAccessoryCatalog'

export type MascotMovement = 'fixed' | 'roam'
export { MASCOT_ACCESSORIES } from '@/shared/components/atoms/mascotAccessoryCatalog'
export type { MascotAccessory } from '@/shared/components/atoms/mascotAccessoryCatalog'
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
  const accessories = ref<Exclude<MascotAccessory, 'none'>[]>([])
  // Preserve the historical single-accessory API for older consumers.
  const accessory = computed<MascotAccessory>(() => accessories.value[0] ?? 'none')
  const visible = ref(true)
  const position = ref<MascotPosition>({ ...DEFAULT_POSITION })
  let consumers = 0

  function keyFor(kind: 'photo' | 'name' | 'movement' | 'visible' | 'position' | 'accessory' | 'accessories'): string | null {
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
    // Upgrade existing browser data transparently; only the explicit multi-select key wins.
    const storedAccessories = read('accessories')
    try {
      const parsed: unknown = storedAccessories === null ? null : JSON.parse(storedAccessories)
      accessories.value = normalizeMascotAccessories(Array.isArray(parsed) ? parsed : [read('accessory')])
    } catch {
      accessories.value = normalizeMascotAccessories([read('accessory')])
    }
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
  }

  function setName(value: string) {
    name.value = normalizeName(value)
    write('name', name.value)
  }

  function setMovement(value: MascotMovement) {
    movement.value = value === 'roam' ? 'roam' : 'fixed'
    write('movement', movement.value)
  }

  function setAccessories(values: readonly MascotAccessory[]) {
    accessories.value = normalizeMascotAccessories(values)
    write('accessories', JSON.stringify(accessories.value))
    write('accessory', accessories.value[0] ?? 'none')
  }

  function toggleAccessory(value: MascotAccessory) {
    if (value === 'none') { setAccessories([]); return }
    if (accessories.value.includes(value)) {
      setAccessories(accessories.value.filter(kind => kind !== value))
      return
    }
    const slot = MASCOT_ACCESSORY_SLOT[value]
    setAccessories([...accessories.value.filter(kind => MASCOT_ACCESSORY_SLOT[kind] !== slot), value])
  }

  /** Backwards-compatible replacement of all accessories by one selected item. */
  function setAccessory(value: MascotAccessory) {
    setAccessories(MASCOT_ACCESSORIES.includes(value) ? [value] : [])
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

  return { userId, photo, name, movement, accessory, accessories, visible, position,
    selectUser, setPhoto, setName, setMovement, setAccessory, setAccessories, toggleAccessory, setVisible, setPosition, start, stop }
})
