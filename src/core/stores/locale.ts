import { defineStore } from 'pinia'

export type LocaleCode = 'es' | 'en'

const STORAGE_KEY = 'dhole.locale'

export const useLocale = defineStore('locale', {
  state: () => ({
    locale: (localStorage.getItem(STORAGE_KEY) as LocaleCode) || 'es',
  }),

  actions: {
    getLocale(): LocaleCode {
      return this.locale
    },

    setLocale(locale: LocaleCode) {
      this.locale = locale
      localStorage.setItem(STORAGE_KEY, locale)
    },

    toggleLocale() {
      this.setLocale(this.locale === 'es' ? 'en' : 'es')
    },
  },
})
