<script setup lang="ts">
import {
  Check,
  HardDrive,
  Image,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Smile,
  Sun,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhColorPicker, DhRange, DhSelect, DhInput } from '@/shared/components/atoms'
import DhAvatar from '@/shared/components/atoms/DhAvatar.vue'
import { DhCard } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useThemeStore, type ThemeMode } from '@/core/stores/themeStore'
import { useAuthStore } from '@/core/stores/authStore'
import { AVATAR_EXPRESSIONS, useAvatarAppearanceStore, type AvatarExpression } from '@/core/stores/avatarAppearanceStore'
import { useAvatarMascotStore, type MascotMovement } from '@/core/stores/avatarMascotStore'
import { useLocale, type LocaleCode } from '@/core/stores/locale'
import { useShortcutStore } from '@/core/stores/shortcutStore'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'
import { useBrandingStore } from '@/core/stores/brandingStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DEFAULT_CLIENT_BRANDING, type ClientBrandingSettings } from '@/core/interfaces/branding'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'

const { t } = useI18n()
const themeStore = useThemeStore()
const authStore = useAuthStore()
const avatarAppearance = useAvatarAppearanceStore()
const avatarMascot = useAvatarMascotStore()
const mascotNameDraft = ref('')
const profileFileInput = ref<HTMLInputElement | null>(null)
const profileUploadBusy = ref(false)
const profileUploadError = ref('')
watch(() => avatarMascot.name, value => { mascotNameDraft.value = value }, { immediate: true })
const avatarPreviewTrigger = ref(0)
const avatarMoodLabel = computed(() => avatarAppearance.expression
  ? t('appearance.avatarMoods.' + avatarAppearance.expression)
  : t('appearance.avatarNeutral'),
)
const avatarExpressionOptions = computed(() => AVATAR_EXPRESSIONS.map(mood => ({ value: mood, label: t('appearance.avatarMoods.' + mood) })))
function selectAvatarExpression(value: string | number) {
  avatarAppearance.setExpression(value as AvatarExpression)
}
watch(() => authStore.userId, (id) => {
  avatarAppearance.selectUser(id)
  avatarMascot.selectUser(id)
}, { immediate: true })
onMounted(() => { avatarAppearance.start(); avatarMascot.start() })
onBeforeUnmount(() => { avatarAppearance.stop(); avatarMascot.stop() })
function cycleAvatarExpression() {
  avatarPreviewTrigger.value += 1
  avatarAppearance.nextExpression()
}
const mascotMovementOptions = computed(() => [
  { value: 'fixed', label: t('appearance.mascotFixed') },
  { value: 'roam', label: t('appearance.mascotRoaming') },
])

function setMascotMovement(value: string | number) {
  avatarMascot.setMovement(value as MascotMovement)
}

async function handleProfilePhotoChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  profileUploadError.value = ''
  if (!/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
    profileUploadError.value = t('appearance.mascotImageError')
    return
  }
  profileUploadBusy.value = true
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new window.Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Cannot decode image'))
      image.src = objectUrl
    })
    const ratio = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas not available')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    avatarMascot.setPhoto(canvas.toDataURL('image/jpeg', 0.8))
  } catch {
    profileUploadError.value = t('appearance.mascotSaveError')
  } finally {
    URL.revokeObjectURL(objectUrl)
    profileUploadBusy.value = false
  }
}

const localeStore = useLocale()
const shortcutStore = useShortcutStore()
const tabsStore = useWorkspaceTabsStore()
const brandingStore = useBrandingStore()
const toastStore = useToastStore()
const backgroundInput = ref<HTMLInputElement | null>(null)

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'appearance.light', icon: Sun },
  { value: 'dark', label: 'appearance.dark', icon: Moon },
  { value: 'system', label: 'appearance.system', icon: Monitor },
]

const localeOptions: { value: LocaleCode; label: string }[] = [
  { value: 'es', label: 'appearance.spanish' },
  { value: 'en', label: 'appearance.english' },
]

const brandingForm = ref<ClientBrandingSettings>({ ...DEFAULT_CLIENT_BRANDING })
const textColorModes = ['light', 'dark'] as const
type TextColorMode = (typeof textColorModes)[number]
const textColorInputs = ref<Record<TextColorMode, string>>({
  light: themeStore.textColors.light ?? '#030202',
  dark: themeStore.textColors.dark ?? '#ffffff',
})

