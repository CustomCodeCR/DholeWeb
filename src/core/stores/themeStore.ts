// src/core/stores/themeStore.ts

import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'dhole.theme'
const LIQUID_BLUR_STORAGE_KEY = 'dhole.liquidBlur'
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

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system',
    liquidBlur: readLiquidBlur(),
  }),

  getters: {
    resolvedTheme(state): 'light' | 'dark' {
      return state.mode === 'system' ? getSystemTheme() : state.mode
    },
  },

  actions: {
    applyTheme() {
      const theme = this.resolvedTheme
      document.documentElement.classList.toggle('dark', theme === 'dark')
      applyLiquidBlur(this.liquidBlur)
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
  },
})
