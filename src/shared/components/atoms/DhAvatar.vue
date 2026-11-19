<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Blobatar } from '@blobatar/vue'
import { useGaze } from '@blobatar/vue/gaze'
import { happy, idle, love, mad, sad, scared, shy, sick, sleepy, smug, surprised, thinking, unsure, wink } from 'blobatar/expression'
import { stressed, tired, resigned, achicopalado, emperrado, emocionado, nostalgico, desesperado, aburrido, pereza, celoso, avergonzado, culpable, orgulloso, curioso, asqueado, preocupado, decepcionado, irritado, impaciente, ojosLlorosos, arrogante, melancolico, humillado, miserable, abrumado, vulnerable, rechazado, desilusionado, alarmado, horrorizado, pasmado, irritable, desconcertado, desmotivado, resentido, agobiado, temeroso, incomodo, cringe, burlon, picaro, paranoico, disociado } from './blobatarExpressions'
import type { AvatarExpression } from '@/core/stores/avatarAppearanceStore'
import 'blobatar/motion.css'
import 'blobatar/gaze.css'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'
type AvatarMood = 'auto' | AvatarExpression
type PreviewMood = Exclude<AvatarMood, 'auto'>

// Blobatar 2.7 roster: the first manual click without a saved preference shows "mad".
const previewMoods = ['mad', 'happy', 'sad', 'surprised', 'wink', 'sleepy', 'smug', 'unsure', 'scared', 'love', 'shy', 'sick', 'thinking', 'idle', 'stressed', 'tired', 'resigned', 'achicopalado', 'emperrado', 'emocionado', 'nostalgico', 'desesperado', 'aburrido', 'pereza', 'celoso', 'avergonzado', 'culpable', 'orgulloso', 'curioso', 'asqueado', 'preocupado', 'decepcionado', 'irritado', 'impaciente', 'ojosLlorosos', 'arrogante', 'melancolico', 'humillado', 'miserable', 'abrumado', 'vulnerable', 'rechazado', 'desilusionado', 'alarmado', 'horrorizado', 'pasmado', 'irritable', 'desconcertado', 'desmotivado', 'resentido', 'agobiado', 'temeroso', 'incomodo', 'cringe', 'burlon', 'picaro', 'paranoico', 'disociado'] as const satisfies readonly PreviewMood[]
const AUTO_MOOD_INTERVAL_MS = 30_000
const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    src?: string | null
    id?: string | number | null
    name?: string
    size?: AvatarSize
    status?: 'online' | 'offline' | 'busy' | 'none'
    fallback?: 'blobatar' | 'initials'
    animate?: boolean | 'hover' | 'always'
    followCursor?: boolean
    mood?: AvatarMood
    darkBackdrop?: boolean
    transparentBackdrop?: boolean
    tapTrigger?: number
    previewExpressions?: boolean
    autoExpressions?: boolean
    controlledExpressions?: boolean
  }>(),
  {
    size: 'md',
    status: 'none',
    fallback: 'blobatar',
    animate: false,
    followCursor: false,
    mood: 'auto',
    darkBackdrop: false,
    transparentBackdrop: false,
    tapTrigger: 0,
    previewExpressions: false,
    autoExpressions: false,
    controlledExpressions: false,
  },
)

const photoFailed = ref(false)
const hovered = ref(false)
const tapMood = ref<PreviewMood | null>(null)
const previewIndex = ref(-1)
const previewLabel = computed(() => {
  const selected = props.controlledExpressions && props.mood !== 'auto' ? props.mood : tapMood.value
  return selected ? t('appearance.avatarMoods.' + selected) : ''
})
const tapActive = ref(false)
const tapVariant = ref(false)
const tapTimers: ReturnType<typeof setTimeout>[] = []
let autoMoodTimer: ReturnType<typeof setInterval> | null = null
let avatarMounted = false

function avatarMoodStorageKey(): string | null {
  const id = String(props.id ?? '').trim()
  return id ? `dhole.blobatar.expression.v1:${encodeURIComponent(id)}` : null
}

