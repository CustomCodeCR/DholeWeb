import { defineStore } from 'pinia'

export type LocaleCode = 'es' | 'en'

const STORAGE_KEY = 'dhole.locale'

function savedLocale(): LocaleCode {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'en' ? 'en' : 'es'
}

export const useLocale = defineStore('locale', {
  state: () => ({
    locale: savedLocale(),
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