function updateTextColor(mode: TextColorMode, value: string) {
  textColorInputs.value[mode] = value
  if (/^#[0-9a-fA-F]{6}$/.test(value)) themeStore.setTextColor(mode, value)
}

function restoreTextColor(mode: TextColorMode) {
  themeStore.resetTextColor(mode)
  textColorInputs.value[mode] = mode === 'light' ? '#030202' : '#ffffff'
}

const overlayPercent = computed(() =>
  Math.round(Number(brandingForm.value.backgroundOverlayOpacity ?? 0) * 100),
)

const brandingPreviewStyle = computed(() => ({
  backgroundColor: brandingForm.value.primaryColor,
  backgroundImage: brandingStore.localBackgroundUrl
    ? `linear-gradient(rgb(0 0 0 / ${brandingForm.value.backgroundOverlayOpacity ?? 0.5}), rgb(0 0 0 / ${brandingForm.value.backgroundOverlayOpacity ?? 0.5})), url("${brandingStore.localBackgroundUrl.replace(/["\\\n\r]/g, '')}")`
    : undefined,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
}))

function syncBrandingForm() {
  brandingForm.value = {
    ...DEFAULT_CLIENT_BRANDING,
    ...brandingStore.settings,
    backgroundImageUrl: null,
    backgroundOverlayOpacity: brandingStore.localBackgroundOverlayOpacity,
  }
}

function previewBranding() {
  brandingStore.preview(brandingForm.value)
}

function resetBranding() {
  brandingForm.value = {
    ...DEFAULT_CLIENT_BRANDING,
    clientId: brandingStore.settings.clientId,
    clientCode: brandingStore.settings.clientCode,
    clientName: brandingStore.settings.clientName,
    backgroundImageUrl: null,
    backgroundOverlayOpacity: brandingStore.localBackgroundOverlayOpacity,
  }

  previewBranding()
}

async function saveBranding() {
  const result = await brandingStore.saveForCurrentClient({
    clientId: brandingForm.value.clientId,
    clientCode: brandingForm.value.clientCode,
    primaryColor: brandingForm.value.primaryColor,
  })

  syncBrandingForm()

  if (result.synced) {
    toastStore.success(
      t('appearance.toasts.brandingSavedTitle'),
      t('appearance.toasts.brandingSavedMessage'),
    )
    return
  }

  toastStore.warning(
    t('appearance.toasts.brandingLocalTitle'),
    t('appearance.toasts.brandingLocalMessage'),
  )
}

function openBackgroundPicker() {
  backgroundInput.value?.click()
}

async function handleBackgroundSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    await brandingStore.setLocalBackground(
      file,
      Number(brandingForm.value.backgroundOverlayOpacity ?? 0.5),
    )
    syncBrandingForm()
    toastStore.success(
      t('appearance.toasts.backgroundSavedTitle'),
      t('appearance.toasts.backgroundSavedMessage'),
    )
  } catch (error) {
    toastStore.error(
      t('appearance.toasts.backgroundErrorTitle'),
      error instanceof Error ? error.message : t('appearance.toasts.backgroundErrorMessage'),
    )
  } finally {
    input.value = ''
  }
}

function previewOverlay(value?: number) {
  if (typeof value === 'number') {
    brandingForm.value.backgroundOverlayOpacity = value
  }

  brandingStore.previewLocalBackgroundOverlay(
    Number(brandingForm.value.backgroundOverlayOpacity ?? 0.5),
  )
}

async function persistOverlay(value?: number) {
  if (typeof value === 'number') {
    brandingForm.value.backgroundOverlayOpacity = value
  }

  if (!brandingStore.hasLocalBackground) return

  try {
    await brandingStore.persistLocalBackgroundOverlay(
      Number(brandingForm.value.backgroundOverlayOpacity ?? 0.5),
    )
  } catch {
    toastStore.error(
      t('appearance.toasts.overlayErrorTitle'),
      t('appearance.toasts.overlayErrorMessage'),
    )
  }
}

