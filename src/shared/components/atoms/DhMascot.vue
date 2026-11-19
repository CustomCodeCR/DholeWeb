<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MapPin, Move } from 'lucide-vue-next'
import DhAvatar from '@/shared/components/atoms/DhAvatar.vue'
import { useAvatarMascotStore } from '@/core/stores/avatarMascotStore'
import { useAvatarAppearanceStore } from '@/core/stores/avatarAppearanceStore'
import { useAuthStore } from '@/core/stores/authStore'

const { t } = useI18n()
const mascot = useAvatarMascotStore()
const appearance = useAvatarAppearanceStore()
const auth = useAuthStore()
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
  if (!roaming.value || dragging.value || document.hidden || !mascot.visible || !mascot.photo) return
  mascot.setPosition({ x: 0.05 + Math.random() * 0.9, y: 0.08 + Math.random() * 0.8 })
}

function syncRoaming() {
  stopRoaming()
  if (roaming.value && !document.hidden && mascot.visible && mascot.photo)
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

function toggleMovement() {
  mascot.setMovement(mascot.movement === 'roam' ? 'fixed' : 'roam')
}

watch(() => [mascot.position.x, mascot.position.y] as const, snapToSavedPosition)
watch(() => [mascot.movement, mascot.photo, mascot.visible] as const, syncRoaming)

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
    v-if="mascot.photo && mascot.visible"
    ref="root"
    class="fixed z-[35] flex w-[100px] touch-none select-none flex-col items-center gap-1"
    :style="mascotStyle"
    role="group"
    tabindex="0"
    :aria-label="t('appearance.mascotDrag')"
    @pointerdown="pointerDown"
    @pointermove="pointerMove"
    @pointerup="pointerUp"
    @pointercancel="pointerUp"
    @keydown="moveByKeyboard"
  >
    <button
      type="button"
      class="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-[var(--dh-card)] shadow-xl ring-1 ring-[var(--dh-border)] focus-visible:outline-2 focus-visible:outline-[var(--dh-primary)]"
      :aria-label="t('appearance.avatarNext')"
      :title="t('appearance.avatarNext')"
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
      />
    </button>
    <div class="flex max-w-[100px] items-center gap-1 rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)]/95 px-2 py-1 shadow-lg backdrop-blur">
      <span class="max-w-[65px] truncate text-[10px] font-bold text-[var(--dh-text)]" :title="mascot.name">{{ mascot.name }}</span>
      <button
        type="button"
        class="shrink-0 rounded p-0.5 text-[var(--dh-text-muted)] hover:text-[var(--dh-primary)] focus-visible:outline-2"
        :aria-label="t(mascot.movement === 'roam' ? 'appearance.mascotFix' : 'appearance.mascotRoam')"
        :title="t(mascot.movement === 'roam' ? 'appearance.mascotFix' : 'appearance.mascotRoam')"
        @pointerdown.stop
        @click.stop="toggleMovement"
      >
        <MapPin v-if="mascot.movement === 'roam'" class="h-3 w-3" />
        <Move v-else class="h-3 w-3" />
      </button>
    </div>
  </div>
</template>
