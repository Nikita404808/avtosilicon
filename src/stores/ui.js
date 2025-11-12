import { defineStore } from 'pinia';
export const useUiStore = defineStore('ui', {
    state: () => ({
        isCheckoutOpen: false,
    }),
    actions: {
        openCheckout() {
            this.isCheckoutOpen = true;
        },
        closeCheckout() {
            this.isCheckoutOpen = false;
        },
    },
});
