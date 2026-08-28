import './assets/main.css'
import './assets/pricing-rate-navigation.css'
import './assets/pricing-metric-colors.css'

import { createApp, nextTick, watch } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'

import es from './core/i18n/es.json'
import en from './core/i18n/en.json'
import App from './App.vue'
import router from './core/router'
import { useLocale } from '@/core/stores/locale'
import { useThemeStore } from '@/core/stores/themeStore'
import { useBrandingStore } from '@/core/stores/brandingStore'
import { createUiTextBridge } from '@/core/i18n/uiTextBridge'
import { installAuditNavigation } from '@/core/audit/installAuditNavigation'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
installAuditNavigation(router)

const localeStore = useLocale()
const themeStore = useThemeStore()
const brandingStore = useBrandingStore()
themeStore.applyTheme()
brandingStore.applyCachedOrDefault()

const i18n = createI18n({ legacy: false, locale: localeStore.getLocale(), fallbackLocale: 'en', messages: { en, es } })
const uiTextBridge = createUiTextBridge(() => localeStore.getLocale())

watch(() => localeStore.getLocale(), async (newLocale) => {
  i18n.global.locale.value = newLocale
  document.documentElement.lang = newLocale
  await nextTick()
  uiTextBridge.refresh()
})

app.use(i18n)
document.documentElement.lang = localeStore.getLocale()
app.mount('#app')
uiTextBridge.start()
