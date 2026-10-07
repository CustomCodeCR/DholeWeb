import { createI18n } from 'vue-i18n'
import es from './es.json'
import en from './en.json'
import { scrapingMessages } from '@/modules/scraping/i18n'

export const i18n = createI18n({
  legacy: false,
  locale: 'es',
  fallbackLocale: 'en',
  messages: {
    es: { ...es, scraping: scrapingMessages.es },
    en: { ...en, scraping: scrapingMessages.en },
  },
})
