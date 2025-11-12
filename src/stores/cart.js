import { defineStore } from 'pinia';
const defaultState = () => ({
    lines: [],
    isOpen: false,
});
export const useCartStore = defineStore('cart', {
    state: defaultState,
    getters: {
        itemCount: (state) => state.lines.reduce((total, line) => total + line.quantity, 0),
        totalAmount: (state) => state.lines.reduce((total, line) => total + line.price.amount * line.quantity, 0),
        currency: (state) => state.lines[0]?.price.currency ?? 'RUB',
        hasItems: (state) => state.lines.length > 0,
    },
    actions: {
        reset() {
            Object.assign(this, defaultState());
        },
        toggleCart(isOpen) {
            this.isOpen = typeof isOpen === 'boolean' ? isOpen : !this.isOpen;
        },
        addItem(line) {
            const existingLine = this.lines.find((current) => current.productId === line.productId);
            if (existingLine) {
                existingLine.quantity += line.quantity;
                existingLine.price = line.price;
                return;
            }
            this.lines.push({ ...line });
        },
        updateQuantity(productId, quantity) {
            const line = this.lines.find((current) => current.productId === productId);
            if (!line)
                return;
            line.quantity = Math.max(1, quantity);
        },
        removeItem(productId) {
            this.lines = this.lines.filter((line) => line.productId !== productId);
        },
        clear() {
            this.lines = [];
        },
    },
});
