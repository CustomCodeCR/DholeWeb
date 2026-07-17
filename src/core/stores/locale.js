import { defineStore } from 'pinia';
const STORAGE_KEY = 'dhole.locale';
export const useLocale = defineStore('locale', {
    state: () => ({
        locale: localStorage.getItem(STORAGE_KEY) || 'es',
    }),
    actions: {
        getLocale() {
            return this.locale;
        },
        setLocale(locale) {
            this.locale = locale;
            localStorage.setItem(STORAGE_KEY, locale);
        },
        toggleLocale() {
            this.setLocale(this.locale === 'es' ? 'en' : 'es');
        },
    },
});
