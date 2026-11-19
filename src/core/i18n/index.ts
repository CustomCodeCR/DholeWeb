import { createI18n } from 'vue-i18n'
import es from './es.json'
import en from './en.json'
import { scrapingMessages } from '@/modules/scraping/i18n'
import { crmMessages } from '@/modules/crm/i18n'
import { srmMessages } from '@/modules/srm/i18n'
import { operationsMessages } from '@/modules/operations/i18n'
import { commercialMessages } from '@/modules/crm/commercialMessages'

export const i18n = createI18n({
  legacy: false,
  locale: 'es',
  fallbackLocale: 'en',
  messages: {
    es: { ...es, scraping: scrapingMessages.es, crm: crmMessages.es, srm: srmMessages.es, operations: operationsMessages.es, commercial: commercialMessages.es },
    en: { ...en, scraping: scrapingMessages.en, crm: crmMessages.en, srm: srmMessages.en, operations: operationsMessages.en, commercial: commercialMessages.en },
  },
})
