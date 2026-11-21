<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DhAvatar from '@/shared/components/atoms/DhAvatar.vue'
import DhMascotAccessory from '@/shared/components/atoms/DhMascotAccessory.vue'
import { useAvatarMascotStore } from '@/core/stores/avatarMascotStore'
import { useAvatarAppearanceStore } from '@/core/stores/avatarAppearanceStore'
import { useAuthStore } from '@/core/stores/authStore'

const { t } = useI18n()
const mascot = useAvatarMascotStore()
const appearance = useAvatarAppearanceStore()
const auth = useAuthStore()
const mascotEmotionLabel = computed(() => t('appearance.avatarMoods.' + (appearance.expression ?? 'idle')))
const root = ref<HTMLElement | null>(null)
const dragging = ref(false)
const reducedMotion = ref(false)
const viewport = ref({ width: 1024, height: 768 })
const pixels = ref({ x: 0, y: 0 })
const PET_WIDTH = 100
const PET_HEIGHT = 118
const STEP_MS = 7000
let timer: ReturnType<typeof setInterval> | null = null
let motionQuery: MediaQueryList | null = null
let pointerId: number | null = null
let dragOrigin = { x: 0, y: 0, clientX: 0, clientY: 0 }
let didDrag = false

const roaming = computed(() => mascot.movement === 'roam' && !reducedMotion.value)
const maxX = computed(() => Math.max(0, viewport.value.width - PET_WIDTH))
const maxY = computed(() => Math.max(0, viewport.value.height - PET_HEIGHT))
const mascotStyle = computed(() => ({
  left: pixels.value.x + 'px',
  top: pixels.value.y + 'px',
  transition: roaming.value && !dragging.value ? 'left 5.8s ease-in-out, top 5.8s ease-in-out' : 'none',
}))

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(max, value))
}

function snapToSavedPosition() {
  if (dragging.value) return
  pixels.value = {
    x: Math.round(mascot.position.x * maxX.value),
    y: Math.round(mascot.position.y * maxY.value),
  }
}

function syncViewport() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  snapToSavedPosition()
}

function stopRoaming() {
  if (timer !== null) clearInterval(timer)
  timer = null
}

function roam() {
  if (!roaming.value || dragging.value || document.hidden || !mascot.visible) return
  mascot.setPosition({ x: 0.05 + Math.random() * 0.9, y: 0.08 + Math.random() * 0.8 })
}

function syncRoaming() {
  stopRoaming()
  if (roaming.value && !document.hidden && mascot.visible)
    timer = setInterval(roam, STEP_MS)
}

function syncReducedMotion() {
  reducedMotion.value = Boolean(motionQuery?.matches)
  syncRoaming()
}

function pointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  dragging.value = true
  didDrag = false
  pointerId = event.pointerId
  dragOrigin = {
    x: pixels.value.x, y: pixels.value.y, clientX: event.clientX, clientY: event.clientY,
  }
  root.value?.setPointerCapture(event.pointerId)
  stopRoaming()
}

function pointerMove(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== pointerId) return
  const dx = event.clientX - dragOrigin.clientX
  const dy = event.clientY - dragOrigin.clientY
  if (Math.abs(dx) + Math.abs(dy) > 6) didDrag = true
  pixels.value = {
    x: clamp(dragOrigin.x + dx, maxX.value),
    y: clamp(dragOrigin.y + dy, maxY.value),
  }
}

function pointerUp(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== pointerId) return
  dragging.value = false
  if (root.value?.hasPointerCapture(event.pointerId))
    root.value.releasePointerCapture(event.pointerId)
  pointerId = null
  mascot.setPosition({
    x: maxX.value ? pixels.value.x / maxX.value : 0,
    y: maxY.value ? pixels.value.y / maxY.value : 0,
  })
  syncRoaming()
}

function changeExpression() {
  if (didDrag) { didDrag = false; return }
  appearance.nextExpression()
}

function moveByKeyboard(event: KeyboardEvent) {
  const keys: Record<string, [number, number]> = {
    ArrowLeft: [-0.035, 0], ArrowRight: [0.035, 0],
    ArrowUp: [0, -0.035], ArrowDown: [0, 0.035],
  }
  const delta = keys[event.key]
  if (!delta) return
  event.preventDefault()
  mascot.setPosition({ x: mascot.position.x + delta[0], y: mascot.position.y + delta[1] })
}

watch(() => [mascot.position.x, mascot.position.y] as const, snapToSavedPosition)
watch(() => [mascot.movement, mascot.visible] as const, syncRoaming)

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionQuery.addEventListener('change', syncReducedMotion)
  window.addEventListener('resize', syncViewport)
  document.addEventListener('visibilitychange', syncRoaming)
  syncViewport()
  syncReducedMotion()
})
onBeforeUnmount(() => {
  stopRoaming()
  window.removeEventListener('resize', syncViewport)
  document.removeEventListener('visibilitychange', syncRoaming)
  motionQuery?.removeEventListener('change', syncReducedMotion)
})
</script>

<template>
  <div
    v-if="mascot.visible"
    ref="root"
    class="group fixed z-[35] flex h-[118px] w-[100px] touch-none select-none flex-col items-center"
    :style="mascotStyle"
    role="group"
    tabindex="0"
    :aria-label="mascot.name + ' · ' + mascotEmotionLabel + '. ' + t('appearance.mascotDrag')"
    @pointerdown="pointerDown"
    @pointermove="pointerMove"
    @pointerup="pointerUp"
    @pointercancel="pointerUp"
    @keydown="moveByKeyboard"
  >
    <button
      type="button"
      class="relative flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-[var(--dh-primary)]"
      :aria-label="t('appearance.avatarNext')"
      @click="changeExpression"
    >
      <DhAvatar
        :id="auth.userId"
        :name="mascot.name"
        size="lg"
        status="none"
        animate="always"
        :mood="appearance.expression ?? 'auto'"
        :controlled-expressions="true"
        :transparent-backdrop="true"
      />
      <DhMascotAccessory :kinds="mascot.accessories" />
    </button>
    <div
      class="pointer-events-none absolute left-1/2 top-[74px] flex w-max max-w-[210px] -translate-x-1/2 flex-col items-center text-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      <span class="max-w-[210px] break-words text-xs font-bold leading-4 text-[var(--dh-text)]" style="text-shadow: 0 1px 3px var(--dh-card), 0 0 4px var(--dh-card)">{{ mascot.name }}</span>
      <span class="max-w-[210px] break-words text-[11px] font-medium leading-4 text-[var(--dh-text-muted)]" style="text-shadow: 0 1px 3px var(--dh-card), 0 0 4px var(--dh-card)" aria-live="polite">{{ mascotEmotionLabel }}</span>
    </div>
  </div>
</template>
