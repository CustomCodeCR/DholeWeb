import { createI18n } from 'vue-i18n'
import es from './es.json'
import en from './en.json'

type MessageSchema = typeof en

export const i18n = createI18n<{ message: MessageSchema }, 'es' | 'en'>({
  legacy: false,
  locale: 'es',
  fallbackLocale: 'en',
  messages: {
    es,
    en,
  },
})