async function removeBackground() {
  try {
    await brandingStore.removeLocalBackground()
    brandingForm.value.backgroundOverlayOpacity = brandingStore.localBackgroundOverlayOpacity
    toastStore.success(
      t('appearance.toasts.backgroundRemovedTitle'),
      t('appearance.toasts.backgroundRemovedMessage'),
    )
  } catch {
    toastStore.error(
      t('appearance.toasts.backgroundRemoveErrorTitle'),
      t('appearance.toasts.backgroundRemoveErrorMessage'),
    )
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function refreshAppearanceSettings() {
  await brandingStore.loadCurrentClientBranding()
  syncBrandingForm()
}

useViewShortcuts({ save: saveBranding, refresh: refreshAppearanceSettings, autoRefresh: false })

onMounted(refreshAppearanceSettings)
</script>

<template>
  <section class="space-y-4 sm:space-y-6">
    <DhPageHeader
      :title="t('appearance.title')"
      :subtitle="t('appearance.subtitle')"
      :icon="Palette"
    />

    <section class="grid gap-4 xl:grid-cols-2">
      <DhCard :title="t('appearance.theme')" :subtitle="t('appearance.themeHelp')">
        <div class="grid gap-3 sm:grid-cols-3">
          <DhCard
            v-for="option in themeOptions"
            :key="option.value"
            as="button"
            :interactive="true"
            padding="sm"
            class="relative"
            :class="themeStore.mode === option.value && 'dh-primary-selected'"
            @click="themeStore.setTheme(option.value)"
          >
            <component :is="option.icon" class="h-5 w-5 text-[var(--dh-primary)]" />
            <p class="mt-3 text-sm font-black text-[var(--dh-text)]">{{ t(option.label) }}</p>
            <Check
              v-if="themeStore.mode === option.value"
              class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]"
            />
          </DhCard>
        </div>
      </DhCard>

      <DhCard :title="t('appearance.language')" :subtitle="t('appearance.languageHelp')">
        <div class="grid gap-3 sm:grid-cols-2">
          <DhCard
            v-for="option in localeOptions"
            :key="option.value"
            as="button"
            :interactive="true"
            padding="sm"
            class="relative"
            :class="localeStore.locale === option.value && 'dh-primary-selected'"
            @click="localeStore.setLocale(option.value)"
          >
            <p class="text-sm font-black text-[var(--dh-text)]">{{ t(option.label) }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ option.value.toUpperCase() }}
            </p>
            <Check
              v-if="localeStore.locale === option.value"
              class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]"
            />
          </DhCard>
        </div>
      </DhCard>
    </section>

    <DhCard :title="t('appearance.avatarTitle')" :subtitle="t('appearance.avatarHelp')" :icon="Smile">
      <div class="grid items-center gap-6 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
        <div class="flex min-w-0 flex-col items-center gap-4 rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-6">
          <button
            type="button"
            class="relative flex h-48 w-48 touch-manipulation items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dh-primary)] focus-visible:ring-offset-4"
            :aria-label="t('appearance.avatarNext')"
            :title="t('appearance.avatarNext')"
            @click="cycleAvatarExpression"
          >
            <DhAvatar
              :id="authStore.userId"
              :name="authStore.userDisplayName || t('topbar.unknownUser')"
              size="xl"
              status="online"
              animate="always"
              :follow-cursor="true"
              :dark-backdrop="themeStore.resolvedTheme === 'dark'"
              :mood="avatarAppearance.expression ?? 'auto'"
              :controlled-expressions="true"
              :tap-trigger="avatarPreviewTrigger"
            />
          </button>
          <div class="text-center">
            <p class="text-base font-black text-[var(--dh-text)]" aria-live="polite">{{ avatarMoodLabel }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('appearance.avatarPreviewHelp') }}</p>
          </div>
        </div>
        <div class="min-w-0 space-y-4">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            {{ t('appearance.avatarBehavior') }}
          </p>
          <div class="flex flex-wrap gap-3" role="group" :aria-label="t('appearance.avatarBehavior')">
            <DhButton
              :label="t('appearance.avatarAuto')"
              :variant="avatarAppearance.automatic ? 'primary' : 'secondary'"
              :aria-pressed="avatarAppearance.automatic"
              @click="avatarAppearance.setAutomatic(true)"
            />
            <DhButton
              :label="t('appearance.avatarFixed')"
              :variant="!avatarAppearance.automatic ? 'primary' : 'secondary'"
              :aria-pressed="!avatarAppearance.automatic"
              @click="avatarAppearance.setAutomatic(false)"
            />
          </div>
          <p class="max-w-xl text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
            {{ avatarAppearance.automatic ? t('appearance.avatarAutoHelp') : t('appearance.avatarFixedHelp') }}
          </p>
          <DhSelect
            :model-value="avatarAppearance.expression"
            :label="t('appearance.avatarChoose')"
            :placeholder="t('appearance.avatarChoose')"
            :options="avatarExpressionOptions"
            @update:model-value="selectAvatarExpression"
          />
          <DhButton
            :label="t('appearance.avatarNext')"
            :icon="RotateCcw"
            variant="secondary"
            @click="cycleAvatarExpression"
          />
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('appearance.avatarStorageHelp') }}</p>
        </div>
      </div>
    </DhCard>

    <DhCard :title="t('appearance.mascotTitle')" :subtitle="t('appearance.mascotHelp')" :icon="Smile">
      <div class="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div class="flex flex-col items-center gap-3">
          <div class="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-[var(--dh-border)] bg-[var(--dh-input)]">
            <img v-if="avatarMascot.photo" :src="avatarMascot.photo" :alt="t('appearance.mascotProfilePhoto')" class="h-full w-full object-cover" />
            <DhAvatar v-else :id="authStore.userId" :name="authStore.userDisplayName || ''" size="lg" />
          </div>
          <input
            ref="profileFileInput"
            type="file"
            class="sr-only"
            accept="image/jpeg,image/png,image/webp"
            :aria-label="t('appearance.mascotUpload')"
            @change="handleProfilePhotoChange"
          />
          <DhButton
            :label="t(avatarMascot.photo ? 'appearance.mascotChangePhoto' : 'appearance.mascotUpload')"
            :disabled="profileUploadBusy"
            @click="profileFileInput?.click()"
          />
          <DhButton
            v-if="avatarMascot.photo"
            :label="t('appearance.mascotRemovePhoto')"
            variant="secondary"
            @click="avatarMascot.setPhoto(null)"
          />
        </div>
        <div class="min-w-0 space-y-4">
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('appearance.mascotLocalHelp') }}</p>
          <p v-if="profileUploadError" class="text-sm font-semibold text-red-500" role="alert">{{ profileUploadError }}</p>
          <template v-if="avatarMascot.photo">
            <div class="flex flex-wrap items-end gap-2">
              <div class="min-w-[160px] flex-1">
                <DhInput
                  v-model="mascotNameDraft"
                  :label="t('appearance.mascotName')"
                  :placeholder="t('appearance.mascotNamePlaceholder')"
                />
              </div>
              <DhButton :label="t('appearance.mascotSaveName')" variant="secondary" @click="avatarMascot.setName(mascotNameDraft)" />
            </div>
            <DhSelect
              :model-value="avatarMascot.movement"
              :label="t('appearance.mascotMovement')"
              :options="mascotMovementOptions"
              @update:model-value="setMascotMovement"
            />
            <DhButton
              :label="t(avatarMascot.visible ? 'appearance.mascotHide' : 'appearance.mascotShow')"
              variant="secondary"
              @click="avatarMascot.setVisible(!avatarMascot.visible)"
            />
            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('appearance.mascotDragHelp') }}</p>
          </template>
        </div>
      </div>
    </DhCard>

    <DhCard
      :title="t('appearance.liquidCrystal')"
      :subtitle="t('appearance.liquidCrystalHelp')"
    >
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <DhRange
          :model-value="themeStore.liquidBlur"
          :label="t('appearance.blur')"
          :value-label="t('appearance.blurValue', { value: themeStore.liquidBlur })"
          :help="t('appearance.blurHelp')"
          :min="0"
          :max="48"
          :step="1"
          @update:model-value="themeStore.setLiquidBlur"
        />
        <DhButton
          :label="t('appearance.resetBlur')"
          variant="secondary"
          :icon="RotateCcw"
          @click="themeStore.resetLiquidBlur()"
        />
      </div>
    </DhCard>

    <DhCard
      :title="t('appearance.brandingTitle')"
      :subtitle="t('appearance.brandingSubtitle')"
    >
      <template #actions>
        <span class="hidden text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)] md:block">
          {{ t('appearance.activeClient', { client: brandingStore.clientLabel }) }}
        </span>
      </template>

      <div class="flex flex-wrap gap-2 sm:gap-3">
        <DhButton
          :label="t('appearance.previewColor')"
          variant="secondary"
          :icon="Image"
          @click="previewBranding"
        />
        <DhButton
          :label="t('appearance.restoreColor')"
          variant="secondary"
          :icon="RotateCcw"
          @click="resetBranding"
        />
        <DhButton
          :label="t('appearance.saveColor')"
          :icon="Save"
          :loading="brandingStore.saving"
          @click="saveBranding"
        />
      </div>

      <p class="mt-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)] md:hidden">
        {{ t('appearance.activeClient', { client: brandingStore.clientLabel }) }}
      </p>

      <div class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="space-y-5">
          <DhColorPicker
            v-model="brandingForm.primaryColor"
            :label="t('appearance.primaryColor')"
            @update:model-value="previewBranding"
          />

          <div class="space-y-3">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              {{ t('appearance.textColor') }}
            </p>
            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-for="mode in textColorModes"
                :key="mode"
                class="min-w-0 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3"
              >
                <DhColorPicker
                  :model-value="textColorInputs[mode]"
                  :label="mode === 'light' ? t('appearance.lightTextColor') : t('appearance.darkTextColor')"
                  :presets="mode === 'light'
                    ? ['#030202', '#1f2937', '#334155', '#005b43']
                    : ['#ffffff', '#e2e8f0', '#d1d5db', '#a7f3d0']"
                  @update:model-value="(value) => updateTextColor(mode, value)"
                />
                <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-[var(--dh-text-muted)]">
                    {{ themeStore.resolvedTheme === mode ? t('appearance.activeTextColor') : t('appearance.inactiveTextColor') }}
                  </span>
                  <DhButton
                    :label="t('appearance.restoreTextColor')"
                    variant="secondary"
                    :icon="RotateCcw"
                    @click="restoreTextColor(mode)"
                  />
                </div>
              </div>
            </div>
            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ t('appearance.textColorHelp') }}
            </p>
          </div>

          <DhCard
            :title="t('appearance.localBackground')"
            :subtitle="t('appearance.localBackgroundHelp')"
            :icon="HardDrive"
            padding="sm"
          >
            <div class="flex flex-wrap gap-2">
              <input
                ref="backgroundInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleBackgroundSelected"
              />
              <DhButton
                :label="brandingStore.hasLocalBackground ? t('appearance.changeImage') : t('appearance.selectImage')"
                variant="secondary"
                :icon="Upload"
                :loading="brandingStore.localBackgroundLoading"
                @click="openBackgroundPicker"
              />
              <DhButton
                v-if="brandingStore.hasLocalBackground"
                :label="t('appearance.removeBackground')"
                variant="secondary"
                :icon="Trash2"
                @click="removeBackground"
              />
            </div>

            <div
              v-if="brandingStore.localBackgroundInfo"
              class="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]"
            >
              <span class="max-w-full truncate font-black text-[var(--dh-text)]">
                {{ brandingStore.localBackgroundInfo.fileName }}
              </span>
              <span>{{ formatBytes(brandingStore.localBackgroundInfo.size) }}</span>
              <span>{{ brandingStore.localBackgroundInfo.mimeType }}</span>
            </div>
          </DhCard>

          <DhRange
            :model-value="Number(brandingForm.backgroundOverlayOpacity ?? 0.5)"
            :label="t('appearance.overlayLabel')"
            :value-label="t('appearance.overlayValue', { value: overlayPercent })"
            :help="t('appearance.overlayHelp')"
            :min="0"
            :max="0.95"
            :step="0.05"
            :disabled="!brandingStore.hasLocalBackground"
            @update:model-value="previewOverlay"
            @change="persistOverlay"
          />
        </div>

        <aside
          class="min-h-64 rounded-[32px] border border-[var(--dh-border)] p-4 shadow-[var(--dh-shadow-sm)]"
          :style="brandingPreviewStyle"
        >
          <div class="rounded-[26px] border border-white/20 bg-black/30 p-5 text-[var(--dh-on-primary)] backdrop-blur-xl">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-[22px] bg-white/20 text-lg font-black">
              D
            </div>
            <p class="text-sm font-black uppercase tracking-[0.16em] opacity-75">
              {{ t('appearance.preview') }}
            </p>
            <h3 class="mt-2 text-2xl font-black">{{ brandingStore.clientLabel }}</h3>
            <p class="mt-2 text-sm font-semibold opacity-80">
              {{
                brandingStore.hasLocalBackground
                  ? t('appearance.previewWithBackground')
                  : t('appearance.previewWithoutBackground')
              }}
            </p>
          </div>
        </aside>
      </div>
    </DhCard>

    <DhCard
      :title="t('appearance.localPreferences')"
      :subtitle="t('appearance.localPreferencesHelp')"
    >
      <div class="flex flex-wrap gap-3">
        <DhButton
          :label="t('appearance.resetWorkspace')"
          variant="secondary"
          @click="tabsStore.clear()"
        />
        <DhButton
          :label="t('appearance.resetShortcuts')"
          variant="secondary"
          @click="shortcutStore.reset()"
        />
      </div>
    </DhCard>
  </section>
</template>
