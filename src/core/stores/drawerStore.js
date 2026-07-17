import { defineStore } from 'pinia';
export const useDrawerStore = defineStore('drawer', {
    state: () => ({
        isOpen: false,
        title: '',
        component: null,
        props: {},
        size: 'md',
    }),
    actions: {
        open(input) {
            this.title = input.title;
            this.component = input.component;
            this.props = input.props ?? {};
            this.size = input.size ?? 'md';
            this.isOpen = true;
        },
        close() {
            this.isOpen = false;
            this.title = '';
            this.component = null;
            this.props = {};
            this.size = 'md';
        },
    },
});
