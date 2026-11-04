// src/core/stores/themeStore.ts

import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'dhole.theme'
const LIQUID_BLUR_STORAGE_KEY = 'dhole.liquidBlur'
const TEXT_COLOR_STORAGE_KEY = 'dhole.textColor'
const TEXT_COLOR_LIGHT_STORAGE_KEY = 'dhole.textColor.light'
const TEXT_COLOR_DARK_STORAGE_KEY = 'dhole.textColor.dark'
let systemThemeListenerInitialized = false
const DEFAULT_LIQUID_BLUR = 26
const MIN_LIQUID_BLUR = 0
const MAX_LIQUID_BLUR = 48

function normalizeLiquidBlur(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_LIQUID_BLUR
  return Math.min(MAX_LIQUID_BLUR, Math.max(MIN_LIQUID_BLUR, Math.round(parsed)))
}

function readLiquidBlur(): number {
  return normalizeLiquidBlur(localStorage.getItem(LIQUID_BLUR_STORAGE_KEY))
}

function applyLiquidBlur(value: number) {
  const blur = normalizeLiquidBlur(value)
  const strongBlur = Math.round(blur * 1.23)
  document.documentElement.style.setProperty('--dh-blur', `${blur}px`)
  document.documentElement.style.setProperty('--dh-blur-strong', `${strongBlur}px`)
}

function normalizeTextColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())
    ? value.trim().toLowerCase()
    : null
}

function applyTextColor(value: string | null) {
  const root = document.documentElement
  const color = normalizeTextColor(value)
  if (!color) {
    for (const name of ['--dh-text', '--dh-text-soft', '--dh-text-muted', '--dh-on-primary']) {
      root.style.removeProperty(name)
    }
    return
  }

  const rgb = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16)).join(' ')
  root.style.setProperty('--dh-text', color)
  root.style.setProperty('--dh-text-soft', `rgb(${rgb} / 0.78)`)
  root.style.setProperty('--dh-text-muted', `rgb(${rgb} / 0.56)`)
  root.style.setProperty('--dh-on-primary', color)
}

type TextColorMode = 'light' | 'dark'

function readTextColors(): Record<TextColorMode, string | null> {
  const colors = {
    light: normalizeTextColor(localStorage.getItem(TEXT_COLOR_LIGHT_STORAGE_KEY)),
    dark: normalizeTextColor(localStorage.getItem(TEXT_COLOR_DARK_STORAGE_KEY)),
  }

  // Preserve the previous single-color preference for the currently selected theme.
  const legacyColor = normalizeTextColor(localStorage.getItem(TEXT_COLOR_STORAGE_KEY))
  if (legacyColor) {
    const savedMode = localStorage.getItem(STORAGE_KEY)
    const currentTheme: TextColorMode = savedMode === 'light' || savedMode === 'dark'
      ? savedMode
      : getSystemTheme()
    if (!colors[currentTheme]) {
      colors[currentTheme] = legacyColor
      localStorage.setItem(
        currentTheme === 'light' ? TEXT_COLOR_LIGHT_STORAGE_KEY : TEXT_COLOR_DARK_STORAGE_KEY,
        legacyColor,
      )
    }
  }
  localStorage.removeItem(TEXT_COLOR_STORAGE_KEY)
  return colors
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system',
    liquidBlur: readLiquidBlur(),
    textColors: readTextColors(),
    systemTheme: getSystemTheme(),
  }),

  getters: {
    resolvedTheme(state): 'light' | 'dark' {
      return state.mode === 'system' ? state.systemTheme : state.mode
    },
  },

  actions: {
    applyTheme() {
      if (!systemThemeListenerInitialized) {
        const query = window.matchMedia('(prefers-color-scheme: dark)')
        query.addEventListener('change', (event) => {
          this.systemTheme = event.matches ? 'dark' : 'light'
          if (this.mode === 'system') this.applyTheme()
        })
        systemThemeListenerInitialized = true
      }

      this.systemTheme = getSystemTheme()
      const theme = this.resolvedTheme
      document.documentElement.classList.toggle('dark', theme === 'dark')
      applyLiquidBlur(this.liquidBlur)
      applyTextColor(this.textColors[theme])
    },

    setTheme(mode: ThemeMode) {
      this.mode = mode
      localStorage.setItem(STORAGE_KEY, mode)
      this.applyTheme()
    },

    toggleTheme() {
      this.setTheme(this.resolvedTheme === 'dark' ? 'light' : 'dark')
    },

    setLiquidBlur(value: number) {
      this.liquidBlur = normalizeLiquidBlur(value)
      localStorage.setItem(LIQUID_BLUR_STORAGE_KEY, String(this.liquidBlur))
      applyLiquidBlur(this.liquidBlur)
    },

    resetLiquidBlur() {
      this.setLiquidBlur(DEFAULT_LIQUID_BLUR)
    },

    setTextColor(mode: TextColorMode, value: string) {
      const color = normalizeTextColor(value)
      if (!color) return
      this.textColors = { ...this.textColors, [mode]: color }
      localStorage.setItem(
        mode === 'light' ? TEXT_COLOR_LIGHT_STORAGE_KEY : TEXT_COLOR_DARK_STORAGE_KEY,
        color,
      )
      if (this.resolvedTheme === mode) applyTextColor(color)
    },

    resetTextColor(mode: TextColorMode) {
      this.textColors = { ...this.textColors, [mode]: null }
      localStorage.removeItem(
        mode === 'light' ? TEXT_COLOR_LIGHT_STORAGE_KEY : TEXT_COLOR_DARK_STORAGE_KEY,
      )
      if (this.resolvedTheme === mode) applyTextColor(null)
    },
  },
})