function rememberMood(mood: PreviewMood) {
  const key = avatarMoodStorageKey()
  if (!key) return
  try { window.localStorage.setItem(key, mood) } catch { /* Storage can be disabled. */ }
}

function restoreMood() {
  tapMood.value = null
  previewIndex.value = -1
  const key = avatarMoodStorageKey()
  if (!key) return
  try {
    const saved = window.localStorage.getItem(key)
    const index = previewMoods.indexOf(saved as PreviewMood)
    if (index >= 0) {
      previewIndex.value = index
      tapMood.value = previewMoods[index] ?? null
    }
  } catch { /* Fall back to the default expression. */ }
}

function advancePreviewMood() {
  previewIndex.value = (previewIndex.value + 1) % previewMoods.length
  tapMood.value = previewMoods[previewIndex.value] ?? 'mad'
  rememberMood(tapMood.value)
}

function stopAutoMoodTimer() {
  if (autoMoodTimer !== null) clearInterval(autoMoodTimer)
  autoMoodTimer = null
}

function syncAutoMoodTimer() {
  stopAutoMoodTimer()
  if (!avatarMounted || !props.previewExpressions || props.controlledExpressions || !props.autoExpressions ||
      document.hidden || Boolean(reducedMotion?.matches)) return
  autoMoodTimer = setInterval(advancePreviewMood, AUTO_MOOD_INTERVAL_MS)
}

function clearTapTimers() {
  for (const timer of tapTimers) clearTimeout(timer)
  tapTimers.length = 0
}

function playTapReaction() {
  clearTapTimers()
  tapVariant.value = !tapVariant.value
  tapActive.value = true
  if (props.controlledExpressions) {
    tapTimers.push(setTimeout(() => { tapActive.value = false }, 720))
    return
  }
  if (props.previewExpressions) {
    advancePreviewMood()
    syncAutoMoodTimer()
    // Keep the selected pose until the next click; only stop the bounce.
    tapTimers.push(setTimeout(() => { tapActive.value = false }, 720))
    return
  }
  tapMood.value = 'surprised'
  tapTimers.push(setTimeout(() => { tapMood.value = 'wink' }, 330))
  tapTimers.push(setTimeout(() => { tapMood.value = 'happy' }, 750))
  tapTimers.push(setTimeout(() => { tapMood.value = null; tapActive.value = false }, 1600))
}

watch(() => props.tapTrigger, (value, previous) => {
  if (value > 0 && value !== previous) playTapReaction()
})
watch(() => props.src, () => { photoFailed.value = false })
watch(() => props.id, () => {
  if (!avatarMounted || !props.previewExpressions || props.controlledExpressions) return
  restoreMood()
  syncAutoMoodTimer()
})
watch(() => props.autoExpressions, () => {
  if (avatarMounted) syncAutoMoodTimer()
})

const avatarSeed = computed(() => String(props.id ?? '').trim() || props.name?.trim() || '')
const pixelSize = computed(() => ({ sm: 32, md: 40, lg: 56, xl: 160 })[props.size])
const sizeClass = computed(() => ({
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-40 w-40',
})[props.size])
const animationMode = computed(() => props.animate === true ? 'hover' : props.animate || undefined)
const showMotionAura = computed(() =>
  !props.transparentBackdrop &&
  (!props.src || photoFailed.value) &&
  props.fallback === 'blobatar' &&
  Boolean(avatarSeed.value) &&
  Boolean(animationMode.value),
)

const expressions = { idle, happy, sad, mad, surprised, wink, sleepy, smug, unsure, scared, love, shy, sick, thinking, stressed, tired, resigned, achicopalado, emperrado, emocionado, nostalgico, desesperado, aburrido, pereza, celoso, avergonzado, culpable, orgulloso, curioso, asqueado, preocupado, decepcionado, irritado, impaciente, ojosLlorosos, arrogante, melancolico, humillado, miserable, abrumado, vulnerable, rechazado, desilusionado, alarmado, horrorizado, pasmado, irritable, desconcertado, desmotivado, resentido, agobiado, temeroso, incomodo, cringe, burlon, picaro, paranoico, disociado }
const activeMood = computed<Exclude<AvatarMood, 'auto'>>(() => {
  if (props.controlledExpressions && props.mood !== 'auto') return props.mood
  if (tapMood.value && !props.controlledExpressions) return tapMood.value
  if (props.mood !== 'auto') return props.mood
  if (props.status === 'busy') return 'thinking'
  if (props.status === 'offline') return 'sleepy'
  return hovered.value && animationMode.value ? 'happy' : 'idle'
})
const expression = computed(() => expressions[activeMood.value])

