// src/core/stores/themeStore.ts
import { defineStore } from 'pinia';
const STORAGE_KEY = 'dhole.theme';
function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export const useThemeStore = defineStore('theme', {
    state: () => ({
        mode: localStorage.getItem(STORAGE_KEY) || 'system',
    }),
    getters: {
        resolvedTheme(state) {
            return state.mode === 'system' ? getSystemTheme() : state.mode;
        },
    },
    actions: {
        applyTheme() {
            const theme = this.resolvedTheme;
            document.documentElement.classList.toggle('dark', theme === 'dark');
        },
        setTheme(mode) {
            this.mode = mode;
            localStorage.setItem(STORAGE_KEY, mode);
            this.applyTheme();
        },
        toggleTheme() {
            this.setTheme(this.resolvedTheme === 'dark' ? 'light' : 'dark');
        },
    },
});
