import './assets/main.css'

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'

import es from './core/i18n/es.json'
import en from './core/i18n/en.json'
import App from './App.vue'
import router from './core/router'
import { useLocale } from '@/core/stores/locale'
import { useThemeStore } from '@/core/stores/themeStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const localeStore = useLocale()
const themeStore = useThemeStore()
themeStore.applyTheme()

const i18n = createI18n({ legacy: false, locale: localeStore.getLocale(), fallbackLocale: 'en', messages: { en, es } })
watch(() => localeStore.getLocale(), (newLocale) => { i18n.global.locale.value = newLocale })

app.use(i18n)
app.mount('#app')