const initials = computed(() => {
  if (!props.name?.trim()) return '?'
  return props.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
})

// The gaze driver only receives a live SVG reference on an opted-in hero avatar.
const trackedBlob = ref<InstanceType<typeof Blobatar> | null>(null)
const canTrackPointer = ref(false)
let reducedMotion: MediaQueryList | null = null
let finePointer: MediaQueryList | null = null

function syncPointerSupport() {
  canTrackPointer.value = Boolean(finePointer?.matches) && !Boolean(reducedMotion?.matches)
}
useGaze(trackedBlob, { travel: 3, target: 'pointer' })
onMounted(() => {
  avatarMounted = true
  if (props.previewExpressions && !props.controlledExpressions) {
    restoreMood()
    document.addEventListener('visibilitychange', syncAutoMoodTimer)
  }
  if (props.followCursor || (props.previewExpressions && !props.controlledExpressions)) {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.addEventListener('change', syncAutoMoodTimer)
  }
  if (props.followCursor) {
    finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    reducedMotion?.addEventListener('change', syncPointerSupport)
    finePointer.addEventListener('change', syncPointerSupport)
    syncPointerSupport()
  }
  syncAutoMoodTimer()
})
onBeforeUnmount(() => {
  avatarMounted = false
  clearTapTimers()
  stopAutoMoodTimer()
  document.removeEventListener('visibilitychange', syncAutoMoodTimer)
  reducedMotion?.removeEventListener('change', syncAutoMoodTimer)
  reducedMotion?.removeEventListener('change', syncPointerSupport)
  finePointer?.removeEventListener('change', syncPointerSupport)
})
function handlePointerEnter(event: PointerEvent) {
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') hovered.value = true
}
</script>

<template>
  <div
    class="dh-avatar relative isolate inline-flex shrink-0 items-center justify-center"
    :class="{
      'dh-avatar--alive': showMotionAura,
      'dh-avatar--hero': animationMode === 'always',
      'dh-avatar--dark': darkBackdrop && !transparentBackdrop,
      'dh-avatar--tap-a': tapActive && tapVariant,
      'dh-avatar--tap-b': tapActive && !tapVariant,
    }"
    @pointerenter="handlePointerEnter"
    @pointerleave="hovered = false"
  >
    <span v-if="showMotionAura" class="dh-avatar__aura" aria-hidden="true" />
    <span
      v-if="previewExpressions"
      aria-live="polite"
      role="status"
      class="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-lg"
      :class="[darkBackdrop ? 'border-white/15 bg-zinc-950 text-white' : 'border-slate-200 bg-white text-slate-900', { invisible: !previewLabel }]"
    >{{ previewLabel }}</span>

    <img
      v-if="src && !photoFailed"
      :src="src"
      :alt="name || ''"
      class="dh-avatar__face rounded-full object-cover ring-2 ring-white/70 dark:ring-white/10"
      :class="sizeClass"
      @error="photoFailed = true"
    />

    <Blobatar
      v-else-if="fallback === 'blobatar' && avatarSeed && followCursor && animationMode === 'always' && canTrackPointer"
      ref="trackedBlob"
      :name="avatarSeed"
      :size="pixelSize"
      :background="transparentBackdrop || darkBackdrop ? false : 'circle'"
      :hue="210"
      animate="always"
      :expression="expression"
      :title="name || undefined"
      class="dh-avatar__face rounded-full"
      :class="[sizeClass, !transparentBackdrop && 'ring-2 ring-white/70 dark:ring-white/10']"
    />

    <Blobatar
      v-else-if="fallback === 'blobatar' && avatarSeed"
      :name="avatarSeed"
      :size="pixelSize"
      :background="transparentBackdrop || darkBackdrop ? false : 'circle'"
      :hue="210"
      :animate="animationMode"
      :expression="expression"
      :title="name || undefined"
      :alt="name || ''"
      class="dh-avatar__face rounded-full"
      :class="[sizeClass, !transparentBackdrop && 'ring-2 ring-white/70 dark:ring-white/10']"
    />

    <span
      v-else
      class="dh-avatar__face inline-flex items-center justify-center rounded-full bg-[var(--dh-primary)] font-bold text-white ring-2 ring-white/70 dark:ring-white/10"
      :class="[
        sizeClass,
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        size === 'lg' && 'text-base',
      ]"
    >
      {{ initials }}
    </span>

    <span
      v-if="status !== 'none'"
      class="dh-avatar__presence absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-[var(--dh-black)]"
      :class="[
        size === 'sm' && 'h-2.5 w-2.5',
        size === 'md' && 'h-3 w-3',
        size === 'lg' && 'h-4 w-4',
        status === 'online' && 'bg-green-500',
        status === 'offline' && 'bg-zinc-400',
        status === 'busy' && 'bg-red-500',
      ]"
    />
  </div>
