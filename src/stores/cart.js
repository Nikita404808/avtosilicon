import { defineStore } from 'pinia';
const normalizeWeight = (value) => {
    const numeric = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
    if (!Number.isFinite(numeric))
        return 0;
    return Math.max(0, numeric);
};
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
        totalWeight: (state) => state.lines.reduce((total, line) => {
            const quantity = Math.max(0, line.quantity);
            const weight = normalizeWeight(line.weight);
            return total + weight * quantity;
        }, 0),
    },
    actions: {
        reset() {
            Object.assign(this, defaultState());
        },
        toggleCart(isOpen) {
            this.isOpen = typeof isOpen === 'boolean' ? isOpen : !this.isOpen;
        },
        addItem(line) {
            const incoming = { ...line, weight: normalizeWeight(line.weight) };
            const existingLine = this.lines.find((current) => current.productId === incoming.productId);
            if (existingLine) {
                existingLine.quantity += incoming.quantity;
                existingLine.price = incoming.price;
                existingLine.title = incoming.title;
                existingLine.weight = incoming.weight;
                return;
            }
            this.lines.push({ ...incoming });
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