</template>

<style scoped>
.dh-avatar--dark {
  background: #000;
  border-radius: 9999px;
}
.dh-avatar--dark .dh-avatar__aura {
  background: radial-gradient(circle, rgba(103, 232, 249, 0.24), rgba(56, 189, 248, 0.08) 55%, transparent 80%);
}
.dh-avatar__aura {
  position: absolute;
  z-index: 0;
  inset: -5px;
  border-radius: 999px;
  pointer-events: none;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.28) 18%, rgba(99, 102, 241, 0.12) 56%, transparent 76%);
  filter: blur(7px);
  opacity: 0.45;
  transform: scale(0.94);
  transition: opacity 280ms ease, transform 350ms ease;
}
.dh-avatar__face {
  position: relative;
  z-index: 1;
  display: block;
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1), filter 240ms ease;
}
.dh-avatar__presence {
  z-index: 2;
  box-shadow: 0 0 0 2px var(--dh-card, transparent);
}
.dh-avatar--hero .dh-avatar__aura {
  animation: dh-avatar-aura 4.8s ease-in-out infinite;
}
@media (hover: hover) {
  .dh-avatar--alive:hover .dh-avatar__aura {
    opacity: 0.9;
    transform: scale(1.22);
  }
  .dh-avatar--alive:hover .dh-avatar__face {
    transform: translateY(-1px);
    filter: drop-shadow(0 3px 5px rgba(38, 99, 200, 0.2));
  }
}
@keyframes dh-avatar-tap-a {
  0%, 100% { transform: scale(1) rotate(0deg); }
  30% { transform: scale(1.16) rotate(-9deg); }
  65% { transform: scale(0.96) rotate(5deg); }
}
@keyframes dh-avatar-tap-b {
  0%, 100% { transform: scale(1) rotate(0deg); }
  30% { transform: scale(1.16) rotate(9deg); }
  65% { transform: scale(0.96) rotate(-5deg); }
}
.dh-avatar--tap-a .dh-avatar__face { animation: dh-avatar-tap-a 710ms cubic-bezier(0.2, 1, 0.25, 1); }
.dh-avatar--tap-b .dh-avatar__face { animation: dh-avatar-tap-b 710ms cubic-bezier(0.2, 1, 0.25, 1); }
.dh-avatar--tap-a .dh-avatar__aura,
.dh-avatar--tap-b .dh-avatar__aura { opacity: 0.95; transform: scale(1.3); }
@keyframes dh-avatar-aura {
  0%, 100% { opacity: 0.33; transform: scale(0.93); }
  50% { opacity: 0.64; transform: scale(1.12); }
}
@media (prefers-reduced-motion: reduce) {
  .dh-avatar__aura,
  .dh-avatar__face {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
</style>
